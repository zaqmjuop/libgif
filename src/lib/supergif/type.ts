export interface Frame {
  data: ImageData
  delay: number
}
export interface Offset {
  x: number
  y: number
}
export interface Rect {
  leftPos: number
  topPos: number
  width: number
  height: number
}
export interface Hander {
  readonly hdr: (block: Header) => void
  readonly gce: (block: GCExtBlock) => void
  readonly com: (block: ComExtBlock) => void
  readonly app: (block: NetscapeExtBlock | UnknownAppExtBlock) => void
  readonly img: (block: ImgBlock) => void
  readonly eof: (block: Block) => void
  readonly pte: (block: PTExtBlock) => void
  readonly unknown: (block: UnknownExtBlock) => void
}

export interface Header {
  readonly signature: string
  readonly version: string
  readonly logicalScreenWidth: number
  readonly logicalScreenHeight: number
  readonly globalColorTableFlag: boolean
  readonly ColorResolution: number
  readonly sortFlag: boolean
  readonly ColorTableSize: number
  readonly backgroundColorIndex: number
  readonly pixelAspectRatio: number
  readonly gct: number[][] | undefined
}

export interface VP {
  vp_w: number
  vp_h: number
  vp_l: number
  vp_t: number
}
export interface Options {
  is_vp?: boolean
  gif: HTMLImageElement
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
export interface ImgBlock extends Block, Rect {
  lctFlag: boolean | undefined
  interlaced: boolean | undefined
  sorted: boolean | undefined
  reserved: boolean[]
  lctSize: number
  lct: number[][] | undefined
  lzwMinCodeSize: number
  pixels: number[]
}
export interface ExtBlock extends Block {
  readonly label: number
  extType: 'gce' | 'com' | 'pte' | 'app' | 'unknown' | ''
}
export interface UnknownExtBlock extends ExtBlock {
  data: string
}
export interface AppExtBlock extends ExtBlock {
  identifier: string
  authCode: string
}
export interface UnknownAppExtBlock extends AppExtBlock {
  appData: string
}
export interface NetscapeExtBlock extends AppExtBlock {
  appData: {
    unknown: number
    iterations: number
    terminator: number
  }
}
export interface PTExtBlock extends ExtBlock {
  ptHeader: number[]
  ptData: string
}

export interface ComExtBlock extends ExtBlock {
  comment: string
}

export interface GCExtBlock extends ExtBlock {
  reserved: boolean[]
  disposalMethod: number
  userInput: boolean
  transparencyGiven: boolean
  delayTime: number
  transparencyIndex: number
  terminator: number
}

export interface Gif89aData {
  header: Header
  gces: GCExtBlock[]
  imgs: ImgBlock[]
  app?: AppExtBlock
  exts: ExtBlock[]
  eof?: Block
}
export type valuesType<T> = T extends readonly (infer U)[] ? U : never
export type func = (...args: any[]) => any
export type background = Rect & {
  backgroundColor: string
}
