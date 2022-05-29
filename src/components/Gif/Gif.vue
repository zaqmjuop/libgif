<template>
  <img
    :src="src"
    :rel:animated_src="src"
    width="360"
    height="360"
    rel:auto_play="1"
    rel:rubbable="1"
    ref="img"
  />
</template>
<script lang="ts" setup>
import { defineProps, reactive, onMounted, ref } from 'vue'
import libgif2 from '@/lib/libgif/libgif2'
import { download } from './download'
import { Stream } from '@/lib/libgif/Stream'
import { GifFrame, GifParser } from './gifParser'
import { Player } from './player'

const prop = defineProps({
  src: {
    type: String
  }
})
const rub = ref<ReturnType<typeof libgif2> | null>(null)
const img = ref<HTMLImageElement | null>(null)
onMounted(() => {
  rub.value = libgif2({ gif: img.value })
  rub.value.load(() => {})
  console.log({rub})
})
</script>
<style lang="scss" scoped></style>
