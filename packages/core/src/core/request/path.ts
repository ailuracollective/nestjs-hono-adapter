const PARAMETER = /^[A-Za-z0-9_]+/u;

const OPTIONAL_SEGMENT = /^:(?<name>[A-Za-z0-9_]+)(?:\((?<constraint>[^()]*)\))?\??$/u;
const OPTIONAL_WILDCARD = /^\*(?<name>[A-Za-z0-9_]*)$/u;

const REFUSED = new Set(['}', ')']);

const MISSING = -1;

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/u;

const unsupported = (path: string): TypeError =>
  new TypeError(
    `The route path "${path}" is not one the Hono adapter ` +
      'can translate. Write it the way Hono reads it: ' +
      '`:name`, `:name?`, `:name{regex}`, `{/:name}`, `{/*name}`, ' +
      '`(one|other)` or `*`.',
  );

const escapeLiteral = (character: string): string =>
  REGEX_SPECIAL.test(character) ? `\\${character}` : character;

// The closing parenthesis of the group that opens at `start`, honouring nesting.
const groupEnd = (path: string, start: number): number => {
  let depth = 0;
  for (let index = start; index < path.length; index += 1) {
    const character = path.charAt(index);
    if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return MISSING;
};

// Express 4 (path-to-regexp v0) reads `(one|other)` in a segment as a regex group, and Hono
// anchors `:name{regex}` to the whole segment — so the segment becomes one named parameter whose
// regex spells the literals around the group.
const groupAt = (segment: string, index: number): { length: number; text: string } => {
  if (segment.charAt(index) !== '(') {
    return { length: 1, text: escapeLiteral(segment.charAt(index)) };
  }
  const end = groupEnd(segment, index);
  if (end === MISSING) throw unsupported(segment);
  return { length: end + 1 - index, text: segment.slice(index, end + 1) };
};

const segmentRegex = (segment: string): string => {
  let regex = '';
  let index = 0;
  while (index < segment.length) {
    const part = groupAt(segment, index);
    regex += part.text;
    index += part.length;
  }
  return regex;
};

const withoutLeadingSlash = (content: string): string => {
  if (content.startsWith('/')) {
    return content.slice(1);
  }
  return content;
};

const isOptionalWildcard = (content: string): boolean =>
  OPTIONAL_WILDCARD.test(withoutLeadingSlash(content));

const translateGroup = (content: string, path: string): string => {
  const body = withoutLeadingSlash(content);
  if (OPTIONAL_WILDCARD.test(body)) return '/*';
  const match = OPTIONAL_SEGMENT.exec(body);
  if (match === null) throw unsupported(path);
  const { constraint, name } = match.groups ?? {
    constraint: undefined,
    name: '',
  };
  if (constraint === undefined) {
    return `/:${name}?`;
  }
  return `/:${name}{${constraint}}?`;
};

class PathTranslator {
  private groups = 0;
  private index = 0;
  private literalSegment = true;
  private translated = '';
  private readonly path: string;

  public constructor(path: string) {
    this.path = path;
  }

  public translate(): string {
    while (this.index < this.path.length) {
      this.step();
    }
    return this.translated;
  }

  private step(): void {
    const character = this.path.charAt(this.index);
    if (REFUSED.has(character)) {
      throw unsupported(this.path);
    }
    if (this.readSpecial(character)) {
      return;
    }
    this.emit(character);
    if (character === '/') this.literalSegment = true;
    this.index += 1;
  }

  private readSpecial(character: string): boolean {
    if (character === '{') this.readGroup();
    else if (character === ':') {
      this.readParameter();
    } else if (character === '*') {
      this.readWildcard();
    } else if (character === '(') {
      this.readAlternation();
    } else {
      return false;
    }
    return true;
  }

  private emit(text: string): void {
    this.translated += text;
  }

  // An alternation with no preceding `:name` — `/feeds/all.(json|rss|atom)` — closes over the whole
  // segment: the literals already written plus the group become one named parameter's regex.
  private readAlternation(): void {
    if (!this.literalSegment) throw unsupported(this.path);
    const start = this.translated.lastIndexOf('/') + 1;
    const prefix = this.translated.slice(start);
    const stop = this.segmentStop();
    const segment = this.path.slice(this.index - prefix.length, stop);
    this.translated = this.translated.slice(0, start);
    this.emit(`:${this.groupName()}{${segmentRegex(segment)}}`);
    this.literalSegment = false;
    this.index = stop;
  }

  private segmentStop(): number {
    const end = this.path.indexOf('/', this.index);
    return end === MISSING ? this.path.length : end;
  }

  private groupName(): string {
    this.groups += 1;
    const name = `group${this.groups}`;
    // Hono keys parameters by name, so a generated one must not shadow one the route carries.
    if (this.path.includes(`:${name}`)) return this.groupName();
    return name;
  }

  private readGroup(): void {
    const end = this.path.indexOf('}', this.index);
    if (end === MISSING) throw unsupported(this.path);
    const content = this.path.slice(this.index + 1, end);
    const optionalWildcard = isOptionalWildcard(content);
    this.emit(translateGroup(content, this.path));
    this.literalSegment = false;
    this.index = end + 1;
    if (optionalWildcard) this.skipWildcard();
  }

  private skipWildcard(): void {
    if (this.path.startsWith('/*', this.index)) {
      this.index += 2;
      const match = PARAMETER.exec(this.path.slice(this.index));
      if (match !== null) this.index += match[0].length;
      return;
    }
    if (this.path.charAt(this.index) === '*') this.index += 1;
  }

  private readParameter(): void {
    const match = PARAMETER.exec(this.path.slice(this.index + 1));
    if (match === null) {
      this.emit(':');
      this.index += 1;
      return;
    }
    const [name] = match;
    this.index += name.length + 1;
    this.closeParameter(name);
  }

  private closeParameter(name: string): void {
    if (this.path.charAt(this.index) !== '(') {
      this.emit(`:${name}`);
      this.literalSegment = false;
      return;
    }
    const end = this.path.indexOf(')', this.index);
    if (end === MISSING) throw unsupported(this.path);
    const constraint = this.path.slice(this.index + 1, end);
    this.emit(`:${name}{${constraint}}`);
    this.literalSegment = false;
    this.index = end + 1;
  }

  private readWildcard(): void {
    const match = PARAMETER.exec(this.path.slice(this.index + 1));
    this.emit('*');
    this.literalSegment = false;
    if (match === null) {
      this.index += 1;
      return;
    }
    const [name] = match;
    this.index += name.length + 1;
  }
}

const toHonoPath = (path: string): string => new PathTranslator(path).translate();

export { toHonoPath };
