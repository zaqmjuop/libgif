import { DecodedStore } from '../store/decoded'
import { Stream } from './stream'
import { Gif89aDecoder } from './gif89aDecoder'
import { DecodedData, DownloadProgressEvent, gifData } from '../type'
import { DownloadStore } from '../store/downloaded'

const setupDecode = async (key: string, config: { opacity: number }) => {
  DecodedStore.addRecord(key)
  const downloadRecord = DownloadStore.getDownload(key)
  const stream = new Stream(downloadRecord.data || '')
  DownloadStore.on('progress', (e: DownloadProgressEvent) => {
    e.key === key && stream.setData(e.data)
  })

  const deocder = new Gif89aDecoder()
  const res = await deocder.parse(stream, key, config)
  return res
}

export const decode = async (
  key: string,
  config: { opacity: number }
): Promise<Required<DecodedData>> => {
  const decodeStatus = DecodedStore.getDecodeStatus(key)
  if (decodeStatus === 'decoded') {
    return DecodedStore.getDecodeData(key) as Required<DecodedData>
  } else if (decodeStatus === 'none') {
    setupDecode(key, config)
  }
  const promise = new Promise((resolve) => {
    const onDecode = () => {
      DecodedStore.off('decoded', onDecode)
      resolve(void 0)
    }
    DecodedStore.on('decoded', onDecode)
  })
  await promise
  return DecodedStore.getDecodeData(key) as Required<DecodedData>
}
