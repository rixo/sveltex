export const noop = () => {}

export const loop = () => loop

const mergeEntry = (o, [k, v]) => {
  o[k] = v
  return o
}

export const fromEntries = entries => entries.reduce(mergeEntry, {})

export const mapEntries = mapper => o =>
  fromEntries(Object.entries(o).map(mapper))

export const mapValues = mapper => o =>
  fromEntries(Object.entries(o).map(([k, v]) => [k, mapper(v)]))

export const identity = x => x

export const isFunction = x => typeof x === 'function'

export const isStream = x => x && isFunction(x.subscribe)

export const isReadWrite = x =>
  isStream(x) && isStream(x.$) && isFunction(x.set) && isFunction(x._)
