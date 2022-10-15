export const bindSelf = <T extends object, K extends keyof T>(
  target: T,
  funcKey: K
): T[K] => {
  const func = target[funcKey]
  if (typeof func !== 'function') {
    throw new TypeError(
      `${String(funcKey)} on ${String(target)} is not a Function`
    )
  }
  return func.bind(target)
}
