export type workerType = 'auto' | 'web' | 'process' | 'thread'
export interface WorkerPoolOptions {
  minWorkers?: number | 'max'
  maxWorkers?: number
  maxQueueSize?: number
  workerType?: workerType
  forkArgs?: any
  forkOpts?: any
  onCreateWorker?: Function
  onTerminateWorker?: Function
  debugPort: any
}

export interface ExecOptions {
  on?: (payload: any) => unknown
}

export type func = (...args: any[]) => any
