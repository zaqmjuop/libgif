import { ArrayElement, Block, DecodedData, frame, Header } from '../type'
import { Emitter } from '../utils/Emitter'

const EMITS = ['header', 'record', 'block', 'frame', 'decoded'] as const

const emitter = new Emitter<typeof EMITS>()

const cache: Record<string, DecodedData> = {}

const defaultDecodedData = (): DecodedData => ({
  header: void 0,
  frames: [],
  blocks: [],
  complete: false
})

const addRecord = (key: string) => {
  cache[key] = cache[key] || defaultDecodedData()
  emitter.emit('record', { key, ...cache[key] })
}

const setHeader = (key: string, header: Header) => {
  cache[key] = cache[key] || defaultDecodedData()
  cache[key].header = header
  emitter.emit('header', { key, ...cache[key] })
}

const pushFrames = (key: string, frames: frame[]) => {
  cache[key] = cache[key] || defaultDecodedData()
  cache[key].frames.push(...frames)
  emitter.emit('frame', { key, ...cache[key] })
}

const pushBlocks = (key: string, blocks: Block[]) => {
  cache[key] = cache[key] || defaultDecodedData()
  cache[key].blocks.push(...blocks)
  emitter.emit('block', { key, ...cache[key] })
}

const setComplete = (key: string) => {
  cache[key] = cache[key] || defaultDecodedData()
  cache[key].complete = true
  emitter.emit('decoded', { key, ...cache[key] })
}

const getDecodeStatus = (key: string): ArrayElement<typeof EMITS> | 'none' => {
  if (cache[key]?.complete) {
    return 'decoded'
  } else if (cache[key]?.frames.length) {
    return 'frame'
  } else if (cache[key]?.header) {
    return 'header'
  }
  return 'none'
}

const getDecodeData = (key: string) => cache[key]

export const DecodedStore = {
  getDecodeStatus,
  addRecord,
  setHeader,
  pushBlocks,
  pushFrames,
  setComplete,
  getDecodeData,
  on: emitter.on.bind(emitter),
  off: emitter.off.bind(emitter)
}
