export const idGetter = () => {
  let id = 0
  return () => {
    id > 65535 && (id = -id)
    return id++
  }
}
