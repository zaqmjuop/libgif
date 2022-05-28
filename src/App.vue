<template>
  <div>
    <Gif :src="src" />
    <hr />
    <img
      :src="src"
      :rel:animated_src="src"
      width="360"
      height="360"
      rel:auto_play="1"
      rel:rubbable="1"
      ref="img"
    />
  </div>
</template>
<script lang="ts" setup>
import Gif from '@/components/Gif/Gif.vue'
import { GIFS, SRCS } from './metaData'
import libgif from '@/lib/libgif/libgif'
import { onMounted, ref } from 'vue'
const src = GIFS[3]
const img = ref<HTMLImageElement | null>(null)
onMounted(() => {
  const rub = libgif({ gif: img.value })
  rub.load(() => {})
})
</script>
