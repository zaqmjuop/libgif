export default () => {
  const response = `onmessage=function(e){postMessage('worker接收数据: ' + e.data)}`

  const worker = new Worker(
    'data:application/javascript,' + encodeURIComponent(response)
  )

  worker.onmessage = (e) => {
    console.log('主线程接收数据:', e.data)
  }
  worker.postMessage('主线程发送数据')

  console.log(worker)
}
