interface PartOptions {
  name?: string;
  filename?: string;
  type?: string;
}

const filePart = (content: string, options: PartOptions = {}): FormData => {
  const form = new FormData();
  const { filename = 'a.txt', name = 'file', type = 'text/plain' } = options;
  form.append(name, new Blob([content], { type }), filename);
  return form;
};

const textFiles = (field: string, contents: string[]): FormData => {
  const form = new FormData();
  for (const [index, content] of contents.entries()) {
    const name = `${index}.txt`;
    form.append(field, new Blob([content], { type: 'text/plain' }), name);
  }
  return form;
};

export { filePart, textFiles };
