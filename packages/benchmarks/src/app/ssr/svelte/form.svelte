<script lang="ts">
  import { Link, useForm } from '@inertiajs/svelte';

  import type { ContactFormProps } from '../../contacts';

  let { errors }: ContactFormProps = $props();

  const form = useForm({ email: '', name: '' });

  const submit = (event: SubmitEvent): void => {
    event.preventDefault();
    form.post('/inertia-svelte/form');
  };
</script>

<main>
  <h1>New contact</h1>
  <form onsubmit={submit}>
    <label>Name <input name="name" bind:value={form.name} /></label>
    {#if errors.name}
      <p>{errors.name}</p>
    {/if}
    <label>Email <input name="email" type="email" bind:value={form.email} /></label>
    {#if errors.email}
      <p>{errors.email}</p>
    {/if}
    <button type="submit" disabled={form.processing}>Save</button>
  </form>
  <Link href="/inertia-svelte">Back</Link>
</main>
