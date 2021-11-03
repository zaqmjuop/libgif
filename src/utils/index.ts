export const isKeyof = <T extends object>(
  val: number | string | symbol,
  target: T
): val is keyof T => val in target
