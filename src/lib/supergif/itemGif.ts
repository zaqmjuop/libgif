import { Emitter } from './Emitter'
import { Frame, Gif89aData, Header, ImgBlock, Rect } from './type'

interface Quote {}

export class ItemGif extends Emitter {
  readonly quote: Quote
  delay: null | number = null

  lastImg?: Rect & Partial<ImgBlock>
  frameGroup: Frame[] = []
  data: Gif89aData
  constructor(quote: Quote, rect: { width: number; height: number }) {
    super()
    this.quote = quote
    this.data = {
      header: { width: rect.width, height: rect.height } as Header,
      gces: [],
      imgs: [],
      exts: []
    }
  }
}
