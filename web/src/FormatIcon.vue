<script setup lang="ts">
defineProps<{name:'heading'|'bold'|'ordered'|'bullet'|'checklist'}>()
</script>
<template>
 <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path v-if="name==='heading'" d="M4 8V5h16v3M12 5v14M8 19h8"/>
  <template v-else-if="name==='bold'"><path d="M7 12h7a4 4 0 0 1 0 8H7V4h6a4 4 0 0 1 0 8"/></template>
  <template v-else-if="name==='ordered'"><path d="M10 6h10M10 12h10M10 18h10M3 4h1v5M2.5 9h3M2.5 15a1.5 1.5 0 1 1 3 0c0 1-3 2-3 4h3"/></template>
  <template v-else-if="name==='bullet'"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></template>
  <template v-else><path d="m3 6 2 2 3-4M11 6h9m-17 6 2 2 3-4M11 12h9m-17 6 2 2 3-4M11 18h9"/></template>
 </svg>
</template>
