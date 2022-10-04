import { GIFS } from './metaData'
import libDev from '@/../lib/libgif'
import libgif from '@zaqmjuop/libgif'
export default () => {
  const root = document.getElementById('useDemo')!
  const src = GIFS[1]
  const id = Math.random().toString().slice(2)

  const width = 200
  const height = 200

  let scaleX = 1
  let scaleY = 1

  const onScaleX = (e) => {
    console.log(e)
  }

  root.innerHTML = ` 
    <div style="margin: 8px 0">
     ${GIFS.map(
       (url, index) => `<button url="${url}">GIF${index}</button>`
     ).join(' ')}
    </div>
    <div>
    <label>
      <span>width scale:</span>
      <input id="scaleXInput" type="range" max=20 min=1 step=2 value=${
        scaleX * 10
      }/>
    </label>
    <label>
      <span>height scale:</span>
      <input id="scaleYInput" type="range" max=20 min=1 step=2 value=${
        scaleY * 10
      }/>
    </label>
    </div>
    <canvas
      id="${id}"
      src="${src}" 
      width="${width}"
      height="${height}" 
      poster="poster"
      autoplay="autoplay"
    /> 
  `
  const container = document.getElementById(id)! as HTMLCanvasElement
  const scaleXInput = document.getElementById('scaleXInput') as HTMLInputElement
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
  const scaleYInput = document.getElementById('scaleYInput') as HTMLInputElement
  if (scaleYInput) {
    scaleYInput.oninput = onYScale
  }

  const rub = libDev({ gif: container })
  console.log(rub)

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
