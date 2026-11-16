import { Link, useForm } from '@inertiajs/react';
import type { FormEvent, ReactElement } from 'react';

import type { ContactFormProps } from '../../contacts.js';

/** Reads an input value without pulling the DOM lib into the whole benchmark build. */
const readInput = (target: EventTarget): string => {
  const value: unknown = Reflect.get(target, 'value');
  return typeof value === 'string' ? value : '';
};

/** Contact form page for the React app. */
export function Form({ errors }: ContactFormProps): ReactElement {
  const form = useForm({ email: '', name: '' });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    form.post('/inertia-react/form');
  };

  return (
    <main>
      <h1>New contact</h1>
      <form onSubmit={submit}>
        <label>
          Name
          <input
            name="name"
            value={form.data.name}
            onChange={(event) => {
              form.setData('name', readInput(event.target));
            }}
          />
        </label>
        {errors.name === undefined ? undefined : <p>{errors.name}</p>}
        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.data.email}
            onChange={(event) => {
              form.setData('email', readInput(event.target));
            }}
          />
        </label>
        {errors.email === undefined ? undefined : <p>{errors.email}</p>}
        <button type="submit" disabled={form.processing}>
          Save
        </button>
      </form>
      <Link href="/inertia-react">Back</Link>
    </main>
  );
}
