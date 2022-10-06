export const bindSelf = <T extends object, K extends keyof T>(
  target: T,
  funcKey: K
): T[K] | void => {
  const func = target[funcKey]
  if (typeof func === 'function') {
    return func.bind(target)
  }
}
