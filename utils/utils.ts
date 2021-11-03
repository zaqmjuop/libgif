export function getFormatDate(date: Date = new Date()) {
  return `${date.toLocaleDateString()} ${date.toTimeString().slice(0, 8)}`;
}

export const isInstance = <T extends Function>(
  source: any,
  klass: T
): source is T => source && source instanceof klass;
