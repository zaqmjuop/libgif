export type workerType = 'auto' | 'web' | 'process' | 'thread'

export interface ExecOptions {
  on?: (payload: any) => unknown
}

export type func = (...args: any[]) => any

export interface WorkerPoolOptions {
  script?: string
  minWorkers?: number | 'max'
  maxWorkers?: number
  maxQueueSize?: number
  workerType?: workerType
  forkArgs?: any[]
  forkOpts?: Record<string, any>
  onCreateWorker?: func
  onTerminateWorker?: func
  debugPort?: any
  debugPortStart?: number
  nodeWorker?: any
}
