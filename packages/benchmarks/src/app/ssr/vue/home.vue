<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

import type { ContactHomeProps } from '../../contacts';

defineProps<ContactHomeProps>();
</script>

<template>
  <main>
    <h1>Contacts</h1>
    <p v-if="flash" role="status">{{ flash.success }}</p>
    <ul>
      <li v-for="contact in contacts" :key="contact.id">
        {{ contact.name }} &lt;{{ contact.email }}&gt;
      </li>
    </ul>
    <Link href="/inertia-vue/form">New contact</Link>
  </main>
</template>
