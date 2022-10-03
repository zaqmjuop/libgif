import { Frame, gifData, Header, Rect } from './type'

type url = string

export const downloadCache: Record<url, gifData> = {}

export const decodedCache: Record<
  string,
  { header: Header; frames: Frame & Rect; complete: boolean }
> = {}
