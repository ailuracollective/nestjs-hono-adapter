/** A continuation's answer, or nothing when it answered none. */
const passed = async (
  run: () => Promise<unknown>,
): Promise<Response | undefined> => {
  const answered = await run();
  return answered instanceof Response ? answered : undefined;
};

export { passed };
