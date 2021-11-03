let prevCookie = ''
const data: { [key: string]: string } = {}
export const getCookie = (): typeof data => {
  const cookie = document.cookie
  if (prevCookie === cookie) {
    return data
  }
  Object.keys(data).forEach((key) => delete data[key])
  cookie.split(';').forEach((item) => {
    const [key, value] = item.split('=')
    data[key] = value
  })
  prevCookie = cookie
  return data
}
