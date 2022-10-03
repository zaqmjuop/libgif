import { gifData } from '../type'
import { DownloadStore } from '../store/downloaded'

const download = async (url: string) => {
  DownloadStore.addRecord(url)
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

    h.onloadstart = () => {}
    h.onload = (e) => {
      if (h.status != 200) {
        DownloadStore.setError(url, 'xhr - response')
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
      e.lengthComputable && DownloadStore.setProgress(url, e.loaded / e.total)
    }
    h.onerror = () => {
      DownloadStore.setError(url, 'xhr')
      reject('xhr')
    }
    h.send()
  })
  const data = await promise
  DownloadStore.setDownload(url, data)
  return data
}

export const load_url = async (url: string) => {
  const downloadStatus = DownloadStore.getDownloadStatus(url)
  if (downloadStatus === 'downloaded') {
    return DownloadStore.getDownload(url)
  }
  if (downloadStatus === 'none') {
    download(url)
  }

  const promise = new Promise<gifData>((resolve) => {
    const onLoad = (event: { data: gifData; key: string }) => {
      if (event.key !== url) {
        return
      }
      DownloadStore.off('downloaded', onLoad)
      resolve(event.data)
    }
    DownloadStore.on('downloaded', onLoad)
  })
  const data = await promise
  load_raw(data, url)
  return data
}

export const load_raw = (data: gifData, key: string) => {
  DownloadStore.setDownload(key, data)
}
