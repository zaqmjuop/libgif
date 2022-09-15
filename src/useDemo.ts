
import { GIFS } from './metaData'
import libDev from '@/../lib/libgif'
export default () => {
  const root = document.getElementById('useDemo')!
  const src = GIFS[1]
  const id = Math.random().toString().slice(2)


  root.innerHTML = ` 
    <div style="margin: 8px 0">
     ${GIFS.map((url, index) => `<button url="${url}">GIF${index}</button>`).join(' ')}
    </div>
    <div
    id="${id}"
    src="${src}"
    rel:animated_src="${src}"
    width="300"
    height="300"
    rel:auto_play="1"
    rel:rubbable="1"
    /> 
  `
  const container = document.getElementById(id)!
  const rub = (libDev)({ gif: container })
  rub.load()

  root.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement) {
      const targetUrl = e.target.getAttribute('url')
      if (targetUrl) {
        rub.load_url(targetUrl)
      }
    }
  })
  return rub
}
