/**
 * 变量提升
 * const fc1(){ fc2(); }
 * const fc2(){ console.log('fc2') }
 * fc1(); // 'fc2'
 */
import Stream from "./stream";
import { offset, header, opts, RGB } from "./type";
import { drawError } from "./helper";
import parseGIF from "./parseGIF";
import $ from "jquery";
class SuperGif {
  //viewport position
  vp_l: number = 0;
  vp_t: number = 0;
  vp_w: number = 0;
  vp_h: number = 0;
  //canvas sizes
  c_w: number = 0;
  c_h: number = 0;
  is_vp: boolean;
  gif: HTMLImageElement;
  auto_play: boolean;
  on_end?: Function;
  loop_delay: number = 0;
  loop = true;
  draw_while_loading: boolean = true;
  show_progress_bar: boolean;
  progressbar_height: number = 25;
  progressbar_background_color: string;
  progressbar_foreground_color: string;
  max_width?: number;
  loadError: string = "";
  playing: boolean = true;
  loading: boolean = false;
  forward: boolean = true;
  ctx_scaled: boolean = false;
  stream?: Stream;
  transparency: number | null = null;
  hdr?: {
    width: number;
    height: number;
    gct?: number[][];
  };
  delay: number = 0;
  initialized: boolean = false;
  disposalMethod: number = 0;
  disposalRestoreFromIdx: number | null = null;
  lastDisposalMethod: number = 0;
  frame: CanvasRenderingContext2D | null = null;
  lastImg: null | {
    width: number;
    height: number;
    leftPos: number;
    topPos: number;
  } = null;
  frames: { data: ImageData; delay: number }[] = [];
  frameOffsets: offset[] = [];
  canvas: HTMLCanvasElement | undefined;
  ctx: CanvasRenderingContext2D | null = null;
  toolbar?: HTMLDivElement;
  tmpCanvas: HTMLCanvasElement = document.createElement("canvas");
  load_callback?: Function;
  handler: header;
  i = -1;
  iterationCount = 0;
  constructor(opts: opts) {
    this.vp_l = opts.vp_l || 0;
    this.vp_t = opts.vp_t || 0;
    this.vp_w = opts.vp_w || 0;
    this.vp_h = opts.vp_h || 0;
    this.c_w = opts.c_w || 0;
    this.c_h = opts.c_h || 0;
    this.is_vp = !!(this.vp_w && this.vp_h);
    this.gif = opts.gif;
    this.auto_play = opts.auto_play !== false;
    this.on_end = opts.on_end;
    this.loop_delay = opts.loop_delay || 0;
    this.loop = opts.loop !== false;
    this.draw_while_loading = opts.draw_while_loading !== false;
    this.show_progress_bar = this.draw_while_loading && opts.show_progress_bar !== false;
    this.progressbar_height = typeof opts.progressbar_height === "number" ? opts.progressbar_height : 25;
    this.progressbar_background_color = opts.progressbar_background_color || "rgba(255,255,255,0.4)";
    this.progressbar_foreground_color = opts.progressbar_foreground_color || "rgba(255,0,22,.8)";
    this.max_width = opts.max_width;
    this.handler = {
      hdr: this.withProgress(this.onHdr.bind(this)),
      gce: this.withProgress(this.onGCE.bind(this)),
      com: this.withProgress(this.onNothing.bind(this)),
      // I guess that's all for now.
      app: {
        // TODO: Is there much point in actually supporting iterations?
        NETSCAPE: this.withProgress(this.onNothing.bind(this)),
      },
      img: this.withProgress(this.onImg.bind(this), true),
      eof: this.onEof.bind(this),
    };
  }

  initPlayer() {
    if (this.loadError) return;
    if (!(this.c_w && this.c_h)) {
      this.ctx?.scale(this.get_canvas_scale(), this.get_canvas_scale());
    }
    if (this.auto_play) {
      this.step();
    } else {
      this.i = 0;
      this.putFrame();
    }
  }
  load_raw(arr, callback) {
    if (!this.load_setup(callback)) return;
    if (!this.initialized) this.init();
    this.stream = new Stream(arr);
    setTimeout(() => this.parse());
  }
  // play controls
  play() {
    this.playing = true;
    this.step();
  }
  pause() {
    this.playing = false;
  }
  putFrame() {
    typeof this.i === "string" && (this.i = parseInt(this.i, 10));
    if (this.i > this.frames.length - 1 || this.i < 0) {
      this.i = 0;
    }
    const offset = this.frameOffsets[this.i];
    this.tmpCanvas.getContext("2d")?.putImageData(this.frames[this.i].data, offset.x, offset.y);
    if (this.ctx) {
      this.ctx.globalCompositeOperation = "copy";
      this.ctx.drawImage(this.tmpCanvas, 0, 0);
    }
  }
  /**
   * @returns {number} Gets the index of the frame "up next".
   */
  getNextFrameNo(): number {
    const delta = this.forward ? 1 : -1;
    return (this.i + delta + this.frames.length) % this.frames.length;
  }
  completeLoop() {
    this.on_end && this.on_end(this.gif);
    this.iterationCount++;
    this.loop ? this.doStep() : this.pause();
  }
  doStep() {
    const that = this;
    if (!this.playing) return;
    that.moveBy(1);
    let delay = this.frames[this.i].delay * 10;
    if (!delay) delay = 100; // FIXME: Should this even default at all? What should it be?

    const nextFrameNo = that.getNextFrameNo();
    if (nextFrameNo === 0) {
      delay += this.loop_delay;
      setTimeout(() => that.completeLoop(), delay);
    } else {
      setTimeout(() => that.doStep(), delay);
    }
  }
  step() {
    if (!this.playing) return;
    setTimeout(() => this.doStep());
  }
  moveBy(by: number) {
    this.i += by;
    this.putFrame();
  }
  move_to(frame_idx: number) {
    this.i = frame_idx;
    this.putFrame();
  }
  load(callback: Function) {
    this.load_url(this.gif.getAttribute("rel:animated_src") || this.gif.src, callback);
  }

  doText(text: string) {
    if (this.toolbar) {
      this.toolbar.innerHTML = text; // innerText? Escaping? Whatever.
      this.toolbar.style.visibility = "visible";
    }
  }
  // XXX: There's probably a better way to handle catching exceptions when
  // callbacks are involved.
  parse() {
    try {
      this.stream && parseGIF(this.stream, this.handler);
    } catch (err) {
      this.onLoadError("parse");
    }
  }
  onLoadError(originOfError: string) {
    this.loadError = originOfError;
    console.error("onLoadError");
    this.hdr = {
      width: this.gif.width,
      height: this.gif.height,
    }; // Fake header.
    this.frames = [];
    this.canvas && drawError(this.canvas);
  }
  onEof() {
    console.log("onEof");
    //toolbar.style.display = '';
    this.pushFrame();
    this.doDecodeProgress(false);
    if (!(this.c_w && this.c_h) && this.hdr && this.canvas) {
      this.canvas.width = this.hdr.width * this.get_canvas_scale();
      this.canvas.height = this.hdr.height * this.get_canvas_scale();
    }
    this.initPlayer();
    this.loading = false;
    this.load_callback && this.load_callback(this.gif);
  }
  get_canvas_scale(): number {
    return this.max_width && this.hdr && this.hdr.width > this.max_width ? this.max_width / this.hdr.width : 1;
  }
  setSizes(w: number, h: number) {
    const scale = this.get_canvas_scale();
    if (this.canvas) {
      this.canvas.width = w * scale;
      this.canvas.height = h * scale;
    }
    this.toolbar && (this.toolbar.style.minWidth = w * scale + "px");
    this.tmpCanvas.width = w;
    this.tmpCanvas.height = h;
    this.tmpCanvas.style.width = w + "px";
    this.tmpCanvas.style.height = h + "px";
    this.tmpCanvas.getContext("2d")?.setTransform(1, 0, 0, 1, 0, 0);
  }
  set_frame_offset(frame: number, offset: offset) {
    const { x, y } = offset;
    this.frameOffsets[frame] = { x, y };
  }

  pushFrame() {
    if (!this.frame) return;
    const { width, height } = this.hdr ? this.hdr : { width: 0, height: 0 };
    this.frames.push({
      data: this.frame.getImageData(0, 0, width, height),
      delay: this.delay,
    });
    this.frameOffsets.push({ x: 0, y: 0 });
  }

  doShowProgress(pos: number, length: number, draw: boolean) {
    if (!draw || !this.show_progress_bar || !this.canvas || !this.ctx) return;
    const scale = this.ctx_scaled ? this.get_canvas_scale() : 1;
    const width = this.canvas.width / scale;
    const height = this.progressbar_height / scale;
    const left = this.vp_l / scale;
    const top = ((this.is_vp ? this.vp_h : this.canvas.height) + this.vp_t - this.progressbar_height) / scale;
    const mid = left + ((pos / length) * (this.is_vp ? this.vp_w : this.canvas.width)) / scale;
    this.ctx.fillStyle = this.progressbar_background_color;
    this.ctx.fillRect(mid, top, width - mid, height);
    this.ctx.fillStyle = this.progressbar_foreground_color;
    this.ctx.fillRect(0, top, mid, height);
  }
  onHdr(_hdr: { width: number; height: number; gct?: number[][] }) {
    console.log("onHdr", ...arguments);
    this.hdr = _hdr;
    this.setSizes(this.hdr.width, this.hdr.height);
  }
  onGCE({
    delayTime,
    disposalMethod,
    transparencyGiven,
    transparencyIndex,
  }: {
    delayTime: number;
    disposalMethod: number;
    transparencyGiven: boolean;
    transparencyIndex: number;
  }) {
    console.log("onGCE", ...arguments);
    this.pushFrame(); // err
    this.clear();
    this.transparency = transparencyGiven ? transparencyIndex : null;
    this.delay = delayTime || 0;
    this.disposalMethod = disposalMethod || 0;
    // We don't have much to do with the rest of GCE.
  }
  onImg(img: {
    leftPos: number;
    topPos: number;
    width: number;
    height: number;
    pixels: number[];
    interlaced: boolean;
    lctFlag: boolean;
    lct?: number[][];
  }) {
    console.log("onImg", ...arguments);
    if (!this.frame) this.frame = this.tmpCanvas.getContext("2d");
    const currIdx = this.frames.length;

    //gct = global color table
    let ct: number[][] = [];
    if (img.lctFlag && img.lct) {
      ct = img.lct;
    } else if (this.hdr && this.hdr.gct) {
      ct = this.hdr.gct;
    } // TODO: What if neither exists?
    /*
    Disposal method indicates the way in which the graphic is to
    be treated after being displayed.

    Values :    0 - No disposal specified. The decoder is
                    not required to take any action.
                1 - Do not dispose. The graphic is to be left
                    in place.
                2 - Restore to background color. The area used by the
                    graphic must be restored to the background color.
                3 - Restore to previous. The decoder is required to
                    restore the area overwritten by the graphic with
                    what was there prior to rendering the graphic.

                    Importantly, "previous" means the frame state
                    after the last disposal of method 0, 1, or 2.
    */
    if (currIdx > 0 && this.frame) {
      if (this.lastDisposalMethod === 3) {
        // Restore to previous
        // If we disposed every frame including first frame up to this point, then we have
        // no composited frame to restore to. In this case, restore to background instead.
        if (this.disposalRestoreFromIdx !== null) {
          this.frame.putImageData(this.frames[this.disposalRestoreFromIdx].data, 0, 0);
        } else {
          this.lastImg &&
            this.frame.clearRect(this.lastImg.leftPos, this.lastImg.topPos, this.lastImg.width, this.lastImg.height);
        }
      } else {
        this.disposalRestoreFromIdx = currIdx - 1;
      }
      if (this.lastDisposalMethod === 2) {
        // Restore to background color
        // Browser implementations historically restore to transparent; we do the same.
        // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
        this.lastImg &&
          this.frame.clearRect(this.lastImg.leftPos, this.lastImg.topPos, this.lastImg.width, this.lastImg.height);
      }
    }
    // else, Undefined/Do not dispose.
    // frame contains final pixel data from the last frame; do nothing

    //Get existing pixels for img region after applying disposal method
    if (this.frame) {
      const imgData = this.frame.getImageData(img.leftPos, img.topPos, img.width, img.height);
      console.warn('1', imgData, img.lctFlag, !!img.lct, ct.length)
      img.lctFlag && console.error(img.lctFlag, img.lct?.length)
      //apply color table colors
      img.pixels.forEach((pixel: number, i: number) => {
        // imgData.data === [R,G,B,A,R,G,B,A,...]
        if (pixel !== this.transparency) {
          imgData.data[i * 4 + 0] = ct[pixel][0];
          imgData.data[i * 4 + 1] = ct[pixel][1];
          imgData.data[i * 4 + 2] = ct[pixel][2];
          imgData.data[i * 4 + 3] = 255; // Opaque.
        }
      });

      this.frame.putImageData(imgData, img.leftPos, img.topPos);
    }
    if (this.ctx) {
      if (!this.ctx_scaled) {
        this.ctx.scale(this.get_canvas_scale(), this.get_canvas_scale());
        this.ctx_scaled = true;
      }

      // We could use the on-page canvas directly, except that we draw a progress
      // bar for each image chunk (not just the final image).
      if (this.draw_while_loading) {
        this.ctx.drawImage(this.tmpCanvas, 0, 0);
        this.draw_while_loading = this.auto_play;
      }
    }
    this.lastImg = img;
  }
  doDecodeProgress(draw: boolean) {
    this.stream && this.doShowProgress(this.stream.index, this.stream.data.length, draw);
  }
  onNothing() {
    console.log("onNothing");
  }
  withProgress(fn: Function, progressSeen = false) {
    return (...args) => {
      fn(...args);
      this.doDecodeProgress(progressSeen);
    };
  }
  init() {
    const parent = this.gif.parentNode;
    if (parent) {
      const { width, height } = this.gif;
      this.tmpCanvas = $("<canvas />")[0] as HTMLCanvasElement;
      this.canvas = $(`<canvas width="${width}" height="${height}" />`)[0] as HTMLCanvasElement;
      this.ctx = this.canvas.getContext("2d");
      this.toolbar = $(`<div style="min-width:${width}px;" class="jsgif_toolbar"></div>`)[0] as HTMLDivElement;
      const div = $(`<div style="width:${width}px;height:${height};" class="jsgif" />`)[0] as HTMLDivElement;
      $(div)
        .append(this.canvas)
        .append(this.toolbar);
      parent.insertBefore(div, this.gif);
      parent.removeChild(this.gif);
    }
    if (this.c_w && this.c_h) this.setSizes(this.c_w, this.c_h);
    this.initialized = true;
  }
  load_setup(callback?: Function) {
    if (this.loading) return false;
    this.load_callback = callback;
    this.loading = true;
    this.frames = [];
    this.clear();
    this.disposalRestoreFromIdx = null;
    this.lastDisposalMethod = 0;
    this.frame = null;
    this.lastImg = null;
    return true;
  }
  calculateDuration() {
    return this.frames.reduce((duration, frame) => duration + frame.delay, 0);
  }
  load_url(src: string, callback: Function) {
    const that = this;
    if (!this.load_setup(callback)) return;
    const h = new XMLHttpRequest();
    h.open("GET", src, true);
    if ("overrideMimeType" in h) {
      h.overrideMimeType("text/plain; charset=x-user-defined");
    }
    h.onloadstart = () => !that.initialized && that.init();
    h.onload = (e) => {
      if (h.status != 200) {
        that.onLoadError("xhr - response");
      }
      let data = h.response;
      if (data.toString().indexOf("ArrayBuffer") > 0) {
        data = new Uint8Array(data);
      }
      that.stream = new Stream(data);
      setTimeout(() => that.parse());
    };
    h.onprogress = (e) =>{
      
      console.log(h.response)
      ; e.lengthComputable && that.doShowProgress(e.loaded, e.total, true)};
    h.onerror = () => that.onLoadError("xhr");
    h.send();
  }
  clear() {
    this.transparency = null;
    this.delay = 0;
    this.lastDisposalMethod = this.disposalMethod;
    this.disposalMethod = 0;
    this.frame = null;
  }
}
export default SuperGif;
// new browsers (XMLHttpRequest2-compliant)
// IE9 (Microsoft.XMLHTTP-compliant)
// if ("setRequestHeader" in h) {
//   h.setRequestHeader("Accept-Charset", "x-user-defined");
// }
// old browsers (XMLHttpRequest-compliant)
// if ("responseType" in h) {
//   h.responseType = "arraybuffer";
// }
// emulating response field for IE9
// if (!("response" in h)) {
// this.response = new VBArray(this.responseText)
//   .toArray()
//   .map(String.fromCharCode)
//   .join("");
// }
