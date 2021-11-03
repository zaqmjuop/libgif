<template>
  <div>
    <Gif :src="src" />
    <hr />
    <img
      src="@/assets/coug3.gif"
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
import { SuperGif } from '@/lib/libgif/SuperGif'
import Gif from '@/components/Gif/Gif.vue'
import coug3 from '@/assets/coug3.gif'
const SRCS = Object.freeze([
  '@/assets/coug3.gif',
  'https://img.zcool.cn/community/01584659ccc891a801218e18e4097e.gif',
  'https://img.zcool.cn/community/0197d259ccc891a8012053f8cb26e3.gif'
] as const)
const container = ref<null | HTMLImageElement>(null)
const src = SRCS[0]
let rub: ReturnType<typeof SuperGif>
onMounted(async () => {
  if (container.value instanceof HTMLImageElement) {
    // rub = SuperGif({ gif: container.value })
    // rub.load()
  }
})
</script>
