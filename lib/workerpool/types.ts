export interface WorkerPoolOptions {
  minWorkers?: number | 'max'
  maxWorkers?: number
  maxQueueSize?: number
  workerType?: 'auto' | 'web' | 'process' | 'thread'
  forkArgs?: any
  forkOpts?: any
  onCreateWorker?: Function
  onTerminateWorker?: Function
  debugPort: any
}

export interface ExecOptions {
  on?: (payload: any) => unknown
}
