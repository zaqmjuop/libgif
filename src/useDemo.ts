 
import { GIFS } from './metaData'
export default <T extends any>(lib: T, root: HTMLElement) => {
  const src = GIFS[1]
  const id = Math.random().toString().slice(2)
  root.innerHTML = `
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
  const container = document.getElementById(id) 
  const rub = (lib as any)({ gif: container! })
  rub.load()
}
