<template>
  <img
    :src="src"
    :rel:animated_src="src"
    width="300"
    height="300"
    rel:auto_play="1"
    rel:rubbable="1"
    ref="img"
  />
</template>
<script lang="ts" setup>
import { defineProps, reactive, onMounted, ref } from 'vue'
import supergif from '@/lib/supergif/supergif'

const prop = defineProps({
  src: {
    type: String
  }
})
const rub = ref<ReturnType<typeof supergif> | null>(null)
const img = ref<HTMLImageElement | null>(null)
onMounted(() => {
  if (img.value) {
    rub.value = supergif({ gif: img.value })
    rub.value.load(() => {})
    console.log({ rub })
  }
})
</script>
<style lang="scss" scoped></style>
