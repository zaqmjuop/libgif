import { GIFS,  PNGS } from './metaData'
import libgif from '@/../lib/libgif'
const src = GIFS[1]
const app = document.getElementById('app')
app!.innerHTML = `
<div
id="container"
src="${src}"
rel:animated_src="${src}"
width="300"
height="300"
rel:auto_play="1"
rel:rubbable="1"
/>
`
const container = document.getElementById('container')
const rub = libgif({ gif: container! })
rub.load()