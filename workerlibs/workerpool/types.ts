import Promis from './Promis'
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
 
export type resolve = (value) => void
export type reject = (err: Error) => void

export type resolver ={
  resolve: resolve
  reject: reject
  promise: Promis<any>;
}

export interface Task {
  method: string,
  params?: any[],
  resolver: resolver,
  timeout: number,
  options?: ExecOptions
}