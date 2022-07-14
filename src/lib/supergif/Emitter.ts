import mitt from 'mitt'
import { valuesType, func } from './type'
export abstract class Emitter<T extends string[] = string[]> {
  protected readonly emitter = mitt<Record<valuesType<T>, unknown>>()
  public on(type: valuesType<T>, func: func) {
    return this.emitter.on(type, func)
  }
  protected emit(type: valuesType<T>, value: any) {
    return this.emitter.emit(type, value)
  }
}
