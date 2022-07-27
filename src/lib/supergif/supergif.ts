import { Emitter } from './Emitter'
import { Loader } from './loader'
import { GifParser } from './parseGIF'
import { Player } from './player'
import { Stream } from './stream'
import { Gif89aData, Hander, Header, Options, VP } from './type'
import { Viewer } from './viewer'

const SuperGif = (opts: Options & Partial<VP>) => {
  const EMITS = ['loadstart', 'load', 'progress', 'error', 'complete'] as const
  const emitter = new Emitter<typeof EMITS>()
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
  let disposalRestoreFromIdx: number | null = null
  let lastDisposalMethod: number | null = null

  let loadError = ''

  const gif = options.gif
  const auto_play =
    options.auto_play || gif.getAttribute('rel:auto_play') !== '0'

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
    showProgressBar: options.show_progress_bar !== false,
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
    get gif() {
      return gif
    },
    get transparency() {
      return transparency
    }
  })
  const canvas = viewer.canvas

  viewer.init()
  // canvas

  // player
  const player = new Player({
    overrideLoopMode: options.loop_mode !== false,
    loopDelay: options.loop_delay || 0,
    auto_play,
    get lastDisposalMethod() {
      return lastDisposalMethod
    },
    get disposalRestoreFromIdx() {
      return disposalRestoreFromIdx
    },
    set disposalRestoreFromIdx(val) {
      disposalRestoreFromIdx = val
    },
    viewer
  })
  player.on('putFrame', viewer.onPutFrame)
  player.on('init', viewer.resize)
  player.on('complete', () => emitter.emit('complete', gif))
  // player
  // loader

  let disposalMethod: null | number = null
  const clear = () => {
    transparency = null
    player.delay = null
    lastDisposalMethod = disposalMethod
    disposalMethod = null
    viewer.frame = null
  }

  /**
   * @param{boolean=} draw Whether to draw progress bar or not; this is not idempotent because of translucency.
   *                       Note that this means that the text will be unsynchronized with the progress bar on non-frames;
   *                       but those are typically so small (GCE etc.) that it doesn't really matter. TODO: Do this properly.
   */
  const withProgress = (fn: Function, draw = false) => {
    return (block) => {
      fn(block)
      viewer.doDecodeProgress(stream.pos, stream.data.length, draw)
    }
  }

  let gifData: Gif89aData = {
    imgs: [],
    blocks: []
  }

  const gifParser = new GifParser()
  const HANDER: Hander = {
    hdr: withProgress((_hdr) => {
      gifData = {
        imgs: [],
        blocks: []
      }
      gifData.header = _hdr
      hdr = _hdr
      viewer.setSizes(hdr.width, hdr.height)
    }),
    gce: withProgress((gce) => {
      gifData.blocks.push(gce)
      player.pushFrame()
      clear()
      transparency = gce.transparencyGiven ? gce.transparencyIndex : null
      player.delay = gce.delayTime
      disposalMethod = gce.disposalMethod
      // We don't have much to do with the rest of GCE.
    }),
    com: withProgress((block) => {
      gifData.blocks.push(block)
    }),
    // I guess that's all for now.
    app: withProgress((appBlock) => {
      gifData.app = appBlock
    }),
    img: withProgress((imageBlock) => {
      gifData.imgs.push(imageBlock)
      gifData.blocks.push(imageBlock)
      player.doImg(imageBlock)
    }, true),
    eof: (block) => {
      gifData.blocks.push(block)
      console.log('eof', gifData)
      //toolbar.style.display = '';
      withProgress(() => player.pushFrame())(block)
      if (!(options.c_w && options.c_h)) {
        canvas.width = hdr.width * get_canvas_scale()
        canvas.height = hdr.height * get_canvas_scale()
      }
      if (!loadError) {
        player.init()
      }
      emitter.emit('load', gif)
    },
    pte: (block) => {
      gifData.blocks.push(block)
    },
    unknown: (block) => {
      gifData.blocks.push(block)
    }
  } as const
  gifParser.on('hdr', HANDER.hdr)
  gifParser.on('gce', HANDER.gce)
  gifParser.on('com', HANDER.com)
  gifParser.on('app', HANDER.app)
  gifParser.on('img', HANDER.img)
  gifParser.on('eof', HANDER.eof)
  gifParser.on('pte', HANDER.pte)
  gifParser.on('unknown', HANDER.unknown)

  const loader = new Loader()
  loader.on('loadstart', () => {})
  // XXX: There's probably a better way to handle catching exceptions when
  // callbacks are involved.
  loader.on('load', (data: string | Uint8Array) => {
    stream = new Stream(data)
    try {
      gifParser.parse(stream)
    } catch (err) {
      player.frames = []
      viewer.doLoadError('parse')
    }
  })
  loader.on('progress', (e: ProgressEvent<EventTarget>) => {
    e.lengthComputable && viewer.doShowProgress(e.loaded, e.total, true)
  })
  loader.on('error', (message: string) => {
    loadError = message
    player.frames = []
    viewer.doLoadError(message)
  })
  // loader
  const getSrc = () => gif.getAttribute('rel:animated_src') || gif.src

  const getLoading = () => {
    return loader.loading || gifParser.loading
  }

  const load_setup = () => {
    player.frames = []
    clear()
    disposalRestoreFromIdx = null
    lastDisposalMethod = null
    viewer.frame = null
    player.lastImg = void 0
  }

  const load_url = (url: string) => {
    if (getLoading()) return
    load_setup()
    loader.load_url(url)
  }

  const load_raw = (data: string | Uint8Array) => {
    if (getLoading()) return
    load_setup()
    loader.load_raw(data)
  }

  const load = () => {
    if (getLoading()) return
    load_setup()
    load_url(getSrc())
  }

  return {
    player,
    // play controls
    play: player.play.bind(player),
    pause: player.pause.bind(player),
    move_relative: player.move_relative.bind(player),
    move_to: player.move_to.bind(player),
    // getters for instance vars
    get_playing: () => player.playing,
    get_current_frame: () => player.current_frame(),

    get_canvas: () => canvas,
    get_canvas_scale: () => get_canvas_scale(),
    get_loading: getLoading,
    get_auto_play: () => options,
    load_url,
    load,
    load_raw,
    set_frame_offset: viewer.setFrameOffset.bind(viewer),
    get frames() {
      return player.frames
    },
    get_length: () => player.frames.length,
    on: emitter.on,
    off: emitter.off
  }
}

export default SuperGif
/**
 * 下载
 * 读取字符
 * 解析
 * 播放
 */
