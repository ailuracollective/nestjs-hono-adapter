/** The directories a call named, as a list. */
function toDirectories(
  path: string | readonly string[],
): readonly string[] {
  if (typeof path === 'string') {
    return [path];
  }

  return path;
}

export { toDirectories };
