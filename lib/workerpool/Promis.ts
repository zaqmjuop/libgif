import { func, reject, resolve } from './types'

const isPromis = (value): value is Promis =>
  value &&
  typeof value['then'] === 'function' &&
  typeof value['catch'] === 'function'

const _then = (
  callback: (value) => any,
  resolve: resolve,
  reject: reject
): func => {
  return (result) => {
    try {
      const res = callback(result)
      isPromis(res) ? res.then(resolve, reject) : resolve(res)
    } catch (error) {
      reject(error)
    }
  }
}

class CancellationError extends Error {
  readonly name = 'CancellationError'
  constructor(message?: string) {
    super()
    this.message = message || 'promise cancelled'
  }
}

class TimeoutError extends Error {
  readonly name = 'TimeoutError'
  constructor(message?: string) {
    super()
    this.message = message || 'timeout exceeded'
  }
}

/**
 * Promis
 *
 * Inspired by https://gist.github.com/RubaXa/8501359 from RubaXa <trash@rubaxa.org>
 *
 * @param {Function} handler   Called as handler(resolve: Function, reject: Function)
 * @param {Promis} [parent]   Parent promise for propagation of cancel and timeout
 */
export default class Promis<T = any> {
  timeout:func
  /**
   * Create a promise which resolves when all provided promises are resolved,
   * and fails when any of the promises resolves.
   * @param {Promis[]} promises
   * @returns {Promis} promise
   */
  static all(promises: Promis[]): Promis {
    return new Promis((resolve, reject) => {
      let remaining = promises.length
      const results: any[] = []

      if (remaining) {
        promises.forEach(function (p, i) {
          p.then(
            function (result) {
              results[i] = result
              remaining--
              if (remaining == 0) {
                resolve(results)
              }
            },
            function (error) {
              remaining = 0
              reject(error)
            }
          )
        })
      } else {
        resolve(results)
      }
    })
  }

  /**
   * Create a promise resolver
   * @returns {{promise: Promis, resolve: Function, reject: Function}} resolver
   */
  static defer() {
    let resolve
    let reject

    const promise = new Promis((resolve, reject) => {
      resolve = resolve
      reject = reject
    })

    return { promise, resolve, reject }
  }
  static CancellationError = CancellationError
  static TimeoutError = TimeoutError

  // status
  resolved = false
  rejected = false
  pending = true
  private _onSuccess: Array<func> = []
  private _onFail: Array<func> = []
  constructor(
    handler: (resolve: resolver, reject: rejecter) => any,
    readonly parent?: Promis
  ) {
    // attach handler passing the resolve and reject functions
    handler(
      (result) => this._resolve(result),
      (error) => this._reject(error)
    )
  }

  /**
   * Process onSuccess and onFail callbacks: add them to the queue.
   * Once the promise is resolve, the function _promise is replace.
   */
  private _process = (onSuccess: func, onFail: func) => {
    this._onSuccess.push(onSuccess)
    this._onFail.push(onFail)
  }

  /**
   * Add an onSuccess callback and optionally an onFail callback to the Promis
   */
  then = (onSuccess?: func, onFail?: func): Promis => {
    return new Promis((resolve, reject) => {
      const s = onSuccess ? _then(onSuccess, resolve, reject) : resolve
      const f = onFail ? _then(onFail, resolve, reject) : reject

      this._process(s, f)
    }, this)
  }

  private _resolve = (result: any) => {
    if (!this.pending) {
      return
    }
    // update status
    this.resolved = true
    this.rejected = false
    this.pending = false

    this._onSuccess.forEach((fn) => {
      fn(result)
    })

    this._process = (onSuccess, onFail) => {
      onSuccess(result)
    }
    return this
  }

  private _reject = (error: Error) => {
    if (!this.pending) {
      return
    }
    // update status
    this.resolved = false
    this.rejected = true
    this.pending = false

    this._onFail.forEach((fn) => {
      fn(error)
    })

    this._process = (onSuccess, onFail) => {
      onFail(error)
    }
    return this
  }

  cancel = (): Promis => {
    this.parent ? this.parent.cancel() : this._reject(new CancellationError())
    return this
  }

  /**
   * Set a timeout for the promise. If the promise is not resolved within
   * the time, the promise will be cancelled and a TimeoutError is thrown.
   * If the promise is resolved in time, the timeout is removed.
   */
  timeout = (delay: number): Promis => {
    if (this.parent) {
      this.parent.timeout(delay)
    } else {
      const timer = setTimeout(function () {
        this._reject(
          new TimeoutError('Promis timed out after ' + delay + ' ms')
        )
      }, delay)

      this.always(function () {
        clearTimeout(timer)
      })
    }

    return this
  }

  // TODO: add support for Promis.catch(Error, callback)
  // TODO: add support for Promis.catch(Error, Error, callback)

  /**
   * Execute given callback when the promise either resolves or rejects.
   */
  always = (fn: func): Promis => this.then(fn, fn)

  /**
   * Add an onFail callback to the Promis
   */
  catch = (onFail: func): Promis => this.then(void 0, onFail)
}
