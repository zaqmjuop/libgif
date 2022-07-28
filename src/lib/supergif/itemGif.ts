import { Emitter } from './Emitter'
import { Frame, Gif89aData, Header, ImgBlock, Rect } from './type'

interface Quote {
  max_width?: number
}

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
  get_canvas_scale = () => {
    let scale = 1
    const width = this.data.header.width
    const max_width = this.quote.max_width
    if (max_width && width && width > max_width) {
      scale = max_width / width
    }
    return scale
  }
}
