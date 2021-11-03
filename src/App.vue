<template>
  <div>
    <!-- <p>{{ responseData ? responseData.byteLength : 0 }}</p> -->
    <img :src="src" alt="" />
    <!-- <canvas ref="canvas" @load="initCanvas"></canvas> -->
  </div>
</template>
<script setup lang="ts">
import { IMGS, GIFS } from './net_imgs'
const src = GIFS[1]
</script>
<style></style>
