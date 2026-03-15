<script setup lang="ts">
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()
</script>
<template>
  <router-view :key="profileStore.theme" />
</template>
