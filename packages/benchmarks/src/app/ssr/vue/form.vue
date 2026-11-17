<script setup lang="ts">
import { Link, useForm } from '@inertiajs/vue3';

import type { ContactFormProps } from '../../contacts';

defineProps<ContactFormProps>();

const form = useForm({ email: '', name: '' });

const submit = (): void => {
  form.post('/inertia-vue/form');
};
</script>

<template>
  <main>
    <h1>New contact</h1>
    <form @submit.prevent="submit">
      <label>Name <input v-model="form.name" name="name" /></label>
      <p v-if="errors.name">{{ errors.name }}</p>
      <label>Email <input v-model="form.email" name="email" type="email" /></label>
      <p v-if="errors.email">{{ errors.email }}</p>
      <button type="submit" :disabled="form.processing">Save</button>
    </form>
    <Link href="/inertia-vue">Back</Link>
  </main>
</template>
