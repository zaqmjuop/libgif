import { gifData } from '../type'
import { Emitter } from './Emitter'
import { downloadCache } from '../cache'

const EMITS = ['loadstart', 'load', 'progress', 'error', 'download'] as const

export const loadEmitter = new Emitter<typeof EMITS>()

export const getDownloadState = (key: string) => {
  if (downloadCache[key]?.length) {
    return 'load'
  }
  if (key in downloadCache) {
    return 'loadstart'
  }
  return 'unload'
}

const download = async (url: string) => {
  downloadCache[url] = ''
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
      loadEmitter.emit('loadstart', { key: url })
    }
    h.onload = (e) => {
      if (h.status != 200) {
        loadEmitter.emit('error', { key: url, message: 'xhr - response' })
        reject('xhr - response')
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
      loadEmitter.emit('progress', { ...e, key: url })
    }
    h.onerror = () => {
      loadEmitter.emit('error', { key: url, message: 'xhr' })
      reject('xhr')
    }
    h.send()
  })
  const data = await promise
  downloadCache[url] = data
  loadEmitter.emit('download', { data, key: url })
  return data
}

export const load_url = async (url: string) => {
  const downloadState = getDownloadState(url)
  if (downloadState === 'load') {
    return downloadCache[url]
  }
  if (downloadState === 'unload') {
    download(url)
  }

  const promise = new Promise<gifData>((resolve) => {
    const onLoad = (event: { data: gifData; key: string }) => {
      loadEmitter.off('download', onLoad)
      resolve(event.data)
    }
    loadEmitter.on('download', onLoad)
  })
  const data = await promise
  loadEmitter.emit('load', { data, key: url })
  return data
}

export const load_raw = (data: gifData, key: string) => {
  downloadCache[key] = data
  loadEmitter.emit('load', { data, key })
}
