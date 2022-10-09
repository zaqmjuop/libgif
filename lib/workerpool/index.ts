import * as environment from './environment'
import Pool from './Pool'
import { add, emit } from './worker'
import Promis from './Promis'
import { WorkerPoolOptions } from './types'

/**
 * Create a new worker pool
 * @returns {Pool} pool
 */
const pool = (script: string, options: WorkerPoolOptions) => {
  return new Pool(script, options)
}

/**
 * Create a worker and optionally register a set of methods to the worker.
 */
const worker = (methods: Record<string, any>) => {
  add(methods)
}

/**
 * Sends an event to the parent worker pool.
 */
const workerEmit = (payload: any) => {
  emit(payload)
}

export default {
  pool,
  worker,
  workerEmit,
  Promis,
  platform: environment.platform,
  isMainThread: environment.isMainThread,
  cpus: environment.cpus
}
