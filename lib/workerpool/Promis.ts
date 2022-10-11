import { func } from './types'

/**
 * Execute given callback, then call resolve/reject based on the returned result
 * @param {Function} callback
 * @param {Function} resolve
 * @param {Function} reject
 * @returns {Function}
 * @private
 */
function _then(callback, resolve, reject) {
  return function (result) {
    try {
      var res = callback(result)
      if (
        res &&
        typeof res.then === 'function' &&
        typeof res['catch'] === 'function'
      ) {
        // method returned a promise
        res.then(resolve, reject)
      } else {
        resolve(res)
      }
    } catch (error) {
      reject(error)
    }
  }
}

/**
 * Create a cancellation error
 * @param {String} [message]
 * @extends Error
 */
class CancellationError extends Error {
  readonly name = 'CancellationError'
  constructor(message?: string) {
    super()
    this.message = message || 'promise cancelled'
  }
}

/**
 * Create a timeout error
 * @param {String} [message]
 * @extends Error
 */
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
  private _onSuccess: Array<Function> = []
  private _onFail: Array<Function> = []
  constructor(handler: Function, readonly parent?: Promis) {
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

  /**
   * Resolve the promise
   * @param {*} result
   * @type {Function}
   */
  private _resolve = (result: any) => {
    let disposal = (): this | void => {
      // update status
      this.resolved = true
      this.rejected = false
      this.pending = false

      this._onSuccess.forEach(function (fn) {
        fn(result)
      })

      this._process = function (onSuccess, onFail) {
        onSuccess(result)
      }
      disposal = () => {}
      return this
    }

    return disposal()
  }

  /**
   * Reject the promise
   * @param {Error} error
   * @type {Function}
   */
  private _reject = (error: Error) => {
    let disposal = (): this | void => {
      // update status
      this.resolved = false
      this.rejected = true
      this.pending = false

      this._onFail.forEach(function (fn) {
        fn(error)
      })

      this._process = function (onSuccess, onFail) {
        onFail(error)
      }
      disposal = () => {}
      return this
    }

    return disposal()
  }

  /**
   * Cancel te promise. This will reject the promise with a CancellationError
   */
  cancel = (): Promis => {
    if (this.parent) {
      this.parent.cancel()
    } else {
      this._reject(new CancellationError())
    }

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
