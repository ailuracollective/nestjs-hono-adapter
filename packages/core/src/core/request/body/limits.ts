/** How a limit may be written, in the notation Nest accepts. */
const LIMIT =
  /^\s*(?<amount>\d+(?:\.\d+)?)\s*(?<unit>b|kb|mb|gb|tb|pb)?\s*$/iu;

/** The size a kibibyte stands for, which every unit is built on. */
const BYTES_PER_KIB = 1024;

/** The size a mebibyte stands for. */
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
/** The size a gibibyte stands for. */
const BYTES_PER_GIB = BYTES_PER_MIB * BYTES_PER_KIB;
/** The size a tebibyte stands for. */
const BYTES_PER_TIB = BYTES_PER_GIB * BYTES_PER_KIB;
/** The size a pebibyte stands for. */
const BYTES_PER_PIB = BYTES_PER_TIB * BYTES_PER_KIB;

/** The size each unit of a limit stands for. */
const UNITS = new Map<string, number>([
  ['b', 1],
  ['gb', BYTES_PER_GIB],
  ['kb', BYTES_PER_KIB],
  ['mb', BYTES_PER_MIB],
  ['pb', BYTES_PER_PIB],
  ['tb', BYTES_PER_TIB],
]);

/** Reads a size such as `100kb` into a byte count. */
const toByteLimit = (limit: number | string): number => {
  if (typeof limit === 'number') {
    return limit;
  }
  const match = LIMIT.exec(limit);
  if (match === null) {
    throw new TypeError(
      `The body limit "${limit}" is not a size such as ` +
        '"100kb" or "1mb".',
    );
  }
  const { amount, unit } = match.groups ?? {};
  const bytes = Number(amount ?? '');
  const suffix = (unit ?? 'b').toLowerCase();
  return Math.floor(bytes * (UNITS.get(suffix) ?? 1));
};

export { toByteLimit };
