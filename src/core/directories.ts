/**
 * The directories a call named, as a list.
 *
 * This is the shared primitive both features name, not a
 * static-assets capability that views happen to borrow. A
 * deployment writes a directory either as one path or as a list
 * of them, and answering which of the two was written is a
 * question about the shape of the option rather than about
 * serving files or rendering templates. It lives in `core/`
 * because `features/` never imports `features/`: two optional
 * features sharing a primitive is a layering mistake, not a
 * dependency one.
 */
function toDirectories(
  path: string | readonly string[],
): readonly string[] {
  if (typeof path === 'string') {
    return [path];
  }

  return path;
}

export { toDirectories };
