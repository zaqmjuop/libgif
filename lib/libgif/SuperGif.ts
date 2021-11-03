/*
	SuperGif

	Example usage:

		<img src="./example1_preview.gif" rel:animated_src="./example1.gif" width="360" height="360" rel:auto_play="1" />

		<script type="text/javascript">
			$$('img').each(function (img_tag) {
				if (/.*\.gif/.test(img_tag.src)) {
					var rub = new SuperGif({ gif: img_tag } );
					rub.load();
				}
			});
		</script>

	Image tag attributes:

		rel:animated_src -	If this url is specified, it's loaded into the player instead of src.
							This allows a preview frame to be shown until animated gif data is streamed into the canvas

		rel:auto_play -		Defaults to 1 if not specified. If set to zero, a call to the play() method is needed

	Constructor options args

		gif 				Required. The DOM element of an img tag.
		loop_mode			Optional. Setting this to false will force disable looping of the gif.
		auto_play 			Optional. Same as the rel:auto_play attribute above, this arg overrides the img tag info.
		max_width			Optional. Scale images over max_width down to max_width. Helpful with mobile.
 		on_end				Optional. Add a callback for when the gif reaches the end of a single loop (one iteration). The first argument passed will be the gif HTMLElement.
		loop_delay			Optional. The amount of time to pause (in ms) after each single loop (iteration).
		draw_while_loading	Optional. Determines whether the gif will be drawn to the canvas whilst it is loaded.
		show_progress_bar	Optional. Only applies when draw_while_loading is set to true.
		speed     		Optional. The speed multiple when playing

	Instance methods

		// loading
		load( callback )		Loads the gif specified by the src or rel:animated_src sttributie of the img tag into a canvas element and then calls callback if one is passed
		load_url( src, callback )	Loads the gif file specified in the src argument into a canvas element and then calls callback if one is passed

		// play controls
		play -				Start playing the gif
		pause -				Stop playing the gif
		move_to(i) -		Move to frame i of the gif
		move_relative(i) -	Move i frames ahead (or behind if i < 0)
    		set_speed(speed) - 	Set the speed multiple

		// getters
		get_canvas			The canvas element that the gif is playing in. Handy for assigning event handlers to.
		get_playing			Whether or not the gif is currently playing
		get_loading			Whether or not the gif has finished loading/parsing
		get_auto_play		Whether or not the gif is set to play automatically
		get_length			The number of frames in the gif
		get_current_frame	The index of the currently displayed frame of the gif
		get_speed       	Get the speed multiple of playing

		For additional customization (viewport inside iframe) these params may be passed:
		c_w, c_h - width and height of canvas
		vp_t, vp_l, vp_ w, vp_h - top, left, width and height of the viewport

		A bonus: few articles to understand what is going on
			http://enthusiasms.org/post/16976438906
			http://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp
			http://humpy77.deviantart.com/journal/Frame-Delay-Times-for-Animated-GIFs-214150546

*/
import { isKeyof } from '@/utils'
import { Hander, parseGIF } from './parseGIF'
import { Stream } from './Stream'
import { request } from './net'
import { Painter } from './painter'
interface Opts {
  gif: HTMLImageElement
  //viewport position
  vp_t?: number
  vp_w?: number
  vp_h?: number
  //canvas sizes
  c_w?: number
  c_h?: number
  auto_play?: boolean
  on_end?: (ele: HTMLImageElement) => void
  on_change?: (i: number) => void
  loop_delay?: number
  loop_mode?: boolean | 'auto'
  overrideLoopMode?: boolean
  draw_while_loading?: boolean
  progressbar_background_color?: string
  progressbar_foreground_color?: string
  speed?: number
  max_width?: number
}
const forward = true

export const SuperGif = function (opts: Opts) {
  const gif = opts.gif

  const defaultState = {
    gif: opts.gif,
    //viewport position
    vp_l: 0,
    vp_t: 0,
    vp_w: 0,
    vp_h: 0,
    //canvas sizes
    c_w: 0,
    c_h: 0,
    auto_play: true,
    on_end: null,
    on_change: null,
    loop_delay: 0
  }

  const options: Required<Opts> = Object.assign(defaultState, opts)
  for (const i in opts) {
    if (opts[i] !== undefined) {
      options[i] = opts[i]
    }
  }
  const is_vp = options.vp_w && options.vp_h

  let stream
  let hdr

  let loadError = null
  let loading = false

  let transparency = null
  let delay = null
  let disposalMethod = null
  let disposalRestoreFromIdx: number | null = null
  let lastDisposalMethod = null
  let frame: any = null
  let lastImg: any = null

  let playing = true

  let ctx_scaled = false

  const frames: Array<{ data: any; delay: number | null }> = []
  const frameOffsets: Record<string, any> = [] // elements have .x and .y properties

  const loopDelay = options.loop_delay || 0
  const overrideLoopMode = isKeyof('loop_mode', options)
    ? options.loop_mode
    : true
  let drawWhileLoading = isKeyof('draw_while_loading', options)
    ? options.draw_while_loading
    : true
  let speedMutiple = isKeyof('speed', options) ? options.speed : 1

  const clear = function () {
    transparency = null
    delay = null
    lastDisposalMethod = disposalMethod
    disposalMethod = null
    frame = null
  }

  // XXX: There's probably a better way to handle catching exceptions when
  // callbacks are involved.
  const doParse = function () {
    try {
      parseGIF(stream, handler)
    } catch (err) {
      doLoadError('parse')
    }
  }

  const setFrameOffset = function (frame, offset) {
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

  const doShowProgress = function (
    pos: number,
    length: number,
    draw?: boolean
  ) {
    // console.log(pos / length, draw)
  }

  const doLoadError = function (originOfError) {
    const drawError = function () {
      const ctx = painter.ctx
      if (ctx) {
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
    }

    loadError = originOfError
    hdr = {
      width: gif.width,
      height: gif.height
    } // Fake header.
    frames.splice(0, frames.length)
    drawError()
  }

  const doHdr = function (_hdr) {
    hdr = _hdr
    painter.setSizes(hdr.width, hdr.height, get_canvas_scale())
  }

  const doGCE = function (gce) {
    pushFrame()
    clear()
    transparency = gce.transparencyGiven ? gce.transparencyIndex : null
    delay = gce.delayTime
    disposalMethod = gce.disposalMethod
    // We don't have much to do with the rest of GCE.
  }

  const pushFrame = function () {
    if (!frame) return
    frames.push({
      data: frame.getImageData(0, 0, hdr.width, hdr.height),
      delay: delay
    })
    frameOffsets.push({ x: 0, y: 0 })
  }

  const doImg = function (img) {
    if (!frame) frame = painter.tmpCanvas.getContext('2d')

    const currIdx = frames.length

    //ct = color table, gct = global color table
    const ct = img.lctFlag ? img.lct : hdr.gct // TODO: What if neither exists?

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
          frame.putImageData(frames[disposalRestoreFromIdx].data, 0, 0)
        } else {
          frame.clearRect(
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
        frame.clearRect(
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
    const imgData = frame.getImageData(
      img.leftPos,
      img.topPos,
      img.width,
      img.height
    )

    //apply color table colors
    for (let i = 0; i < img.pixels.length; i++) {
      const pixel = img.pixels[i]
      // imgData.data === [R,G,B,A,R,G,B,A,...]
      if (pixel !== transparency) {
        const pix = ct[pixel]
        const idx = i * 4
        imgData.data[idx] = pix[0]
        imgData.data[idx + 1] = pix[1]
        imgData.data[idx + 2] = pix[2]
        imgData.data[idx + 3] = 255 // Opaque.
      }
    }

    frame.putImageData(imgData, img.leftPos, img.topPos)

    if (!ctx_scaled) {
      painter.ctx?.scale(get_canvas_scale(), get_canvas_scale())
      ctx_scaled = true
    }

    // We could use the on-page canvas directly, except that we draw a progress
    // bar for each image chunk (not just the final image).
    if (drawWhileLoading) {
      painter.ctx?.drawImage(painter.tmpCanvas, 0, 0)
      drawWhileLoading = options.auto_play
    }

    lastImg = img
  }

  const player = (function () {
    let i = -1
    let iterationCount = 0

    /**
     * Gets the index of the frame "up next".
     * @returns {number}
     */
    const getNextFrameNo = function () {
      const delta = forward ? 1 : -1
      return (i + delta + frames.length) % frames.length
    }

    const stepFrame = function (amount) {
      // XXX: Name is confusing.
      i = i + amount

      putFrame()
    }

    const step = (function () {
      let stepping = false

      const completeLoop = function () {
        options.on_end && options.on_end(gif)
        iterationCount++

        if (overrideLoopMode || iterationCount < 0) {
          doStep()
        } else {
          stepping = false
          playing = false
        }
      }

      const doStep = function () {
        stepping = playing
        if (!stepping) return

        stepFrame(1)
        let delay = ((frames[i].delay || 0) * 10) / speedMutiple
        if (!delay) delay = 100 // FIXME: Should this even default at all? What should it be?

        const nextFrameNo = getNextFrameNo()
        if (nextFrameNo === 0) {
          delay += loopDelay
          setTimeout(completeLoop, delay)
        } else {
          setTimeout(doStep, delay)
        }
      }

      return function () {
        if (!stepping) setTimeout(doStep, 0)
      }
    })()

    const putFrame = function () {
      i = parseInt(String(i), 10)

      if (i > frames.length - 1) {
        i = 0
      }

      if (i < 0) {
        i = 0
      }

      const offset = frameOffsets[i]

      painter.tmpCanvas
        .getContext('2d')
        ?.putImageData(frames[i].data, offset.x, offset.y)
      const ctx = painter.ctx
      if (ctx) {
        ctx.globalCompositeOperation = 'copy'
        ctx.drawImage(painter.tmpCanvas, 0, 0)
      }

      options.on_change && options.on_change(i)
    }

    const play = function () {
      playing = true
      step()
    }

    const pause = function () {
      playing = false
    }

    return {
      init: function () {
        if (loadError) return

        if (!(options.c_w && options.c_h)) {
          painter.ctx?.scale(get_canvas_scale(), get_canvas_scale())
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
      set_speed: (speed: number) => {
        speedMutiple = speed
      },
      current_frame: function () {
        return i
      },
      length: function () {
        return frames.length
      },
      move_to: function (frame_idx) {
        i = frame_idx
        putFrame()
      }
    }
  })()

  const doDecodeProgress = function (draw) {
    doShowProgress(stream.pos, stream.data.length, draw)
  }

  const doNothing = function () {}
  /**
   * @param{boolean=} draw Whether to draw progress bar or not; this is not idempotent because of translucency.
   *                       Note that this means that the text will be unsynchronized with the progress bar on non-frames;
   *                       but those are typically so small (GCE etc.) that it doesn't really matter. TODO: Do this properly.
   */
  const withProgress = function (fn, draw?: any) {
    return function (block) {
      fn(block)
      doDecodeProgress(draw)
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
    eof: function (block) {
      pushFrame()
      doDecodeProgress(false)
      if (!(options.c_w && options.c_h)) {
        painter.canvas.width = hdr.width * get_canvas_scale()
        painter.canvas.height = hdr.height * get_canvas_scale()
      }
      player.init()
      loading = false
      if (load_callback) {
        load_callback(gif)
      }
    }
  }
  let painter: Painter
  const init = function () {
    painter = new Painter(gif)
    if (options.c_w && options.c_h) {
      painter.setSizes(options.c_w, options.c_h, get_canvas_scale())
    }
    initialized = true
  }

  const get_canvas_scale = function () {
    let scale = 1
    if (options.max_width && hdr && hdr.width > options.max_width) {
      scale = options.max_width / hdr.width
    }
    return scale
  }
  let initialized = false
  let load_callback: false | ((gif: any) => any) = false

  const load_setup = function (callback?: () => void) {
    if (loading) return false

    load_callback = callback || false
    loading = true
    frames.splice(0, frames.length)
    clear()
    disposalRestoreFromIdx = null
    lastDisposalMethod = null
    frame = null
    lastImg = null

    return true
  }

  return {
    // play controls
    play: player.play,
    pause: player.pause,
    move_relative: player.move_relative,
    move_to: player.move_to,
    set_speed: player.set_speed,
    load_url: function (src: string, callback?: () => void) {
      if (!load_setup(callback)) return
      request(src, {
        onloadstart: () => !initialized && init(),
        onload: function () {
          if (this.status != 200) {
            doLoadError('xhr - response')
          }
          // emulating response field for IE9
          if (!('response' in this)) {
            // eslint-disable-next-line
            ;(this as any).response = new (window as any).VBArray(
              this.responseText
            )
              .toArray()
              .map(String.fromCharCode)
              .join('')
          }
          let data = this.response
          if (data instanceof ArrayBuffer) {
            data = new Uint8Array(data)
          }

          stream = new Stream(data)
          setTimeout(doParse, 0)
        },
        onprogress: (e) =>
          e.lengthComputable && doShowProgress(e.loaded, e.total, true),
        onerror: () => doLoadError('xhr')
      })
    },
    load: function (callback?: () => void) {
      this.load_url(gif.getAttribute('rel:animated_src') || gif.src, callback)
    },
    load_raw: function (arr, callback) {
      if (!load_setup(callback)) return
      if (!initialized) init()
      stream = new Stream(arr)
      setTimeout(doParse, 0)
    },
    set_frame_offset: setFrameOffset
  }
}
