import { Stream } from './stream'
import { Viewer } from './viewer'

interface LoaderQuote {
  stream: Stream
  viewer: Viewer
  doParse: () => void
  load_setup: (
    callback?: ((gif: HTMLImageElement) => void) | undefined
  ) => boolean
  gif: HTMLImageElement
}
export class Loader {
  readonly quote: LoaderQuote
  constructor(quote: LoaderQuote) {
    this.quote = quote
  }
  load_url = (src: string, callback?: (gif: HTMLImageElement) => void) => {
    if (!this.quote.load_setup(callback)) return

    let h = new XMLHttpRequest()
    // new browsers (XMLHttpRequest2-compliant)
    h.open('GET', src, true)

    if ('overrideMimeType' in h) {
      h.overrideMimeType('text/plain; charset=x-user-defined')
    }

    // old browsers (XMLHttpRequest-compliant)
    else if ('responseType' in h) {
      h.responseType = 'arraybuffer'
    }

    // IE9 (Microsoft.XMLHTTP-compliant)
    else {
      h.setRequestHeader('Accept-Charset', 'x-user-defined')
    }

    h.onloadstart = () => {
      // Wait until connection is opened to replace the gif element with a canvas to avoid a blank img
      if (!this.quote.viewer.initialized) this.quote.viewer.init()
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

      this.quote.stream = new Stream(data)
      setTimeout(this.quote.doParse, 0)
    }
    h.onprogress = (e) => {
      if (e.lengthComputable)
        this.quote.viewer.doShowProgress(e.loaded, e.total, true)
    }
    h.onerror = () => {
      this.quote.viewer.doLoadError('xhr')
    }
    h.send()
  }
  load(callback?: (gif: HTMLImageElement) => void) {
    this.load_url(
      this.quote.gif.getAttribute('rel:animated_src') || this.quote.gif.src,
      callback
    )
  }

  load_raw(arr, callback) {
    if (!this.quote.load_setup(callback)) return
    if (!this.quote.viewer.initialized) this.quote.viewer.init()
    this.quote.stream = new Stream(arr)
    setTimeout(this.quote.doParse, 0)
  }
}
