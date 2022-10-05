export const AUTO_PLAY_VARS = ['auto', 'downloaded', 'decoded', 'none'] as const

export const READY_STATE = {
  UNDOWNLOAD: 0,
  DOWNLOADING: 1,
  DOWNLOADED: 2,
  DECODING: 3,
  DECODED: 4
} as const