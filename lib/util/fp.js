export const noop = () => {}

export const loop = () => loop

export const mapEntries = mapper => o =>
  Object.fromEntries(Object.entries(o).map(mapper))

export const mapValues = mapper => o =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, mapper(v)]))

export const identity = x => x

export const isFunction = x => typeof x === 'function'

export const isStream = x => x && isFunction(x.subscribe)
