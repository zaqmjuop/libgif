const a = document.createElement('a')
a.target = '_blank'
export const goto = (url: string) => {
  a.href = url
  a.click()
  a.href = ''
}
