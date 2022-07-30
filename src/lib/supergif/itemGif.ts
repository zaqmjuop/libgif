import { Emitter } from './Emitter'
import { Frame, Gif89aData, Header, ImgBlock, Rect } from './type'

interface Quote {
  max_width?: number
}

export class ItemGif extends Emitter {
  readonly quote: Quote
  delay: null | number = null
  frameGroup: Frame[] = []
  data: Gif89aData
  constructor(quote: Quote, rect: { width: number; height: number }) {
    super()
    this.quote = quote
    this.data = {
      header: { logicalScreenWidth: rect.width, logicalScreenHeight: rect.height } as Header,
      gces: [],
      imgs: [],
      exts: []
    }
  }
}
