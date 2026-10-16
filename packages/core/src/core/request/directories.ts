const toDirectories = (path: string | readonly string[]): readonly string[] => {
  if (typeof path === 'string') return [path];

  return path;
};

export { toDirectories };
