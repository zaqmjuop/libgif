type callback = (this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => void
export const request = (
  src: string,
  options: {
    onloadstart?: callback
    onload?: callback
    onprogress?: callback
    onerror?: callback
  } = {}
) => {
  const h = new XMLHttpRequest()
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
  h.onloadstart = options.onloadstart || null
  h.onload = options.onload || null
  h.onprogress = options.onprogress || null
  h.onerror = options.onerror || null
  h.send()
}
