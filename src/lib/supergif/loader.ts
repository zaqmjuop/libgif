import mitt from 'mitt'
import { Stream } from './stream'
import { Viewer } from './viewer'
import { valuesType, func } from './type'

interface LoaderQuote {
  stream: Stream
  viewer: Viewer
  doParse: () => void
  load_setup: (
    callback?: ((gif: HTMLImageElement) => void) | undefined
  ) => boolean
  gif: HTMLImageElement
}
const EMITS = ['loadstart', 'load', 'progress', 'error'] as const

export class Loader {
  private readonly emitter = mitt<Record<valuesType<typeof EMITS>, unknown>>()
  readonly quote: LoaderQuote
  constructor(quote: LoaderQuote) {
    this.quote = quote
  }
  on(type: valuesType<typeof EMITS>, func: func) {
    return this.emitter.on(type, func)
  }

  load_url(src: string, callback?: (gif: HTMLImageElement) => void) {
    if (!this.quote.load_setup(callback)) return

    const h = new XMLHttpRequest()
    // new browsers (XMLHttpRequest2-compliant)
    h.open('GET', src, true)

    if ('overrideMimeType' in h) {
      h.overrideMimeType('text/plain; charset=x-user-defined')
    } else if ('responseType' in h) {
      // old browsers (XMLHttpRequest-compliant)
      h.responseType = 'arraybuffer'
    } else {
      // IE9 (Microsoft.XMLHTTP-compliant)
      h.setRequestHeader('Accept-Charset', 'x-user-defined')
    }

    h.onloadstart = () => {
      this.emitter.emit('loadstart')
    }
    h.onload = (e) => {
      if (h.status != 200) {
        this.quote.viewer.doLoadError('xhr - response')
      }
      // emulating response field for IE9
      if (!('response' in h)) {
        Object.assign(this, {
          response: new window.VBArray(h.responseText)
            .toArray()
            .map(String.fromCharCode)
            .join('')
        })
      }
      let data = h.response
      if (data.toString().indexOf('ArrayBuffer') > 0) {
        data = new Uint8Array(data)
      }
      this.emitter.emit('load', data)
    }
    h.onprogress = (e) => {
      this.emitter.emit('progress', e)
    }
    h.onerror = () => {
      this.emitter.emit('error', 'xhr')
    }
    h.send()
  }
  load(callback?: (gif: HTMLImageElement) => void) {
    this.load_url(
      this.quote.gif.getAttribute('rel:animated_src') || this.quote.gif.src,
      callback
    )
  }
}
