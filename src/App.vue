<template>
  <div>
    <Player :src="src"/>
  </div>
</template>
<script setup lang="ts">
import Player from './Player.vue'
import { IMGS, GIFS } from './net_imgs'
const src = GIFS[1]
</script>
<style></style>
