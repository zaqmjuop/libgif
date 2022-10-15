import {
  ArrayElement,
  DownloadProgressEvent,
  DownloadRecord,
  gifData
} from '../type'
import { Emitter } from '../utils/Emitter'

const EMITS = ['record', 'error', 'progress', 'downloaded'] as const

const emitter = new Emitter<typeof EMITS>()

const defaultRecord = (): DownloadRecord => {
  return {
    data: void 0,
    progress: 0,
    error: void 0
  }
}

const cache: Record<string, DownloadRecord> = {}

const addRecord = (key: string) => {
  if (key in cache) {
    return
  }
  cache[key] = defaultRecord()
  const eventData = { ...cache[key], key }
  emitter.emit('record', eventData)
}

const setDownload = (key: string, data: gifData) => {
  cache[key] = cache[key] || defaultRecord()
  cache[key].data = data
  const progress = 100
  cache[key].progress = progress
  const eventData: DownloadProgressEvent = { key, data, progress }
  emitter.emit('downloaded', eventData)
}

const setProgress = (key: string, progress: number, data: gifData) => {
  cache[key] = cache[key] || defaultRecord()
  cache[key].progress = progress
  cache[key].data = data
  const eventData: DownloadProgressEvent = { key, data, progress }
  emitter.emit('progress', eventData)
}

const setError = (key: string, error: string) => {
  cache[key] = cache[key] || defaultRecord()
  cache[key].error = error
  const eventData = { ...cache[key], key }
  emitter.emit('error', eventData)
}

const getDownloadStatus = (
  key: string
): ArrayElement<typeof EMITS> | 'none' => {
  if (cache[key]?.progress >= 100) {
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
  setProgress,
  setError,
  setDownload,
  getDownload,
  on: emitter.on.bind(emitter),
  off: emitter.off.bind(emitter)
}
