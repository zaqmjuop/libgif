import { ArrayElement, gifData } from '../type'
import { Emitter } from '../utils/Emitter'

const EMITS = ['record', 'downloaded'] as const

const emitter = new Emitter<typeof EMITS>()

const cache: Record<string, gifData> = {}

const addRecord = (key: string) => {
  if (key in cache) {
    return
  }
  cache[key] = ''
  emitter.emit('record', { key, data: cache[key] })
}

const setDownload = (key: string, data: gifData) => {
  cache[key] = data
  emitter.emit('downloaded', { key, data: cache[key] })
}

const getDownloadStatus = (
  key: string
): ArrayElement<typeof EMITS> | 'none' => {
  if (cache[key]?.length) {
    return 'downloaded'
  }
  if (key in cache) {
    return 'record'
  }
  return 'none'
}

const getDownload = (key: string) => cache[key]

export const DownloadStore = {
  getDownloadStatus,
  addRecord,
  setDownload,
  getDownload,
  on: emitter.on,
  off: emitter.off
}
