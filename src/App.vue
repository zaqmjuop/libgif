<template>
  <div>
    <Gif :src="src" v-for="src in GIFS" :key="src"/>
  </div>
</template>
<script lang="ts" setup>
import Gif from '@/components/Gif/Gif.vue'
import { GIFS,  PNGS } from './metaData'
</script>
