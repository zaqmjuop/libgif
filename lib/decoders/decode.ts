import { DecodedStore } from '../store/decoded'
import { Stream } from './stream'
import { Gif89aDecoder } from './gif89aDecoder'

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
  stream: Stream,
  key: string,
  config: { opacity: number }
) => {
  const decodeStatus = DecodedStore.getDecodeStatus(key)
  if (decodeStatus === 'complete') {
    return DecodedStore.getDecodeData(key)
  } else if (decodeStatus === 'none') {
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
  return DecodedStore.getDecodeData(key)
}
