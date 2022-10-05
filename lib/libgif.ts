import { Emitter } from './utils/Emitter'
import { load_url } from './utils/loader'
import { Player } from './player'
import { decode } from './decoders/decode'
import { DownloadRecord, frame, Header, Options } from './type'
import { Viewer } from './viewer'
import { DownloadStore } from './store/downloaded'
import { DecodedStore } from './store/decoded'

const READY_STATE = {
  UNDOWNLOAD: 0,
  DOWNLOADING: 1,
  DOWNLOADED: 2,
  DECODING: 3,
  DECODED: 4
} as const

const libgif = (opts: Options) => {
  const EMITS = [
    'play',
    'frameChange',
    'pause',
    'decoded',
    'downloaded'
  ] as const
  const emitter = new Emitter<typeof EMITS>()
  const options: Required<Options> = Object.assign(
    {
      opacity: 255
    },
    opts
  )
  Object.defineProperties
  const gif = options.gif
  let status: number
  let currentKey = gif.getAttribute('src') || ''
  // global func
  // global func
  // canvas
  const viewer = new Viewer()
  viewer.mount(gif)
  // canvas

  // player
  const player = new Player({ viewer })
  // player
  // DownloadStore
  const withProgress = (fn: Function) => {
    return (...args) => {
      fn(...args)
      const download = DownloadStore.getDownload(currentKey)
      download?.progress && viewer.drawProgress(download.progress)
    }
  }
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
  DownloadStore.on('progress', withProgress(onProgress))
  DownloadStore.on('error', withProgress(onError))
  // /DownloadStore

  const loadUrl = async (url: string) => {
    currentKey = url
    const hasDecoded = DecodedStore.getDecodeStatus(url)
    const hasDownloaded = DownloadStore.getDownloadStatus(url)
    try {
      if (hasDecoded === 'decoded') {
        status = READY_STATE.DECODED
        player.switch(url)
      } else if (hasDecoded !== 'none') {
        status = READY_STATE.DECODING
        player.switch(url)
      } else if (hasDownloaded === 'downloaded') {
        status = READY_STATE.DOWNLOADED
        const downloadData = await DownloadStore.getDownload(url)
        player.switch(url)
        await decode(downloadData.data!, url, {
          opacity: options.opacity
        })
        status = READY_STATE.DECODED
      } else if (hasDownloaded !== 'none') {
        status = READY_STATE.DOWNLOADING
        const downloadData = await load_url(url)
        status = READY_STATE.DOWNLOADED
        player.switch(url)
        await decode(downloadData.data, url, {
          opacity: options.opacity
        })
        status = READY_STATE.DECODED
      } else {
        status = READY_STATE.UNDOWNLOAD
        const downloadData = await load_url(url)
        status = READY_STATE.DOWNLOADED
        player.switch(url)
        await decode(downloadData.data, url, {
          opacity: options.opacity
        })
        status = READY_STATE.DECODED
      }
    } catch {
      viewer.drawError(`load url error with【${url}】`)
    }
  }
  // preload & autoplay
  const preload = gif.getAttribute('preload')
  const autoplay = gif.getAttribute('autoplay')
  if (autoplay) {
    loadUrl(currentKey)
  }

  const controller = {
    // player
    get playing() {
      return player.playing
    },
    get loopCount() {
      return player.loopCount
    },
    get currentKey() {
      return player.currentKey
    },
    get currentFrameNo() {
      return player.currentFrameNo
    },
    get rate() {
      return player.rate
    },
    set rate(val: number) {
      player.rate = val
    },
    get forward() {
      return player.forward
    },
    set forward(val: boolean) {
      player.forward = val
    },
    play: player.play,
    pause: player.pause,
    loadUrl: loadUrl,
    // decodeStore
    getDecodeData: DecodedStore.getDecodeData,
    // DownloadStore
    getDownload: DownloadStore.getDownload,
    // emiter
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter)
  }

  player.on('play', (e) => emitter.emit('play', e))
  player.on('frameChange', (e) => emitter.emit('frameChange', e))
  player.on('pause', (e) => emitter.emit('pause', e))
  DecodedStore.on('decoded', (e) => emitter.emit('decoded', e))
  DownloadStore.on('downloaded', (e) => emitter.emit('downloaded', e))
  ;(gif as any).controller = controller

  return controller
}

export default libgif
