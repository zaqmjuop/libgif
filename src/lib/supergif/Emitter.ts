import mitt from 'mitt'
import { valuesType, func } from './type'
export abstract class Emitter<
  T extends string[] | readonly string[] = string[]
> {
  protected readonly emitter = mitt<Record<valuesType<T>, unknown>>()
  public on(type: valuesType<T>, func: func) {
    return this.emitter.on(type, func)
  }
  public off(type: valuesType<T>, func?: func) {
    return this.emitter.off(type, func)
  }
  protected emit(type: valuesType<T>, value?: any) {
    return this.emitter.emit(type, value)
  }
}
