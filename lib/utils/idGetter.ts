export const idGetter = () => {
  let id = 0
  return () => id++
}