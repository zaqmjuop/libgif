import { parseGIF } from './parseGIF'
import { Player } from './player'
import { Stream } from './stream'
import { Hander, Options, VP } from './type'
import { Viewer } from './viewer'

const SuperGif = (opts: Options & Partial<VP>) => {
  const options: Options & VP = Object.assign(
    {
      //viewport position
      vp_l: 0,
      vp_t: 0,
      vp_w: 0,
      vp_h: 0,
      //canvas sizes
      c_w: 0,
      c_h: 0
    },
    opts
  )
  for (let i in opts) {
    options[i] = opts[i]
  }
  if (options.vp_w && options.vp_h) options.is_vp = true

  let stream: Stream
  let hdr

  let loadError: string | null = null
  let loading = false

  let transparency: number | null = null
  let delay: null | number = null
  let disposalMethod: null | number = null
  let disposalRestoreFromIdx: number | null = null
  let lastDisposalMethod: number | null = null
  let frame: CanvasRenderingContext2D | null = null
  let lastImg: {
    leftPos: number
    topPos: number
    width: number
    height: number
  } | null = null

  let ctx_scaled = false

  let frames: {
    data: ImageData
    delay: number | null
  }[] = []
  let frameOffsets: { x: number; y: number }[] = [] // elements have .x and .y properties

  const gif = options.gif
  if (typeof options.auto_play == 'undefined')
    options.auto_play =
      !gif.getAttribute('rel:auto_play') ||
      gif.getAttribute('rel:auto_play') == '1'

  const onEndListener =
    typeof options.on_end === 'function' ? options.on_end : null
  const loopDelay =
    typeof options.loop_delay === 'number' ? options.loop_delay : 0
  const overrideLoopMode =
    typeof options.loop_mode === 'boolean' ? options.loop_mode : 'auto'
  let drawWhileLoading = options.hasOwnProperty('draw_while_loading')
    ? options.draw_while_loading
    : true
  const showProgressBar = !!(drawWhileLoading
    ? options.hasOwnProperty('show_progress_bar')
      ? options.show_progress_bar
      : true
    : false)
  const progressBarHeight =
    typeof options.progressbar_height === 'number'
      ? options.progressbar_height
      : 25
  const progressBarBackgroundColor = options.hasOwnProperty(
    'progressbar_background_color'
  )
    ? options.progressbar_background_color || ''
    : 'rgba(255,255,255,0.4)'
  const progressBarForegroundColor = options.hasOwnProperty(
    'progressbar_foreground_color'
  )
    ? options.progressbar_foreground_color || ''
    : 'rgba(255,0,22,.8)'

  // global func
  const clear = () => {
    transparency = null
    delay = null
    lastDisposalMethod = disposalMethod
    disposalMethod = null
    frame = null
  }
  const get_canvas_scale = () => {
    let scale
    if (options.max_width && hdr && hdr.width > options.max_width) {
      scale = options.max_width / hdr.width
    } else {
      scale = 1
    }
    return scale
  }
  const setFrameOffset = (frame, offset) => {
    if (!frameOffsets[frame]) {
      frameOffsets[frame] = offset
      return
    }
    if (typeof offset.x !== 'undefined') {
      frameOffsets[frame].x = offset.x
    }
    if (typeof offset.y !== 'undefined') {
      frameOffsets[frame].y = offset.y
    }
  }
  // global func
  // canvas
  const viewer = new Viewer({
    get_canvas_scale,
    showProgressBar,
    progressBarHeight,
    progressBarBackgroundColor,
    progressBarForegroundColor,
    ctx_scaled,
    is_vp: !!options.is_vp,
    vp_t: options.vp_t,
    vp_h: options.vp_h,
    vp_l: options.vp_l,
    vp_w: options.vp_w,
    c_w: options.c_w,
    c_h: options.c_h,
    hdr: hdr,
    loadError,
    gif: options.gif,
    frames
  })
  const canvas = viewer.canvas
  const ctx = viewer.ctx

  const tmpCanvas = viewer.tmpCanvas
  let load_callback: (gif: HTMLImageElement) => void | undefined
  // canvas

  const load_setup = (callback?: (gif: HTMLImageElement) => void) => {
    if (loading) {
      return false
    }
    load_callback = callback || load_callback

    loading = true
    frames = []
    clear()
    disposalRestoreFromIdx = null
    lastDisposalMethod = null
    frame = null
    lastImg = null

    return true
  }
  // player
  const player = new Player({
    get frames() {
      return frames
    },
    get gif() {
      return gif
    },
    get onEndListener() {
      return onEndListener
    },
    get overrideLoopMode() {
      return overrideLoopMode
    },
    get loopDelay() {
      return loopDelay
    },
    get auto_play() {
      return options.auto_play
    },
    get loadError() {
      return loadError
    },
    get c_w() {
      return options.c_w
    },
    get c_h() {
      return options.c_h
    },
    get get_canvas_scale() {
      return get_canvas_scale
    },
    get frameOffsets() {
      return frameOffsets
    },
    get tmpCanvas() {
      return tmpCanvas
    },
    get ctx() {
      return ctx
    }
  })
  // player
  // hander
  const doDecodeProgress = (draw: boolean) => {
    viewer.doShowProgress(stream.pos, stream.data.length, draw)
  }
  /**
   * @param{boolean=} draw Whether to draw progress bar or not; this is not idempotent because of translucency.
   *                       Note that this means that the text will be unsynchronized with the progress bar on non-frames;
   *                       but those are typically so small (GCE etc.) that it doesn't really matter. TODO: Do this properly.
   */
  const withProgress =
    (fn: Function, draw = false) =>
    (block) => {
      fn(block)
      doDecodeProgress(draw)
    }
  const pushFrame = () => {
    if (!frame) return
    frames.push({
      data: frame.getImageData(0, 0, hdr.width, hdr.height),
      delay: delay
    })
    frameOffsets.push({ x: 0, y: 0 })
  }
  const doHdr: Hander['hdr'] = (_hdr) => {
    hdr = _hdr
    viewer.setSizes(hdr.width, hdr.height)
  }
  const doGCE: Hander['gce'] = (gce) => {
    pushFrame()
    clear()
    transparency = gce.transparencyGiven ? gce.transparencyIndex : null
    delay = gce.delayTime
    disposalMethod = gce.disposalMethod
    // We don't have much to do with the rest of GCE.
  }
  const doNothing = () => {}

  const doImg: Hander['img'] = (img) => {
    if (!frame && tmpCanvas) {
      frame = tmpCanvas.getContext('2d')
    }

    let currIdx = frames.length

    //ct = color table, gct = global color table
    let ct = img.lctFlag ? img.lct : hdr.gct // TODO: What if neither exists?

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
    if (currIdx > 0) {
      if (lastDisposalMethod === 3) {
        // Restore to previous
        // If we disposed every frame including first frame up to this point, then we have
        // no composited frame to restore to. In this case, restore to background instead.
        if (disposalRestoreFromIdx !== null) {
          frame?.putImageData(frames[disposalRestoreFromIdx].data, 0, 0)
        } else {
          lastImg &&
            frame?.clearRect(
              lastImg.leftPos,
              lastImg.topPos,
              lastImg.width,
              lastImg.height
            )
        }
      } else {
        disposalRestoreFromIdx = currIdx - 1
      }

      if (lastDisposalMethod === 2) {
        // Restore to background color
        // Browser implementations historically restore to transparent; we do the same.
        // http://www.wizards-toolkit.org/discourse-server/viewtopic.php?f=1&t=21172#p86079
        lastImg &&
          frame?.clearRect(
            lastImg.leftPos,
            lastImg.topPos,
            lastImg.width,
            lastImg.height
          )
      }
    }
    // else, Undefined/Do not dispose.
    // frame contains final pixel data from the last frame; do nothing

    //Get existing pixels for img region after applying disposal method
    if (frame) {
      let imgData = frame.getImageData(
        img.leftPos,
        img.topPos,
        img.width,
        img.height
      ) //apply color table colors
      img.pixels.forEach((pixel, i) => {
        // imgData.data === [R,G,B,A,R,G,B,A,...]
        if (pixel !== transparency) {
          imgData.data[i * 4 + 0] = ct[pixel][0]
          imgData.data[i * 4 + 1] = ct[pixel][1]
          imgData.data[i * 4 + 2] = ct[pixel][2]
          imgData.data[i * 4 + 3] = 255 // Opaque.
        }
      })

      frame?.putImageData(imgData, img.leftPos, img.topPos)
    }

    if (!ctx_scaled) {
      ctx.scale(get_canvas_scale(), get_canvas_scale())
      ctx_scaled = true
    }

    // We could use the on-page canvas directly, except that we draw a progress
    // bar for each image chunk (not just the final image).
    if (drawWhileLoading) {
      tmpCanvas && ctx.drawImage(tmpCanvas, 0, 0)
      drawWhileLoading = options.auto_play
    }

    lastImg = img
  }
  const doEof: Hander['eof'] = (block) => {
    //toolbar.style.display = '';
    pushFrame()
    doDecodeProgress(false)
    if (!(options.c_w && options.c_h)) {
      canvas.width = hdr.width * get_canvas_scale()
      canvas.height = hdr.height * get_canvas_scale()
    }
    player.init()
    loading = false
    if (load_callback) {
      load_callback(gif)
    }
  }
  const handler: Hander = {
    hdr: withProgress(doHdr),
    gce: withProgress(doGCE),
    com: withProgress(doNothing),
    // I guess that's all for now.
    app: {
      // TODO: Is there much point in actually supporting iterations?
      NETSCAPE: withProgress(doNothing)
    },
    img: withProgress(doImg, true),
    eof: doEof,
    pte: (block) => console.log('pte', block),
    unknown: (block) => console.log('unknown', block)
  } as const
  // XXX: There's probably a better way to handle catching exceptions when
  // callbacks are involved.
  const doParse = () => {
    try {
      parseGIF(stream, handler)
    } catch (err) {
      viewer.doLoadError('parse')
    }
  }
  // hander
  // load

  const load_url = (
    src: string,
    callback?: (gif: HTMLImageElement) => void
  ) => {
    if (!load_setup(callback)) return

    let h = new XMLHttpRequest()
    // new browsers (XMLHttpRequest2-compliant)
    h.open('GET', src, true)

    if ('overrideMimeType' in h) {
      h.overrideMimeType('text/plain; charset=x-user-defined')
    }

    // old browsers (XMLHttpRequest-compliant)
    else if ('responseType' in h) {
      h.responseType = 'arraybuffer'
    }

    // IE9 (Microsoft.XMLHTTP-compliant)
    else {
      h.setRequestHeader('Accept-Charset', 'x-user-defined')
    }

    h.onloadstart = () => {
      // Wait until connection is opened to replace the gif element with a canvas to avoid a blank img
      if (!viewer.initialized) viewer.init()
    }
    h.onload = function (e) {
      if (this.status != 200) {
        viewer.doLoadError('xhr - response')
      }
      // emulating response field for IE9
      if (!('response' in this)) {
        Object.assign(this, {
          response: new window.VBArray(this.responseText)
            .toArray()
            .map(String.fromCharCode)
            .join('')
        })
      }
      let data = this.response
      if (data.toString().indexOf('ArrayBuffer') > 0) {
        data = new Uint8Array(data)
      }

      stream = new Stream(data)
      setTimeout(doParse, 0)
    }
    h.onprogress = (e) => {
      if (e.lengthComputable) viewer.doShowProgress(e.loaded, e.total, true)
    }
    h.onerror = () => {
      viewer.doLoadError('xhr')
    }
    h.send()
  }

  const load = (callback?: (gif: HTMLImageElement) => void) => {
    load_url(gif.getAttribute('rel:animated_src') || gif.src, callback)
  }

  const load_raw = (arr, callback) => {
    if (!load_setup(callback)) return
    if (!viewer.initialized) viewer.init()
    stream = new Stream(arr)
    setTimeout(doParse, 0)
  }
  // load
  return {
    player,
    // play controls
    play: player.play,
    pause: player.pause,
    move_relative: player.move_relative,
    move_to: player.move_to,
    // getters for instance vars
    get_playing: () => player.playing,
    get_length: () => player.length(),
    get_current_frame: () => player.current_frame(),

    get_canvas: () => canvas,
    get_canvas_scale: () => get_canvas_scale(),
    get_loading: () => loading,
    get_auto_play: () => options,
    load_url,
    load,
    load_raw,
    set_frame_offset: setFrameOffset,
    frames
  }
}

export default SuperGif
