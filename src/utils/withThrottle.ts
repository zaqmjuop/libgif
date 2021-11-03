export const withThrottle = (
  fn: (...args: any[]) => any,
  msec = 200
): ((...args: unknown[]) => void) => {
  let timer = 0
  return (...args: unknown[]) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), msec)
  }
}

export const withThrottles = (
  fns: Array<
    { fn: (...args: any[]) => any; mesc: number } | ((...args: any[]) => any)
  >,
  defaultMesc = 200
) => {
  return fns.map((item) => {
    if (typeof item === 'function') {
      return withThrottle(item, defaultMesc)
    } else {
      return withThrottle(item.fn, item.mesc)
    }
  })
}
