<script lang="ts">
  import { Link } from '@inertiajs/svelte';

  import type { ContactHomeProps } from '../../contacts';

  let { contacts, flash }: ContactHomeProps = $props();
</script>

<main>
  <h1>Contacts</h1>
  {#if flash}
    <p role="status">{flash.success}</p>
  {/if}
  <ul>
    {#each contacts as contact (contact.id)}
      <li>{contact.name} &lt;{contact.email}&gt;</li>
    {/each}
  </ul>
  <Link href="/inertia-svelte/form">New contact</Link>
</main>
