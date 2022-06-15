export interface Hander {
  readonly hdr: (block: Header) => void
  readonly gce: (block: any) => void
  readonly com: (block: any) => void
  readonly app: {
    readonly NETSCAPE: (block: any) => void
  }
  readonly img: (block: ImgBlock) => void
  readonly eof: (block: Block) => void
  readonly pte: (block: any) => void
  readonly unknown: (block: any) => void
}

export interface Header {
  readonly sig: string
  readonly ver: string
  readonly width: number
  readonly height: number
  readonly gctFlag: boolean
  readonly colorRes: number
  readonly sorted: boolean
  readonly gctSize: number
  readonly bgColor: number
  readonly pixelAspectRatio: number
  readonly gct: number[][] | undefined
}

export interface Options {
  vp_w: number
  vp_h: number
  is_vp?: boolean
  vp_l: number
  vp_t: number
  c_w: number
  c_h: number
  gif: HTMLImageElement
  auto_play?: boolean
  on_end?: (gif: HTMLImageElement) => void
  loop_delay?: number
  loop_mode?: boolean
  draw_while_loading?: boolean
  show_progress_bar?: boolean
  progressbar_height?: number
  progressbar_background_color?: string
  progressbar_foreground_color?: string
  max_width?: number
}

export interface Block {
  readonly sentinel: number
  type: 'ext' | 'img' | 'eof' | ''
}
export interface ImgBlock extends Block {
  leftPos: number
  topPos: number
  width: number
  height: number
  lctFlag: boolean | undefined
  interlaced: boolean | undefined
  sorted: boolean | undefined
  reserved: boolean[]
  lctSize: number
  lct: number[][] | undefined
  lzwMinCodeSize: number
  pixels: number[]
}
