import useDemo from './useDemo' 
import libDev from '@/../lib/libgif'
import libExample from '@zaqmjuop/libgif'
 
import { GIFS } from './metaData'


const rub = useDemo(libDev, document.getElementById('dev')!)
// useDemo(libExample, document.getElementById('example')!)

// setTimeout(() => {
//   rub.load_url(GIFS[0])
//   setTimeout(() => {
//     rub.load_url(GIFS[3])
//     setTimeout(() => {
//       rub.load_url(GIFS[1])
//     }, 2000);
//   }, 2000);
// }, 2000);