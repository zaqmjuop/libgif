import { Loader } from './loader'
import { parseGIF } from './parseGIF'
import { Player } from './player'
import { Stream } from './stream'
import {
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

class SuperGif2 {
  loadError: string | null = null
}

const SuperGif = (opts: Options & Partial<VP>) => {
  const instance = new SuperGif2()
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

  const loadError: string | null = null
  let loading = false

  let transparency: number | null = null
  let delay: null | number = null
  let disposalMethod: null | number = null
  let disposalRestoreFromIdx: number | null = null
  let lastDisposalMethod: number | null = null
  let frame: CanvasRenderingContext2D | null = null
  let lastImg: (Rect & Partial<ImgBlock>) | null = null

  let ctx_scaled = false

  let frames: Frame[] = []
  let frameOffsets: Offset[] = [] // elements have .x and .y properties

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
  // global func
  // canvas
  const viewer = new Viewer({
    get get_canvas_scale() {
      return get_canvas_scale
    },
    get showProgressBar() {
      return showProgressBar
    },
    get progressBarHeight() {
      return progressBarHeight
    },
    get progressBarBackgroundColor() {
      return progressBarBackgroundColor
    },
    get progressBarForegroundColor() {
      return progressBarForegroundColor
    },
    get ctx_scaled() {
      return ctx_scaled
    },
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
    get frame() {
      return frame
    },
    set frame(val: CanvasRenderingContext2D | null) {
      frame = val
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
    get drawWhileLoading() {
      return !!drawWhileLoading
    },
    set drawWhileLoading(val: boolean) {
      drawWhileLoading = val
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
    },
    get delay() {
      return delay
    }
  })
  // player
  // hander
  const doHdr: Hander['hdr'] = (_hdr) => {
    hdr = _hdr
    viewer.setSizes(hdr.width, hdr.height)
  }
  const doGCE: Hander['gce'] = (gce) => {
    viewer.pushFrame()
    clear()
    transparency = gce.transparencyGiven ? gce.transparencyIndex : null
    delay = gce.delayTime
    disposalMethod = gce.disposalMethod
    // We don't have much to do with the rest of GCE.
  }
  const doNothing = () => {}

  const doImg: Hander['img'] = viewer.doImg.bind(viewer)
  const doEof: Hander['eof'] = (block) => {
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
  }
  const handler: Hander = {
    hdr: viewer.withProgress(doHdr),
    gce: viewer.withProgress(doGCE),
    com: viewer.withProgress(doNothing),
    // I guess that's all for now.
    app: {
      // TODO: Is there much point in actually supporting iterations?
      NETSCAPE: viewer.withProgress(doNothing)
    },
    img: viewer.withProgress(doImg, true),
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
    get doParse() {
      return doParse
    },
    get load_setup() {
      return load_setup
    },
    get gif() {
      return gif
    }
  })
  // load
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
    load_raw: loader.load_raw.bind(loader),
    set_frame_offset: viewer.setFrameOffset.bind(viewer),
    frames
  }
}

export default SuperGif
