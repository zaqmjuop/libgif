<template>
  <div>
    <Gif :src="PNGS[2]" />
  </div>
</template>
<script lang="ts" setup>
import Gif from '@/components/Gif/Gif.vue'
import { GIFS, SRCS, PNGS } from './metaData'
</script>
