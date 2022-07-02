import { Loader } from './loader'
import { parseGIF } from './parseGIF'
import { Player } from './player'
import { Stream } from './stream'
import {
  Block,
  Frame,
  Hander,
  Header,
  ImgBlock,
  Offset,
  Options,
  Rect,
  VP
} from './type'
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
  let hdr: Header

  let transparency: number | null = null
  let delay: null | number = null
  let disposalRestoreFromIdx: number | null = null
  let lastDisposalMethod: number | null = null
  let lastImg: (Rect & Partial<ImgBlock>) | null = null

  let frames: Frame[] = []
  let frameOffsets: Offset[] = [] // elements have .x and .y properties
  let loadError = ''

  const gif = options.gif
  if (typeof options.auto_play == 'undefined')
    options.auto_play =
      !gif.getAttribute('rel:auto_play') ||
      gif.getAttribute('rel:auto_play') == '1'

  // global func

  const get_canvas_scale = () => {
    let scale = 1
    if (options.max_width && hdr?.width && hdr.width > options.max_width) {
      scale = options.max_width / hdr.width
    }
    return scale
  }
  // global func
  // canvas
  const viewer = new Viewer({
    get get_canvas_scale() {
      return get_canvas_scale
    },
    drawWhileLoading: options.draw_while_loading !== false,
    get showProgressBar() {
      return options.show_progress_bar !== false
    },
    progressBarHeight:
      typeof options.progressbar_height === 'number'
        ? options.progressbar_height
        : 25,
    progressBarBackgroundColor:
      typeof options.progressbar_background_color === 'string'
        ? options.progressbar_background_color
        : 'rgba(255,255,255,0.4)',
    progressBarForegroundColor: options.hasOwnProperty(
      'progressbar_foreground_color'
    )
      ? options.progressbar_foreground_color || ''
      : 'rgba(255,0,22,.8)',
    get is_vp() {
      return !!options.is_vp
    },
    get vp_t() {
      return options.vp_t
    },
    get vp_h() {
      return options.vp_h
    },
    get vp_l() {
      return options.vp_l
    },
    get vp_w() {
      return options.vp_w
    },
    get c_w() {
      return options.c_w
    },
    get c_h() {
      return options.c_h
    },
    get hdr() {
      return hdr
    },
    set hdr(val: Header) {
      hdr = val
    },
    get loadError() {
      return loadError
    },
    set loadError(val: string) {
      loadError = val
    },
    get gif() {
      return gif
    },
    get frames() {
      return frames
    },
    set frames(val: Frame[]) {
      frames = val
    },
    get stream() {
      return stream
    },
    get frameOffsets() {
      return frameOffsets
    },
    get delay() {
      return delay
    },
    get lastDisposalMethod() {
      return lastDisposalMethod
    },
    get disposalRestoreFromIdx() {
      return disposalRestoreFromIdx
    },
    get transparency() {
      return transparency
    },
    get auto_play() {
      return !!options.auto_play
    },
    get lastImg() {
      return lastImg
    },
    set lastImg(val: (Rect & Partial<ImgBlock>) | null) {
      lastImg = val
    }
  })
  const canvas = viewer.canvas
  const ctx = viewer.ctx

  const tmpCanvas = viewer.tmpCanvas

  // canvas

  // player
  const player = new Player({
    get frames() {
      return frames
    },
    get gif() {
      return gif
    },
    onEndListener: typeof options.on_end === 'function' ? options.on_end : null,
    overrideLoopMode: options.loop_mode !== false,
    loopDelay: options.loop_delay || 0,
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
    },
    get delay() {
      return delay
    }
  })
  // player
  // loader

  let disposalMethod: null | number = null
  let loading = false
  const clear = () => {
    transparency = null
    delay = null
    lastDisposalMethod = disposalMethod
    disposalMethod = null
    viewer.frame = null
  }
  let load_callback: (gif: HTMLImageElement) => void | undefined

  /**
   * @param{boolean=} draw Whether to draw progress bar or not; this is not idempotent because of translucency.
   *                       Note that this means that the text will be unsynchronized with the progress bar on non-frames;
   *                       but those are typically so small (GCE etc.) that it doesn't really matter. TODO: Do this properly.
   */
  const withProgress = (fn: Function, draw = false) => {
    return (block) => {
      fn(block)
      viewer.doDecodeProgress(draw)
    }
  }

  const HANDER: Hander = {
    hdr: withProgress((_hdr) => {
      hdr = _hdr
      viewer.setSizes(hdr.width, hdr.height)
    }),
    gce: withProgress((gce) => {
      viewer.pushFrame()
      clear()
      transparency = gce.transparencyGiven ? gce.transparencyIndex : null
      delay = gce.delayTime
      disposalMethod = gce.disposalMethod
      // We don't have much to do with the rest of GCE.
    }),
    com: withProgress(() => {}),
    // I guess that's all for now.
    app: {
      // TODO: Is there much point in actually supporting iterations?
      NETSCAPE: withProgress(() => {})
    },
    img: withProgress(viewer.doImg.bind(viewer), true),
    eof: (block) => {
      //toolbar.style.display = '';
      viewer.pushFrame()
      viewer.doDecodeProgress(false)
      if (!(options.c_w && options.c_h)) {
        canvas.width = hdr.width * get_canvas_scale()
        canvas.height = hdr.height * get_canvas_scale()
      }
      player.init()
      loading = false
      if (load_callback) {
        load_callback(gif)
      }
    },
    pte: (block) => console.log('pte', block),
    unknown: (block) => console.log('unknown', block)
  } as const

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
    viewer.frame = null
    lastImg = null

    return true
  }
  // XXX: There's probably a better way to handle catching exceptions when
  // callbacks are involved.
  const doParse = () => {
    try {
      parseGIF(stream, HANDER)
    } catch (err) {
      viewer.doLoadError('parse')
    }
  }
  const loader = new Loader({
    get viewer() {
      return viewer
    },
    get stream() {
      return stream
    },
    set stream(val: Stream) {
      stream = val
    },
    // XXX: There's probably a better way to handle catching exceptions when
    // callbacks are involved.
    doParse,
    load_setup,
    get gif() {
      return gif
    }
  })
  // loader
  return {
    player,
    // play controls
    play: player.play.bind(player),
    pause: player.pause.bind(player),
    move_relative: player.move_relative.bind(player),
    move_to: player.move_to.bind(player),
    // getters for instance vars
    get_playing: () => player.playing,
    get_length: () => player.length(),
    get_current_frame: () => player.current_frame(),

    get_canvas: () => canvas,
    get_canvas_scale: () => get_canvas_scale(),
    get_loading: () => loading,
    get_auto_play: () => options,
    load_url: loader.load_url.bind(loader),
    load: loader.load.bind(loader),
    load_raw: (arr: string | Uint8Array, callback) => {
      if (!load_setup(callback)) return
      if (!viewer.initialized) viewer.init()
      stream = new Stream(arr)
      setTimeout(doParse, 0)
    },
    set_frame_offset: viewer.setFrameOffset.bind(viewer),
    frames
  }
}

export default SuperGif
