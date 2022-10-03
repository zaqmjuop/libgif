import { Emitter } from './utils/Emitter'
import { loadEmitter, load_url, load_raw } from './utils/loader'
import { Gif89aDecoder } from './decoders/gif89aDecoder'
import { Player } from './player'
import { Stream } from './decoders/stream'
import {
  AppExtBlock,
  Block,
  Frame,
  gifData,
  Header,
  Options,
  Rect
} from './type'
import { Viewer } from './viewer'
import { __DEV__ } from './utils/metaData'

const libgif = (opts: Options) => {
  let t = 0
  const EMITS = ['loadstart', 'load', 'progress', 'error', 'finish'] as const
  const emitter = new Emitter<typeof EMITS>()
  const options: Options = Object.assign({}, opts)

  const gif = options.gif
  // global func
  // global func
  // canvas
  const viewer = new Viewer()
  viewer.mount(gif)
  // canvas

  // player
  const player = new Player({
    viewer
  })
  player.on('finish', () => emitter.emit('finish', gif))
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
      player.onHeader(_hdr)
    })
  )
  decoder.on(
    'frame',
    withProgress((frame: Frame & Rect) => {
      player.onFrame(frame)
    })
  )
  decoder.on(
    'complete',
    withProgress((block: Block) => {
      player.framsComplete = true
      __DEV__ && console.log('decode time:', Date.now() - t)
      emitter.emit('load', gif)
    })
  )
  // /decoder

  // loader
  loadEmitter.on('load', (e: { data: gifData; key: string }) => {
    decode(e.data, e.key)
  })
  loadEmitter.on('progress', (e: ProgressEvent<EventTarget>) => {
    e.lengthComputable && viewer.drawProgress(e.loaded / e.total)
  })
  loadEmitter.on('error', (e: { message: string; key: string }) => {
    player.onError()
    viewer.drawError(e.message)
  })

  // /loader
  const getLoading = () => decoder.loading

  const decode = (data: gifData, cacheKey: string) => {
    if (getLoading()) return
    try {
      const stream = new Stream(data)
      __DEV__ && (t = Date.now())
      return decoder.parse(stream, cacheKey)
    } catch (err) {
      viewer.drawError(`load raw error with【${data.slice(0, 8)}】`)
    }
  }

  const load_url2 = async (url: string) => {
    const preload = gif.getAttribute('preload')
    const autoplay = gif.getAttribute('autoplay')
    if (preload === 'none' && (!autoplay || autoplay === 'none')) {
      return
    }
    if (getLoading()) return
    try {
      const data = await load_url(url)
      return load_raw(data!, url)
    } catch {
      viewer.drawError(`load url error with【${url}】`)
    }
  }

  const load = () => {
    const src = gif.getAttribute('src') || ''
    src && load_url2(src)
  }
  load()

  const controls2 = {
    get playing() {
      return player.playing
    },
    get sourceWidth() {
      return player.header.width
    },
    get sourceHeight() {
      return player.header.height
    },
    currentSrc: '', // 只读 地址
    defaultPlaybackRate: 1, // 默认播放速度
    playbackRate: 1, // 播放速度
    duration: 1, // 总时长 只读
    ended: 1, // 播放完毕 只读
    error: 1, // 错误 只读
    initialTime: 1, //初始播放位置（以秒为单位）。 只读
    loop: 1, //
    mediaGroup: [], // 连播
    paused: true, // 指示媒体元素是否被暂停 只读
    played: [], // 播放过的帧 只读
    preload: 'auto',
    readyState: 1 // 准备状态
  }

  const controller = {
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
    load_url: load_url2,
    load,
    load_raw,
    get frames() {
      return player.frameGroup
    },
    get_length: () => player.frameGroup.length,
    on: emitter.on,
    off: emitter.off
  }

  ;(gif as any).controller = controller

  return controller
}

export default libgif
/**
 * 下载
 * 读取字符
 * 解析
 * 播放
 *
 * TODO
 * 立即终止下载或解析，并切换下一个url
 * img标签属性
 * video标签属性
 */
