import { Emitter } from './utils/Emitter'
import { load_url } from './utils/loader'
import { Player } from './player'
import { decode } from './decoders/decode'
import { DownloadRecord, LibgifInitOptions } from './type'
import { Viewer } from './viewer'
import { DownloadStore } from './store/downloaded'
import { DecodedStore } from './store/decoded'
import { READY_STATE } from './utils/metaData'

const OPACITY = 255

const libgif = (opts: LibgifInitOptions) => {
  const EMITS = [
    'error',
    'play',
    'frameChange',
    'pause',
    'playended',
    'decoded',
    'downloaded',
    'progress'
  ] as const
  const emitter = new Emitter<typeof EMITS>()
  const gif = opts.gif

  let status: number
  let currentKey = opts.src || ''
  // global func
  // global func
  // canvas
  const viewer = new Viewer()
  viewer.mount(gif)
  // canvas

  // player
  const player = new Player({
    viewer,
    beginFrameNo: opts.beginFrameNo,
    forword: opts.forword,
    rate: opts.rate,
    loop: opts.loop,
    autoplay: opts.autoplay
  })
  // player
  // DownloadStore
  const onError = (e: { key: string } & DownloadRecord) => {
    if (e.key !== currentKey) {
      return
    }
    player.onError()
    viewer.drawError(e.error || '')
    emitter.emit('error', e)
  }
  DownloadStore.on('error', onError)
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
        await decode(downloadData.data!, url, { opacity: OPACITY })
        status = READY_STATE.DECODED
      } else if (hasDownloaded !== 'none') {
        status = READY_STATE.DOWNLOADING
        const downloadData = await load_url(url)
        status = READY_STATE.DOWNLOADED
        player.switch(url)
        await decode(downloadData.data, url, { opacity: OPACITY })
        status = READY_STATE.DECODED
      } else {
        status = READY_STATE.UNDOWNLOAD
        const downloadData = await load_url(url)
        status = READY_STATE.DOWNLOADED
        player.switch(url)
        await decode(downloadData.data, url, { opacity: OPACITY })
        status = READY_STATE.DECODED
      }
    } catch {
      const event = { error: `load url error with【${url}】` }
      viewer.drawError(event.error)
      emitter.emit('error', event)
    }
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
    get loop() {
      return player.loop
    },
    set loop(val: boolean) {
      player.loop = val
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
  player.on('playended', (e) => emitter.emit('playended', e))
  DecodedStore.on('decoded', (e) => emitter.emit('decoded', e))
  DownloadStore.on('downloaded', (e) => emitter.emit('downloaded', e))
  DownloadStore.on('progress', (e) => emitter.emit('progress', e))
  ;(gif as any).controller = controller

  currentKey &&  loadUrl(currentKey)

  return controller
}

export default libgif
