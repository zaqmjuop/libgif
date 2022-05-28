<template>
  <div>
    <GIF :src="src" />
    <hr />
  </div>
</template>
<script lang="ts" setup>
import GIF from '@/components/Gif.vue'
import { SRCS } from './metaData';
const src = SRCS[0]
</script>
