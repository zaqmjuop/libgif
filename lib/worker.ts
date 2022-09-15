
self.addEventListener('message', (e) => {
  console.log('workerts', e)
})

self.postMessage('from workerts')