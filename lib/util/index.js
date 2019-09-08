export const isFunction = x => typeof x === 'function'

export const isStream = x => x && isFunction(x.subscribe)

export const isReadWrite = x =>
  isStream(x) && isStream(x.$) && isFunction(x.set) && isFunction(x._)
