import { AUTO_PLAY_VARS } from './utils/metaData'
export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never

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

export type rgb = [number, number, number]

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
  readonly backgroundColor: rgb | null
  readonly pixelAspectRatio: number
  readonly globalColorTable: rgb[] | undefined
}

export type initialPlay = ArrayElement<typeof AUTO_PLAY_VARS>

export interface LibgifInitOptions {
  gif: HTMLCanvasElement // container
  src?: string
  forword?: boolean
  rate?: number
  loop?: boolean
  autoplay?: initialPlay
  beginFrameNo?: number
}

export interface Block {
  readonly sentinel: number
  type: 'ext' | 'img' | 'complete' | ''
}
export interface ImgBlock extends Block, Rect {
  lctFlag: boolean | undefined
  interlaced: boolean | undefined
  sorted: boolean | undefined
  reserved: boolean[]
  lctSize: number
  lct: rgb[] | undefined
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

export type valuesType<T> = T extends readonly (infer U)[] ? U : never
export type func = (...args: any[]) => any
export type background = Rect & {
  backgroundColor: string
}

export type gifData = string | Uint8Array

export interface DownloadRecord {
  data?: gifData
  progress: number
  error?: string
}

export interface DownloadEvent {
  key: string
  cache: DownloadRecord
}

export type frame = Frame & Rect

export interface DecodedData {
  header?: Header
  blocks: Block[]
  frames: frame[]
  complete: boolean
}

export interface DownloadProgressEvent {
  key: string
  data: gifData
  progress: number
}
