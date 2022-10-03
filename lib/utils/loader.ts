import { gifData } from '../type'
import { Emitter } from './Emitter'

const downloadCache: Record<string, gifData> = {}

const EMITS = ['loadstart', 'load', 'progress', 'error'] as const

export class Loader extends Emitter<typeof EMITS> {
  private _loading = false

  get loading() {
    return this._loading
  }

  async load_url(url: string) {
    if (this._loading) return
    this._loading = true
    let data: gifData

    if (downloadCache[url]) {
      data = downloadCache[url]
    } else {
      const promise = new Promise<gifData>((resolve, reject) => {
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
            reject('xhr - response')
          }
          // emulating response field for IE9
          if (!('response' in h)) {
            Object.assign(this, {
              response: new window.VBArray(h.responseText as any)
                .toArray()
                .map(String.fromCharCode as any)
                .join('')
            })
          }
          let data: gifData = ''
          if (typeof h.response === 'string') {
            data = h.response
          } else if (h.response.toString().indexOf('ArrayBuffer') > 0) {
            data = new Uint8Array(h.response)
          }
          resolve(data)
        }
        h.onprogress = (e) => {
          this.emit('progress', e)
        }
        h.onerror = () => {
          this.emit('error', 'xhr')
          reject('xhr')
        }
        h.send()
      })
      data = await promise
      downloadCache[url] = data
    }

    return this.onLoad(data)
  }
  load_raw = (data: gifData) => {
    if (this._loading) return
    this._loading = true
    this.onLoad(data)
  }
  private onLoad(data: gifData) {
    this._loading = false
    this.emit('load', data)
    return data
  }
}
