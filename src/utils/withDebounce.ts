export const withDebounce = (
  fn: (...args: any[]) => any,
  msec = 200
): ((...args: unknown[]) => void) => {
  let canRun = true
  return (...args: unknown[]) => {
    if (!canRun) {
      return
    }
    canRun = false
    fn(...args)
    window.setTimeout(() => (canRun = true), msec)
  }
}
