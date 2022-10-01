import useDemo from './useDemo'
import { createWorker } from './utils/createWorker'

// useDemo()

const myFunc = (a: number, b: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`${a},${b},${Math.random().toString().slice(-6)}`)
    }, 100)
  })
}

// const workerFunc = createWorker(myFunc)

const func2 = createWorker(function (a: number, b: number, c: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`${a},${b},${c},${Math.random().toString().slice(-6)}`)
    }, 100)
  })
})

console.log(func2)

func2(1, 2,3).then((res) => {
  console.log(res)
})
