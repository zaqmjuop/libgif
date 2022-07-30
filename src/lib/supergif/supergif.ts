import { Emitter } from './Emitter'
import { ItemGif } from './itemGif'
import { Loader } from './loader'
import { GifParser } from './parseGIF'
import { Player } from './player'
import { Stream } from './stream'
import { GCExtBlock, Gif89aData, Hander, Header, Options, VP } from './type'
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
      vp_h: 0
    },
    opts
  )
  for (let i in opts) {
    options[i] = opts[i]
  }
  if (options.vp_w && options.vp_h) options.is_vp = true

  let loadError = ''

  const gif = options.gif
  let itemGif = new ItemGif(
    { max_width: options.max_width },
    { width: gif.width, height: gif.height }
  )
  // global func
  // global func
  // canvas
  const viewer = new Viewer({
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
      return gif.width || itemGif.data.header.logicalScreenWidth
    },
    get c_h() {
      return gif.height || itemGif.data.header.logicalScreenHeight
    },
    get gif() {
      return gif
    }
  })

  // canvas

  // player
  const player = new Player({
    overrideLoopMode: options.loop_mode !== false,
    loopDelay: options.loop_delay || 0,
    get gifData() {
      return itemGif.data
    },
    viewer
  })
  player.on('complete', () => emitter.emit('complete', gif))
  // player
  // loader
  const gifParser = new GifParser()

  const HANDER: Hander = {
    hdr: (_hdr) => {
      itemGif.data.header = _hdr
      viewer.onImgHeader(_hdr)
    },
    // I guess that's all for now.
    app: (appBlock) => {
      itemGif.data.app = appBlock
    },
    gce: (gce: GCExtBlock) => {
      itemGif.data.gces[itemGif.data.imgs.length] = gce
      player.onGCE(gce)
      // We don't have much to do with the rest of GCE.
    },
    img: (imageBlock) => {
      itemGif.data.imgs.push(imageBlock)
      player.doImg(imageBlock)
    },
    com: (block) => {
      itemGif.data.exts.push(block)
    },
    pte: (block) => {
      itemGif.data.exts.push(block)
    },
    unknown: (block) => {
      itemGif.data.exts.push(block)
    },
    eof: (block) => {
      itemGif.data.eof = block
      //toolbar.style.display = '';
      player.pushFrame()
      if (!loadError) {
        player.play()
      }
      emitter.emit('load', gif)
    }
  } as const
  const withProgress = (fn: Function) => {
    return (...args) => {
      fn(...args)
      viewer.doShowProgress(gifParser.pos / gifParser.len)
    }
  }
  gifParser.on('hdr', withProgress(HANDER.hdr))
  gifParser.on('gce', HANDER.gce)
  gifParser.on('com', HANDER.com)
  gifParser.on('app', HANDER.app)
  gifParser.on('img', withProgress(HANDER.img))
  gifParser.on('eof', withProgress(HANDER.eof))
  gifParser.on('pte', HANDER.pte)
  gifParser.on('unknown', HANDER.unknown)

  const loader = new Loader()
  loader.on('loadstart', () => {})
  // XXX: There's probably a better way to handle catching exceptions when
  // callbacks are involved.
  loader.on('load', (data: string | Uint8Array) => {
    const stream = new Stream(data)
    try {
      gifParser.parse(stream)
    } catch (err) {
      player.frameGroup = []
      viewer.doLoadError('parse')
    }
  })
  loader.on('progress', (e: ProgressEvent<EventTarget>) => {
    e.lengthComputable && viewer.doShowProgress(e.loaded / e.total)
  })
  loader.on('error', (message: string) => {
    loadError = message
    player.frameGroup = []
    viewer.doLoadError(message)
  })
  // loader
  const getSrc = () => gif.getAttribute('rel:animated_src') || gif.src

  const getLoading = () => {
    return loader.loading || gifParser.loading
  }

  const load_setup = () => {
    itemGif = new ItemGif(
      { max_width: options.max_width },
      { width: gif.width, height: gif.height }
    )
    player.frameGroup = []
    player.delay = null
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
    play: player.play,
    pause: player.pause,
    move_relative: player.putFrameBy,
    move_to: player.move_to,
    // getters for instance vars
    get_playing: () => player.playing,
    get_current_frame: () => player.current_frame(),

    get_canvas: () => viewer.canvas,
    get_loading: getLoading,
    get_auto_play: () => options,
    load_url,
    load,
    load_raw,
    get frames() {
      return player.frameGroup
    },
    get_length: () => player.frameGroup.length,
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
