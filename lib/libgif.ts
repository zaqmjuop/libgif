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
  // player
  // DecodedStore
  const withProgress = (fn: Function) => {
    return (...args) => {
      fn(...args)
      const download = DownloadStore.getDownload(currentKey)
      viewer.drawProgress(download.progress)
    }
  }

  const listenDecode = () => {
    const onHeader = (e: { header: Header; key: string }) => {
      if (currentKey !== e.key) {
        return
      }
      player.onHeader(e.header)
    }
    const onFrame = (e: { frames: frame[]; key: string }) => {
      if (currentKey !== e.key) {
        return
      }
      player.onFrame(e.frames[e.frames.length - 1])
    }

    const onComplete = () => {
      player.framsComplete = true
    }

    DecodedStore.on('header', withProgress(onHeader))
    DecodedStore.on('frame', withProgress(onFrame))
    DecodedStore.on('complete', withProgress(onComplete))
    return () => {
      DecodedStore.off('header', withProgress(onHeader))
      DecodedStore.off('frame', withProgress(onFrame))
      DecodedStore.off('complete', withProgress(onComplete))
    }
  }

  // /DecodedStore

  // DownloadStore
  const listenDownload = () => {
    const onProgress = (e: { key: string } & DownloadRecord) => {
      if (e.key !== currentKey) {
        return
      }
      viewer.drawProgress(e.progress)
    }
    const onError = (e: { key: string } & DownloadRecord) => {
      if (e.key !== currentKey) {
        return
      }
      player.onError()
      viewer.drawError(e.error || '')
    }
    DownloadStore.on('progress', onProgress)
    DownloadStore.on('error', onError)
    return () => {
      DownloadStore.off('progress', onProgress)
      DownloadStore.off('error', onError)
    }
  }
  // /DownloadStore

  const start = async (url: string) => {
    currentKey = url

    try {
      const unListenDownload = listenDownload()
      const downloadData = await load_url(url)
      unListenDownload()

      const stream = new Stream(downloadData.data)
      const unListenDecode = listenDecode()
      const decoded = await decode(stream, url, { opacity: options.opacity })
      unListenDecode()
      return
    } catch {
      viewer.drawError(`load url error with【${url}】`)
    }
  }
  // preload & autoplay
  const preload = gif.getAttribute('preload')
  const autoplay = gif.getAttribute('autoplay')
  if (autoplay) {
    start(currentKey)
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
    start,
    get frames() {
      return player.frameGroup
    },
    get_length: () => player.frameGroup.length,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter)
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
