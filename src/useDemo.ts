import { GIFS } from './metaData'
import libgif from '@zaqmjuop/libgif'
import { getId } from './getId'
export default (startNo = 0) => {
  const rootId = getId()
  const root = document.createElement('div')
  root.id = rootId
  root.classList.add('example')
  document.body.append(root)
  const startSrc = GIFS[startNo]
  const canvasId = getId()

  const width = 200
  const height = 200

  let scaleX = 1
  let scaleY = 1
  const scaleXId = `${canvasId}x`
  const scaleYId = `${canvasId}y`
  const rateId = `${canvasId}rate`
  const forwordId = `${canvasId}forword`
  const loopId = `${canvasId}loop`

  root.innerHTML = ` 
    <div style="margin: 8px 0">
     ${GIFS.map(
       (url, index) => `<button url="${url}">GIF${index}</button>`
     ).join(' ')}
    </div>
    <div>
    <label>
      <span>width</span>
      <input id="${scaleXId}" type="range" max=20 min=1 step=2 value=${
    scaleX * 10
  }/>
    </label>
    <label>
      <span>height</span>
      <input id="${scaleYId}" type="range" max=20 min=1 step=2 value=${
    scaleY * 10
  }/>
    </label>
    <label>
      <span>rate</span>
      <input id="${rateId}" type="range" max=20 min=0 step=2 value=${10}/>
    </label>
    <div>
      <button id=${forwordId}>forword</button>
      <button id=${loopId}>loop</button>
    </div>

    </div>
    <canvas
      id="${canvasId}" 
      width="${width}"
      height="${height}" 
    /> 
  `
  const container = document.getElementById(canvasId)! as HTMLCanvasElement
  const rub = libgif({ gif: container, src: startSrc })
  console.log(rub)
  const scaleXInput = document.getElementById(scaleXId) as HTMLInputElement
  const onXScale = () => {
    const value = scaleXInput.value
    scaleX = parseInt(scaleXInput.value) / 10
    scaleXInput.setAttribute('value', value)
    container.width = width * scaleX
  }
  const onYScale = () => {
    const value = scaleYInput.value
    scaleY = parseInt(scaleYInput.value) / 10
    scaleYInput.setAttribute('value', value)
    container.height = height * scaleY
  }
  if (scaleXInput) {
    scaleXInput.oninput = onXScale
  }
  const scaleYInput = document.getElementById(scaleYId) as HTMLInputElement
  if (scaleYInput) {
    scaleYInput.oninput = onYScale
  }

  const rateInput = document.getElementById(rateId)! as HTMLInputElement
  rateInput.oninput = () => {
    const value = parseInt(rateInput.value)
    rub.rate = value / 10
    rateInput.value = `${value}`
  }

  const forwordInput = document.getElementById(forwordId)!
  forwordInput.onclick = () => {
    rub.forward = !rub.forward
  }

  const loopInput = document.getElementById(loopId)!
  loopInput.onclick = () => {
    rub.loop = !rub.loop 
  }

  root.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement) {
      const targetUrl = e.target.getAttribute('url')
      if (targetUrl) {
        rub.loadUrl(targetUrl)
      }
    }
  })
  return rub
}
