import { parseGIF } from './parseGIF'
import { Stream } from './stream'

interface Options {
  vp_w: number
  vp_h: number
  is_vp?: boolean
  vp_l: number
  vp_t: number
  c_w: number
  c_h: number
  gif: HTMLImageElement
  auto_play?: boolean
  on_end?: (gif: HTMLImageElement) => void
  loop_delay?: number
  loop_mode?: boolean
  draw_while_loading?: boolean
  show_progress_bar?: boolean
  progressbar_height?: number
  progressbar_background_color?: string
  progressbar_foreground_color?: string
  max_width?: number
}

const SuperGif = (opts: Options) => {
  const options: Options = Object.assign(
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

  let stream
  let hdr

  let loadError = null
  let loading = false

  let transparency = null
  let delay = null
  let disposalMethod = null
  let disposalRestoreFromIdx: number | null = null
  let lastDisposalMethod = null
  let frame: CanvasRenderingContext2D | null = null
  let lastImg: {
    leftPos: number
    topPos: number
    width: number
    height: number
  } | null = null

  let playing = true
  let forward = true

  let ctx_scaled = false

  let frames: any[] = []
  let frameOffsets: any[] = [] // elements have .x and .y properties

  let gif = options.gif
  if (typeof options.auto_play == 'undefined')
    options.auto_play =
      !gif.getAttribute('rel:auto_play') ||
      gif.getAttribute('rel:auto_play') == '1'

  let onEndListener =
    typeof options.on_end === 'function' ? options.on_end : null
  let loopDelay =
    typeof options.loop_delay === 'number' ? options.loop_delay : 0
  const overrideLoopMode =
    typeof options.loop_mode === 'boolean' ? options.loop_mode : 'auto'
  let drawWhileLoading = options.hasOwnProperty('draw_while_loading')
    ? options.draw_while_loading
    : true
  const showProgressBar = drawWhileLoading
    ? options.hasOwnProperty('show_progress_bar')
      ? options.show_progress_bar
      : true
    : false
  const progressBarHeight =
    typeof options.progressbar_height === 'number'
      ? options.progressbar_height
      : 25
  const progressBarBackgroundColor = options.hasOwnProperty(
    'progressbar_background_color'
  )
    ? options.progressbar_background_color
    : 'rgba(255,255,255,0.4)'
  const progressBarForegroundColor = options.hasOwnProperty(
    'progressbar_foreground_color'
  )
    ? options.progressbar_foreground_color
    : 'rgba(255,0,22,.8)'

  const clear = () => {
    transparency = null
    delay = null
    lastDisposalMethod = disposalMethod
    disposalMethod = null
    frame = null
  }

  // XXX: There's probably a better way to handle catching exceptions when
  // callbacks are involved.
  const doParse = () => {
    try {
      parseGIF(stream, handler)
    } catch (err) {
      doLoadError('parse')
    }
  }

  const setSizes = (w: number, h: number) => {
    canvas.width = w * get_canvas_scale()
    canvas.height = h * get_canvas_scale()
    toolbar.style.minWidth = w * get_canvas_scale() + 'px'
    if (tmpCanvas) {
      tmpCanvas.width = w
      tmpCanvas.height = h
      tmpCanvas.style.width = w + 'px'
      tmpCanvas.style.height = h + 'px'
      tmpCanvas.getContext('2d')?.setTransform(1, 0, 0, 1, 0, 0)
    }
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

  const doShowProgress = (pos, length, draw) => {
    if (draw && showProgressBar) {
      let height = progressBarHeight
      let left, mid, top, width
      if (options.is_vp) {
        if (!ctx_scaled) {
          top = options.vp_t + options.vp_h - height
          height = height
          left = options.vp_l
          mid = left + (pos / length) * options.vp_w
          width = canvas.width
        } else {
          top = (options.vp_t + options.vp_h - height) / get_canvas_scale()
          height = height / get_canvas_scale()
          left = options.vp_l / get_canvas_scale()
          mid = left + (pos / length) * (options.vp_w / get_canvas_scale())
          width = canvas.width / get_canvas_scale()
        }
        //some debugging, draw rect around viewport
        if (false) {
          // if (!ctx_scaled) {
          //   let l = options.vp_l,
          //     t = options.vp_t
          //   let w = options.vp_w,
          //     h = options.vp_h
          // } else {
          //   let l = options.vp_l / get_canvas_scale(),
          //     t = options.vp_t / get_canvas_scale()
          //   let w = options.vp_w / get_canvas_scale(),
          //     h = options.vp_h / get_canvas_scale()
          // }
          // ctx.rect(l, t, w, h)
          // ctx.stroke()
        }
      } else {
        top = (canvas.height - height) / (ctx_scaled ? get_canvas_scale() : 1)
        mid =
          ((pos / length) * canvas.width) /
          (ctx_scaled ? get_canvas_scale() : 1)
        width = canvas.width / (ctx_scaled ? get_canvas_scale() : 1)
        height /= ctx_scaled ? get_canvas_scale() : 1
      }

      ctx.fillStyle = progressBarBackgroundColor
      ctx.fillRect(mid, top, width - mid, height)

      ctx.fillStyle = progressBarForegroundColor
      ctx.fillRect(0, top, mid, height)
    }
  }

  const doLoadError = (originOfError) => {
    const drawError = () => {
      ctx.fillStyle = 'black'
      ctx.fillRect(
        0,
        0,
        options.c_w ? options.c_w : hdr.width,
        options.c_h ? options.c_h : hdr.height
      )
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 3
      ctx.moveTo(0, 0)
      ctx.lineTo(
        options.c_w ? options.c_w : hdr.width,
        options.c_h ? options.c_h : hdr.height
      )
      ctx.moveTo(0, options.c_h ? options.c_h : hdr.height)
      ctx.lineTo(options.c_w ? options.c_w : hdr.width, 0)
      ctx.stroke()
    }

    loadError = originOfError
    hdr = {
      width: gif.width,
      height: gif.height
    } // Fake header.
    frames = []
    drawError()
  }

  const doHdr = (_hdr) => {
    hdr = _hdr
    setSizes(hdr.width, hdr.height)
  }

  const doGCE = (gce) => {
    pushFrame()
    clear()
    transparency = gce.transparencyGiven ? gce.transparencyIndex : null
    delay = gce.delayTime
    disposalMethod = gce.disposalMethod
    // We don't have much to do with the rest of GCE.
  }

  const pushFrame = () => {
    if (!frame) return
    frames.push({
      data: frame.getImageData(0, 0, hdr.width, hdr.height),
      delay: delay
    })
    frameOffsets.push({ x: 0, y: 0 })
  }

  const doImg = (img) => {
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
      ctx.drawImage(tmpCanvas, 0, 0)
      drawWhileLoading = options.auto_play
    }

    lastImg = img
  }

  const player = (() => {
    let i = -1
    let iterationCount = 0
    const getFrames = () => frames

    /**
     * Gets the index of the frame "up next".
     * @returns {number}
     */
    const getNextFrameNo = () => {
      const delta = forward ? 1 : -1
      return (i + delta + frames.length) % frames.length
    }

    const stepFrame = (amount) => {
      // XXX: Name is confusing.
      i = i + amount
      putFrame()
    }

    const step = (() => {
      let stepping = false

      const completeLoop = () => {
        if (onEndListener !== null) onEndListener(gif)
        iterationCount++

        if (overrideLoopMode !== false || iterationCount < 0) {
          doStep()
        } else {
          stepping = false
          playing = false
        }
      }

      const doStep = () => {
        stepping = playing
        if (!stepping) return

        stepFrame(1)
        let delay = frames[i].delay * 10
        if (!delay) delay = 100 // FIXME: Should this even default at all? What should it be?

        const nextFrameNo = getNextFrameNo()
        if (nextFrameNo === 0) {
          delay += loopDelay
          setTimeout(completeLoop, delay)
        } else {
          setTimeout(doStep, delay)
        }
      }

      return () => {
        if (!stepping) setTimeout(doStep, 0)
      }
    })()

    const putFrame = () => {
      i = parseInt(`${i}`, 10)

      if (i > frames.length - 1) {
        i = 0
      }

      if (i < 0) {
        i = 0
      }

      const offset = frameOffsets[i]
      if (tmpCanvas) {
        tmpCanvas
          .getContext('2d')
          ?.putImageData(frames[i].data, offset.x, offset.y)
      }
      ctx.globalCompositeOperation = 'copy'
      ctx.drawImage(tmpCanvas, 0, 0)
    }

    const play = () => {
      playing = true
      step()
    }

    const pause = () => {
      playing = false
    }

    return {
      getFrames,
      init: () => {
        if (loadError) return

        if (!(options.c_w && options.c_h)) {
          ctx.scale(get_canvas_scale(), get_canvas_scale())
        }

        if (options.auto_play) {
          step()
        } else {
          i = 0
          putFrame()
        }
      },
      step: step,
      play: play,
      pause: pause,
      playing: playing,
      move_relative: stepFrame,
      current_frame: () => i,
      length: () => frames.length,
      move_to: (frame_idx) => {
        i = frame_idx
        putFrame()
      }
    }
  })()

  let doDecodeProgress = (draw) => {
    doShowProgress(stream.pos, stream.data.length, draw)
  }

  const doNothing = () => {}
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

  const handler = {
    hdr: withProgress(doHdr),
    gce: withProgress(doGCE),
    com: withProgress(doNothing),
    // I guess that's all for now.
    app: {
      // TODO: Is there much point in actually supporting iterations?
      NETSCAPE: withProgress(doNothing)
    },
    img: withProgress(doImg, true),
    eof: (block) => {
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
  }

  const init = () => {
    const parent = gif.parentNode

    const div = document.createElement('div')
    canvas = document.createElement('canvas')
    ctx = canvas.getContext('2d')
    toolbar = document.createElement('div')

    tmpCanvas = document.createElement('canvas')

    div.setAttribute('width', (canvas.width = gif.width.toString()))
    div.setAttribute('height', (canvas.height = gif.height.toString()))
    toolbar.style.minWidth = gif.width + 'px'

    div.className = 'jsgif'
    toolbar.className = 'jsgif_toolbar'
    div.appendChild(canvas)
    div.appendChild(toolbar)

    if (parent) {
      parent.insertBefore(div, gif)
      parent.removeChild(gif)
    }

    if (options.c_w && options.c_h) setSizes(options.c_w, options.c_h)
    initialized = true
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
  let canvas
  let ctx
  let toolbar
  let tmpCanvas: HTMLCanvasElement | null
  let initialized = false
  let load_callback: Function | undefined

  const load_setup = (callback?: Function) => {
    if (loading) {
      return false
    }
    load_callback = callback

    loading = true
    frames = []
    clear()
    disposalRestoreFromIdx = null
    lastDisposalMethod = null
    frame = null
    lastImg = null

    return true
  }

  return {
    player,
    // play controls
    play: player.play,
    pause: player.pause,
    move_relative: player.move_relative,
    move_to: player.move_to,

    // getters for instance vars
    get_playing: () => playing,
    get_canvas: () => canvas,
    get_canvas_scale: () => get_canvas_scale(),
    get_loading: () => loading,
    get_auto_play: () => options,
    get_length: () => player.length(),
    get_current_frame: () => player.current_frame(),
    load_url: (src, callback) => {
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
        if (!initialized) init()
      }
      h.onload = function (e) {
        if (this.status != 200) {
          doLoadError('xhr - response')
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
        if (e.lengthComputable) doShowProgress(e.loaded, e.total, true)
      }
      h.onerror = () => {
        doLoadError('xhr')
      }
      h.send()
    },
    load: function (callback: Function) {
      this.load_url(gif.getAttribute('rel:animated_src') || gif.src, callback)
    },
    load_raw: (arr, callback) => {
      if (!load_setup(callback)) return
      if (!initialized) init()
      stream = new Stream(arr)
      setTimeout(doParse, 0)
    },
    set_frame_offset: setFrameOffset,
    frames
  }
}

export default SuperGif
