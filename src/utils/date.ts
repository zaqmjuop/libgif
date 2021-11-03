import dayjs from 'dayjs'

export const toLocaleString = (msec: number | string) =>
  dayjs(msec).format('YYYY-M-D HH:mm:ss')
