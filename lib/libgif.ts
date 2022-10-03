import { Emitter } from './utils/Emitter'
import { load_url, load_raw } from './utils/loader'
import { Player } from './player'
import { decode } from './decoders/decode'
import { Stream } from './decoders/stream'
import { DownloadRecord, frame, gifData, Header, Options } from './type'
import { Viewer } from './viewer'
import { __DEV__ } from './utils/metaData'
import { DownloadStore } from './store/downloaded'
import { DecodedStore } from './store/decoded'

const libgif = (opts: Options) => {
  let t = 0
  const EMITS = ['loadstart', 'load', 'progress', 'error', 'finish'] as const
  const emitter = new Emitter<typeof EMITS>()
  const options: Required<Options> = Object.assign(
    {
      opacity: 255
    },
    opts
  )
  const gif = options.gif
  let currentKey = gif.getAttribute('src') || ''
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
  // DecodedStore
  const withProgress = (fn: Function) => {
    return (...args) => {
      fn(...args)
      const download = DownloadStore.getDownload(currentKey)
      viewer.drawProgress(download.progress)
    }
  }
  DecodedStore.on(
    'header',
    withProgress((e: { header: Header; key: string }) => {
      if (currentKey !== e.key) {
        return
      }
      player.onHeader(e.header)
    })
  )
  DecodedStore.on(
    'frame',
    withProgress((e: { frames: frame[]; key: string }) => {
      if (currentKey !== e.key) {
        return
      }
      player.onFrame(e.frames[e.frames.length - 1])
    })
  )
  DecodedStore.on(
    'complete',
    withProgress(() => {
      player.framsComplete = true
      __DEV__ && console.log('decode time:', Date.now() - t)
      emitter.emit('load', gif)
    })
  )
  // /DecodedStore

  // DownloadStore
  DownloadStore.on(
    'downloaded',
    (e: { key: string } & Required<DownloadRecord>) => {
      if (e.key !== currentKey) {
        return
      }
      const data = e.data
      try {
        const stream = new Stream(data)
        __DEV__ && (t = Date.now())
        return decode(stream, e.key, { opacity: options.opacity })
      } catch (err) {
        viewer.drawError(`load raw error with【${data.slice(0, 8)}】`)
      }
    }
  )
  DownloadStore.on('progress', (e: { key: string } & DownloadRecord) => {
    if (e.key !== currentKey) {
      return
    }
    viewer.drawProgress(e.progress)
  })
  DownloadStore.on('error', (e: { key: string } & DownloadRecord) => {
    if (e.key !== currentKey) {
      return
    }
    player.onError()
    viewer.drawError(e.error || '')
  })

  // /DownloadStore

  const load_url2 = async (url: string) => {
    currentKey = url
    try {
      return load_url(url)
    } catch {
      viewer.drawError(`load url error with【${url}】`)
    }
  }
  // preload & autoplay
  const preload = gif.getAttribute('preload')
  const autoplay = gif.getAttribute('autoplay')
  if (autoplay) {
    load_url2(currentKey)
  }

  // const controls2 = {
  //   get playing() {
  //     return player.playing
  //   },
  //   get sourceWidth() {
  //     return player.header.width
  //   },
  //   get sourceHeight() {
  //     return player.header.height
  //   },
  //   currentSrc: '', // 只读 地址
  //   defaultPlaybackRate: 1, // 默认播放速度
  //   playbackRate: 1, // 播放速度
  //   duration: 1, // 总时长 只读
  //   ended: 1, // 播放完毕 只读
  //   error: 1, // 错误 只读
  //   initialTime: 1, //初始播放位置（以秒为单位）。 只读
  //   loop: 1, //
  //   mediaGroup: [], // 连播
  //   paused: true, // 指示媒体元素是否被暂停 只读
  //   played: [], // 播放过的帧 只读
  //   preload: 'auto',
  //   readyState: 1 // 准备状态
  // }

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
    get_auto_play: () => options,
    load_url: load_url2,
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
