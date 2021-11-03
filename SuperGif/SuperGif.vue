<template>
  <div class="SuperGif">
    <img :src="gif" :rel:animated_src="gif" width="360" height="360" rel:auto_play="1" rel:rubbable="1" id="cloneImg" />
    <img
      src="http://img.soogif.com/l0N5XEZ3ERT3wFOOzlmqRdnE9livVY6G.gif"
      rel:animated_src="http://img.soogif.com/l0N5XEZ3ERT3wFOOzlmqRdnE9livVY6G.gif"
      width="360"
      height="360"
      rel:auto_play="1"
      rel:rubbable="1"
      id="gifImg"
    />
  </div>
</template>
<script lang="ts">
import { defineComponent } from "vue";
import CloneSuperGif from "./super_gif"; // 分解gif
import SuperGif from "libgif"; // 分解gif
import { IMGS, GIFS } from "@/utils/net_imgs";
export default defineComponent({
  data() {
    return {
      rub: null as null | SuperGif,
      clone: null as null | CloneSuperGif,
    };
  },
  computed: {
    gif() {
      return GIFS[0];
    },
  },
  methods: {
    onLoad() {
      this.initSuperGif();
    },
    initSuperGif() {
      const gifImg = document.getElementById("gifImg");
      if (gifImg instanceof HTMLImageElement && /.*\.gif/.test(gifImg.src)) {
        const rub = new SuperGif({ gif: gifImg });
        console.log(rub);
        this.rub = rub;
        window.rub = rub;
        
        rub.load(() => {
          console.log("rub", rub);
          // rub.pause();
          // rub.move_to(0);
        });
      }
    },
    initCloneSuperGif() {
      const cloneImg = document.getElementById("cloneImg");
      if (cloneImg instanceof HTMLImageElement && /.*\.gif/.test(cloneImg.src)) {
        const clone = new CloneSuperGif({ gif: cloneImg });
        this.clone = clone;
        window.clone = clone
        clone.load(() => {
          console.log("clone", clone);
        });
      }
    },
  },
  mounted() {
    // this.initSuperGif();
    this.initCloneSuperGif();
  },
});
</script>
<style scoped></style>
