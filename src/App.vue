<template>
  <div>
    <Gif :src="SRCS[0]" />
  </div>
</template>
<script lang="ts" setup>
import Gif from '@/components/Gif/Gif.vue'
import { GIFS, SRCS, PNGS } from './metaData'
</script>
