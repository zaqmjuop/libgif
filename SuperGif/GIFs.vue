<template>
  <div>
    <p>{{ responseData ? responseData.byteLength : 0 }}</p>
    <img :src="src" alt="" />
    <canvas ref="canvas" @load="initCanvas"></canvas>
  </div>
</template>
<script lang="ts">
import axios from "axios";
import {
  defineComponent,
  ref,
  reactive,
  onBeforeMount,
  Ref,
  onMounted,
  watch,
} from "vue";
import { IMGS, GIFS } from "@/utils/net_imgs";
import { GIFFrame, GIFParser } from "./reader";
export default defineComponent({
  setup() {
    const src = ref(GIFS[0]);
    const img = document.createElement('img');
    img.src = src.value;
    img.onload = () => {
      img.setAttribute('loadedTime', Date.now().toString());
    }
    img.decode().then(() => {
      const loadedTime = img.getAttribute('loadedTime');
      if(loadedTime){
        console.log(`浏览器解析用时${Date.now() - parseInt(loadedTime)}`)
      }
    })
    const canvas = ref(null as null | HTMLCanvasElement);
    const ctx = ref(null as CanvasRenderingContext2D | null);
    const playing = ref(false);
    const playingIndex = ref(-1);
    const header = reactive({});
    const responseData = ref("" as string | ArrayBuffer);
    const parser = ref(null as null | GIFParser);
    const frameStep = () => {
      if (!playing.value) return;
      if (!ctx.value) throw new ReferenceError("没有ctx");
      if (!parser.value) throw new ReferenceError("没有parser");
      const nextPlayIndex = parser.value.frames.hasOwnProperty(
        playingIndex.value + 1
      )
        ? playingIndex.value + 1
        : 0;
      const frame = parser.value.frames[nextPlayIndex];
      ctx.value.putImageData(frame.data, frame.left, frame.top);
      playingIndex.value = nextPlayIndex;
      setTimeout(() => frameStep(), frame.delay);
    };
    const pause = () => {
      playing.value = false;
    };
    const play = () => {
      if (!canvas.value) {
        throw new ReferenceError("没有canvas");
      }
      if (!ctx.value) {
        ctx.value = canvas.value.getContext("2d");
      }
      playing.value = true;
    };
    watch(playing, () => {
      if (playing.value) {
        frameStep();
      }
    });
    const initCanvas = () => {
      if (canvas.value) {
        ctx.value = ctx.value ? ctx.value : canvas.value.getContext("2d");
      }
    };
    const onParsed = (event: GIFParser) => {
      parser.value = event;
      console.log("onParsed", event);
      if (canvas.value) {
        canvas.value.setAttribute("width", event.header.width.toString());
        canvas.value.setAttribute("height", event.header.height.toString());
        play();
      }
    };
    const load_url = async (url: string) => {
      try {
        const res = await axios.get(url, {
          responseType: "arraybuffer",
          onDownloadProgress: (e: ProgressEvent<XMLHttpRequest>) => {
            console.log("onprogress", ((e.loaded / e.total) * 100).toFixed(2));
          },
        });
        responseData.value = res.data;
        new GIFParser(res.data as ArrayBuffer, { onParsed });
      } catch (error) {
        console.log("onerror", error);
      }
    };

    onBeforeMount(() => {
      load_url(src.value);
    });
    onMounted(() => {});
    return {
      src,
      canvas,
      header,
      load_url,
      responseData,
    };
  },
});
</script>
<style lang="scss" scoped>
</style>