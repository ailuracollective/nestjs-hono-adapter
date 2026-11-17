import { Link } from '@inertiajs/react';
import type { ReactElement } from 'react';

import type { ContactHomeProps } from '../../contacts.js';

/** Contact list page for the React app. */
export function Home({ contacts, flash }: ContactHomeProps): ReactElement {
  return (
    <main>
      <h1>Contacts</h1>
      {flash ? <p role="status">{flash.success}</p> : undefined}
      <ul>
        {contacts.map((contact) => (
          <li key={contact.id}>
            {contact.name} &lt;{contact.email}&gt;
          </li>
        ))}
      </ul>
      <Link href="/inertia-react/form">New contact</Link>
    </main>
  );
}
