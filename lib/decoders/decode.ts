import { DecodedStore } from '../store/decoded'
import { Stream } from './stream'
import { Gif89aDecoder } from './gif89aDecoder'
import { DecodedData, gifData } from '../type'

const setupDecode = async (
  stream: Stream,
  key: string,
  config: { opacity: number }
) => {
  const deocder = new Gif89aDecoder()
  const res = await deocder.parse(stream, key, config)
  return res
}

export const decode = async (
  gifData: gifData,
  key: string,
  config: { opacity: number }
): Promise<Required<DecodedData>> => {
  const decodeStatus = DecodedStore.getDecodeStatus(key)
  let t
  if (decodeStatus === 'complete') {
    return DecodedStore.getDecodeData(key) as Required<DecodedData>
  } else if (decodeStatus === 'none') {
    t = Date.now()
    DecodedStore.addRecord(key)
    const stream = new Stream(gifData)
    setupDecode(stream, key, config)
  }
  const promise = new Promise((resolve) => {
    const onDecode = () => {
      DecodedStore.off('complete', onDecode)
      resolve(void 0)
    }
    DecodedStore.on('complete', onDecode)
  })
  await promise
  t && console.log('解码时长', Date.now() - t, key)
  return DecodedStore.getDecodeData(key) as Required<DecodedData>
}
