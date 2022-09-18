import { Emitter } from './utils/Emitter'
import { gifData, Loader } from './utils/loader'
import { Gif89aDecoder } from './decoders/gif89aDecoder'
import { Player } from './player'
import { Stream } from './decoders/stream'
import { AppExtBlock, Block, Frame, Header, Options, Rect } from './type'
import { Viewer } from './viewer'
import Worker from './worker.ts?worker'
import { __DEV__ } from './utils/metaData'

const libgif = (opts: Options) => {
  let t = 0
  const worker = new Worker()
  worker.addEventListener('message', (e) => {
    console.log('libgif', e)
  })
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
    overrideLoopMode: options.loop_mode !== false,
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
      __DEV__ && console.log('decode time:', Date.now() - t)
      emitter.emit('load', gif)
    })
  )
  // /decoder

  // loader

  const loader = new Loader()
  loader.on('load', (data: gifData) => {
  })
  loader.on('progress', (e: ProgressEvent<EventTarget>) => {
    e.lengthComputable && viewer.drawProgress(e.loaded / e.total)
  })
  loader.on('error', (message: string) => {
    player.onError()
    viewer.drawError(message)
  })


  // /loader
  const getLoading = () => loader.loading || decoder.loading

  const decode = (data: gifData) => {
    if (getLoading()) return
    try {
      const stream = new Stream(data)
      __DEV__ && (t = Date.now())
      return decoder.parse(stream)
    } catch (err) {
      viewer.drawError(`load raw error with【${data.slice(0, 8)}】`)
    }
  }

  const load_url = async (url: string) => {
    if (getLoading()) return
    try {
      const data = await loader.load_url(url)
      return load_raw(data!)
    } catch {
      viewer.drawError(`load url error with【${url}】`)
    }
  }

  const load_raw = (data: gifData) => {
    return decode(data)
  }

  const load = () => load_url(
    gif.getAttribute('rel:animated_src') || gif.getAttribute('src') || ''
  )


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

export default libgif
/**
 * 下载
 * 读取字符
 * 解析
 * 播放
 *
 * TODO
 * 立即终止下载或解析，并切换下一个url
 * png编码
 * 解码器 web worker 计算
 */
