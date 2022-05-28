<template>
  <div>
    <hr />
    <img
      :src="src"
      :rel:animated_src="src"
      width="360"
      height="360"
      rel:auto_play="1"
      rel:rubbable="1"
      ref="container"
    />
  </div>
</template>
<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import libgif from '@/lib/libgif/libgif'
import coug3 from '@/assets/coug3.gif'
const SRCS = Object.freeze([
  coug3,
  'https://img.zcool.cn/community/01584659ccc891a801218e18e4097e.gif',
  'https://img.zcool.cn/community/0197d259ccc891a8012053f8cb26e3.gif'
] as const)
const container = ref<null | HTMLImageElement>(null)
const src = SRCS[0]
let rub: any
onMounted(async () => {
  if (container.value instanceof HTMLImageElement) {
    rub = libgif({ gif: container.value })
    rub.load()
  }
})
</script>
