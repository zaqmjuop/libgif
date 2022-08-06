import { Emitter } from './Emitter'

const EMITS = ['loadstart', 'load', 'progress', 'error'] as const

export class Loader extends Emitter<typeof EMITS> {
  private _loading = false

  get loading() {
    return this._loading
  }

  load_url(url: string) {
    if (this._loading) return
    this._loading = true

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
      this.onLoad(data)
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
    if (this._loading) return
    this._loading = true
    this.onLoad(data)
  }
  private onLoad(data: string | Uint8Array) {
    this._loading = false
    this.emit('load', data)
  }
}
