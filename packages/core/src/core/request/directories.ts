/** The directories a call named, as a list. */
const toDirectories = (
  path: string | readonly string[],
): readonly string[] => {
  if (typeof path === 'string') {
    return [path];
  }

  return path;
};

export { toDirectories };
