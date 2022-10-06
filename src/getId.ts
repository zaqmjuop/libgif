let id = 0
export const getId = () => {
  id > 65535 && (id = -id)
  return `${(id++).toString(16)}`
}
