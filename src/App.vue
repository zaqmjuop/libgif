<template>
  <div>
    <Gif :src="src" v-for="src in [GIFS[1]]" :key="src"/>
  </div>
</template>
<script lang="ts" setup>
import Gif from '@/Gif.vue'
import { GIFS,  PNGS } from './metaData'
</script>
