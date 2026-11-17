interface Contact {
  readonly email: string;
  readonly id: number;
  readonly name: string;
}

interface ContactFormProps {
  readonly errors: Record<string, string>;
}

interface ContactHomeProps {
  readonly contacts: readonly Contact[];
  readonly flash: { readonly success: string } | undefined;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u;
const MAX_CONTACTS = 20;
const FIELD_ERRORS: Record<string, string> = {
  email: 'Enter a valid email address.',
  name: 'Enter a name.',
};

const contacts: Contact[] = [{ email: 'ada@example.com', id: 1, name: 'Ada Lovelace' }];
let nextId = 2;

/** Props for the contact form, with a field error when redirected back after a failure. */
const formProps = (error: unknown): ContactFormProps => {
  if (typeof error !== 'string') return { errors: {} };
  const message = FIELD_ERRORS[error];
  return { errors: message === undefined ? {} : { [error]: message } };
};

/** Props for the contact list, with a success flash when redirected after a create. */
const homeProps = (created: unknown): ContactHomeProps => ({
  contacts: [...contacts],
  flash: created === '1' ? { success: 'Contact created.' } : undefined,
});

/**
 * Validates and stores a submitted contact.
 *
 * @param body - The parsed request body.
 * @returns The invalid field name, or `undefined` when the contact was created.
 */
const createContact = (body: Record<string, unknown>): string | undefined => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (name === '') return 'name';
  if (!EMAIL.test(email)) return 'email';
  contacts.push({ email, id: nextId, name });
  nextId += 1;
  if (contacts.length > MAX_CONTACTS) contacts.shift();
  return undefined;
};

export { createContact, formProps, homeProps };
export type { Contact, ContactFormProps, ContactHomeProps };
