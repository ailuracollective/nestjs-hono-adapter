/** One request, carrying an `Accept` header and nothing else. */
const accept = (value: string): RequestInit => ({
  headers: { accept: value },
});

/** One request, carrying one named header and nothing else. */
const carrying = (
  header: string,
  value: string,
): RequestInit => ({ headers: { [header]: value } });

export { accept, carrying };
