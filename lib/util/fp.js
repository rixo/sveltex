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

export const pipe = (...fns) => x => fns.reduce((y, f) => f(y), x)
