export const download = async (
  src: string,
  handers: {
    onloadstart?: (this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => void
    onprogress?: (this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => void
  } = {}
): Promise<string | Uint8Array> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', src, true)
    if ('overrideMimeType' in xhr) {
      xhr.overrideMimeType('text/plain; charset=x-user-defined')
    } else if ('responseType' in xhr) {
      // old browsers (XMLHttpRequest-compliant)
      xhr.responseType = 'arraybuffer'
    } else {
      // IE9 (Microsoft.XMLHTTP-compliant)
      xhr.setRequestHeader('Accept-Charset', 'x-user-defined')
    }
    xhr.onloadstart = handers.onloadstart || null
    xhr.onload = () => {
      if (xhr.status !== 200) {
        reject(new Error('fail'))
      }
      // emulating response field for IE9
      if (!('response' in xhr)) {
        ;(xhr as any).response = new (window as any).VBArray(xhr.responseText)
          .toArray()
          .map(String.fromCharCode)
          .join('')
      }
      const data = xhr.response
      if (data instanceof ArrayBuffer) {
        resolve(new Uint8Array(data))
      } else if (typeof data === 'string') {
        resolve(data || '')
      } else {
        resolve('')
      }
    }
    xhr.onprogress = handers.onprogress || null
    xhr.onerror = () => {
      reject(new Error('fail'))
    }
    xhr.send()
  })
}
