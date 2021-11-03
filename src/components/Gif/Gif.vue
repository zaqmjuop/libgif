<template>
  <div style="height: 400px">
    <span>{{ state.loaded }} / {{ state.total }}</span>
    <canvas :width="state.width" :height="state.height" ref="canvas"></canvas>
  </div>
</template>
<script lang="ts" setup>
import { defineProps, reactive, onBeforeMount, onMounted, ref } from 'vue'
import { download } from './download'
import { Stream } from '@/lib/libgif/Stream'
import { GifFrame, GifParser } from './gifParser'
import { Player } from './player'

const prop = defineProps({
  src: {
    type: String
  }
})
const defaultState = () => ({
  total: 0,
  loaded: 0,
  width: 0,
  height: 0
})
const state = reactive(defaultState())
const canvas = ref<HTMLCanvasElement | null>(null)

window.s = state

onMounted(async () => {
  const { src } = prop
  if (!src) {
    return
  }
  const res = await download(src, {
    onprogress: (e) => {
      if (e.lengthComputable) {
        state.loaded = e.loaded
        state.total = e.total
      }
    }
  })
  const st = new Stream(res)
  const parser = await GifParser.of(st)
  if (parser.header) {
    state.width = parser.header.width
    state.height = parser.header.height
  }
  const el = canvas.value
  if (el instanceof HTMLCanvasElement && parser) {
    const player = new Player(el, parser.frames)
    player.play()
    console.log(player)
  }
})
</script>
<style lang="scss" scoped></style>
