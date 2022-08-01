import { Emitter } from './Emitter'
import { Loader } from './loader'
import { Gif89aDecoder } from './gif89aDecoder'
import { Player } from './player'
import { Stream } from './stream'
import {
  AppExtBlock,
  Block,
  ComExtBlock,
  Frame,
  GCExtBlock,
  Header,
  ImgBlock,
  Options,
  PTExtBlock,
  Rect,
  UnknownExtBlock
} from './type'
import { Viewer } from './viewer'

const SuperGif = (opts: Options) => {
  const EMITS = ['loadstart', 'load', 'progress', 'error', 'complete'] as const
  const emitter = new Emitter<typeof EMITS>()
  const options: Options = Object.assign({}, opts)
  for (let i in opts) {
    options[i] = opts[i]
  }

  const gif = options.gif
  // global func
  // global func
  // canvas
  const viewer = new Viewer()
  viewer.mount(gif)
  // canvas

  // player
  const player = new Player({
    overrideLoopMode: options.loop_mode !== false,
    loopDelay: options.loop_delay || 0,
    viewer
  })
  player.on('complete', () => emitter.emit('complete', gif))
  // player
  // decoder
  const decoder = new Gif89aDecoder()

  const withProgress = (fn: Function) => {
    return (...args) => {
      fn(...args)
      viewer.drawProgress(decoder.pos / decoder.len)
    }
  }
  decoder.on(
    'header',
    withProgress((_hdr: Header) => {
      viewer.adapt({
        width: _hdr.logicalScreenWidth,
        height: _hdr.logicalScreenHeight
      })
    })
  )
  decoder.on('app', (appBlock: AppExtBlock) => {})
  decoder.on(
    'frame',
    withProgress((frame: Frame & Rect) => {
      player.onFrame(frame)
    })
  )
  decoder.on(
    'complete',
    withProgress((block: Block) => {
      player.play()
      emitter.emit('load', gif)
    })
  )
  // /decoder

  // loader
  const load_setup = () => {
    player.frameGroup = []
    player.delay = null
  }

  const loader = new Loader()
  loader.on('load', (data: string | Uint8Array) => {
    load_setup()
    const stream = new Stream(data)
    try {
      decoder.parse(stream)
    } catch (err) {
      viewer.drawError('parse')
    }
  })
  loader.on('progress', (e: ProgressEvent<EventTarget>) => {
    e.lengthComputable && viewer.drawProgress(e.loaded / e.total)
  })
  loader.on('error', (message: string) => {
    load_setup()
    viewer.drawError(message)
  })

  const getLoading = () => loader.loading || decoder.loading

  const load_url = (url: string) => {
    if (getLoading()) return
    loader.load_url(url)
  }

  const load_raw = (data: string | Uint8Array) => {
    if (getLoading()) return
    loader.load_raw(data)
  }

  const load = () => {
    if (getLoading()) return
    load_url(gif.getAttribute('rel:animated_src') || gif.src)
  }
  // /loader

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
