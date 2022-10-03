import { ArrayElement, DownloadEvent, DownloadRecord, gifData } from '../type'
import { Emitter } from '../utils/Emitter'


const EMITS = ['record','error', 'progress', 'downloaded'] as const

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
  emitter.emit('record', { key, cache: cache[key] })
}

const setDownload = (key: string, data: gifData) => {
  cache[key] = cache[key] || defaultRecord()
  cache[key].data = data
  emitter.emit('downloaded', { key, cache: cache[key] })
}

const setProgress = (key: string, progress: number, data?: gifData) => {
  cache[key] = cache[key] || defaultRecord()
  cache[key].progress = progress
  if (data) {
    cache[key].data = data
  }
  emitter.emit('progress', { key, cache: cache[key] })
}

const setError = (key: string, error: string ) => {
  cache[key] = cache[key] || defaultRecord()
  cache[key].error = error
  emitter.emit('error', { key, cache: cache[key] })
}

const getDownloadStatus = (
  key: string
): ArrayElement<typeof EMITS> | 'none' => {
  if (cache[key]?.progress >= 99) {
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
