import { Emitter } from './Emitter'

interface LoaderQuote {
  load_setup: () => boolean
}
const EMITS = ['loadstart', 'load', 'progress', 'error'] as const

export class Loader extends Emitter<typeof EMITS> {
  readonly quote: LoaderQuote
  constructor(quote: LoaderQuote) {
    super()
    this.quote = quote
  }

  load_url(url: string) {
    if (!this.quote.load_setup()) return

    const h = new XMLHttpRequest()
    // new browsers (XMLHttpRequest2-compliant)
    h.open('GET', url, true)

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
      this.emit('loadstart')
    }
    h.onload = (e) => {
      if (h.status != 200) {
        this.emit('error', 'xhr - response')
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
      this.emit('load', data)
    }
    h.onprogress = (e) => {
      this.emit('progress', e)
    }
    h.onerror = () => {
      this.emit('error', 'xhr')
    }
    h.send()
  }
  load_raw = (data: string | Uint8Array) => {
    if (!this.quote.load_setup()) return
    this.emit('load', data)
  }
}
