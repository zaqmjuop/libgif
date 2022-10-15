import { Emitter } from './utils/Emitter'
import { load_url } from './utils/loader'
import { bindSelf } from './utils/bindSelf'
import { Player } from './player'
import { decode } from './decoders/decode'
import { DownloadRecord, LibgifInitOptions } from './type'
import { Viewer } from './viewer'
import { DownloadStore } from './store/downloaded'
import { DecodedStore } from './store/decoded'

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
    try {
      if (DownloadStore.getDownloadStatus(url) === 'none') {
        load_url(url)
      }
      if (DecodedStore.getDecodeStatus(url) === 'none') {
        decode(url, { opacity: OPACITY })
      }
      player.switch(url)
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
    play: bindSelf(player, 'play')!,
    pause: bindSelf(player, 'pause')!,
    jumpTo: bindSelf(player, 'putFrame')!,
    loadUrl: loadUrl,
    // decodeStore
    getDecodeData: bindSelf(DecodedStore, 'getDecodeData')!,
    // DownloadStore
    getDownload: bindSelf(DownloadStore, 'getDownload')!,
    // emiter
    on: bindSelf(emitter, 'on')!,
    off: bindSelf(emitter, 'off')!
  }

  player.on('play', (e) => emitter.emit('play', e))
  player.on('frameChange', (e) => emitter.emit('frameChange', e))
  player.on('pause', (e) => emitter.emit('pause', e))
  player.on('playended', (e) => emitter.emit('playended', e))
  DecodedStore.on('decoded', (e) => emitter.emit('decoded', e))
  DownloadStore.on('downloaded', (e) => emitter.emit('downloaded', e))
  DownloadStore.on('progress', (e) => emitter.emit('progress', e))
  ;(gif as any).controller = controller

  currentKey && loadUrl(currentKey)

  return controller
}

export default libgif
