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

export type color = [number, number, number]

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
  readonly backgroundColor: color | null
  readonly pixelAspectRatio: number
  readonly globalColorTable: color[] | undefined
}

export interface Options {
  gif: HTMLImageElement
  on_end?: (gif: HTMLImageElement) => void
  loop_delay?: number
  loop_mode?: boolean
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
  lct: color[] | undefined
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
