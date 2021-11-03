<template>
  <div class="card" :style="{ backgroundImage: prop.backgroundImage }"></div>
  <img :src="prop.backgroundImage" alt="">
</template>
<script lang="ts" setup>
import { defineProps } from 'vue'
const prop = defineProps({
  backgroundImage: {
    type: String
  }
})
</script>
<style lang="scss" scoped>
.card {
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  width: 200px;
  height: 200px;
  display: inline-block;
}
</style>
