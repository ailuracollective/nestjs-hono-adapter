const accept = (value: string): RequestInit => ({
  headers: { accept: value },
});

const carrying = (header: string, value: string): RequestInit => ({ headers: { [header]: value } });

export { accept, carrying };
