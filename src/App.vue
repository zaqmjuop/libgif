<template>
  <div>
    <Gif :src="src" />
  </div>
</template>
<script lang="ts" setup>
import Gif from '@/components/Gif/Gif.vue'
import { GIFS, SRCS } from './metaData'
const src = GIFS[3]
</script>
