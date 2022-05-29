export const byteToBitArr = (bite: number) => {
  const a: boolean[] = []
  for (let i = 7; i >= 0; i--) {
    a.push(!!(bite & (1 << i)))
  }
  return a
}

export const bitsToNum = (ba: boolean[]): number => {
  return ba.reduce((total, val) => total * 2 + Number(val), 0)
}
