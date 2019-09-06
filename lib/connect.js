import { Subject, pipe } from 'rxjs'

import { isFunction, isStream, loop, mapEntries } from './util/fp'

const Cache = () => {
  const cache = new Map()
  return {
    fromCache: cache.get.bind(cache),
    toCache: cache.set.bind(cache),
  }
}

// This allows Svelte "store assignment":
//
//     const foo = connect(_foo)
//     foo$ = 42
//
//     const bar$ = connect(_bar$$)
//     bar$ = 54
//
const makeAssignable = (set, target = set) =>
  Object.assign(target, {
    set,
    subscribe: loop,
  })

const wrapConnected = (_, $) => {
  return Object.assign($, {
    _,
    $,
    // enables: `const [_, $] = connect(_foo$$)`
    [Symbol.iterator]: () => [_, $][Symbol.iterator](),
    // enables: `$foo$ = 42` in svelte
    set: _.set,
    // NOTE subscribe is already present since $ is an actual stream
  })
}

const createSink = factory => {
  if (factory.length === 0) {
    return undefined
  }
  return new Subject()
}

export const createConnector = ({ onDestroy }) => {
  const { fromCache, toCache } = Cache()

  const resolveOne = factory => {
    const existing = fromCache(factory)
    if (existing) {
      return existing
    }
    // const options$ = resolveOptions(factory)
    const sink = createSink(factory)
    const source$ = factory(sink)
    const result = { source$, sink }
    toCache(factory, result)
    return result
  }

  const createWriter = sink => input => {
    if (!isStream(input)) {
      sink.next(input)
      return
    }
    const sub = input.subscribe({
      next: x => sink.next(x),
      error: err => sink.error(err),
    })
    // unsubscribe
    onDestroy(() => sub.unsubscribe())
  }

  const wrapSink = pipe(
    createWriter,
    makeAssignable
  )

  const connectOne = factory => {
    const { source$, sink } = resolveOne(factory)
    // guard: read-only
    if (!sink) return source$
    const _ = wrapSink(sink)
    // guard: write-only
    if (!source$) return _
    // read/write
    return wrapConnected(_, source$)
  }

  const connectAll = mapEntries(([key, factory]) => [key, connectOne(factory)])

  const connect = arg => (isFunction(arg) ? connectOne(arg) : connectAll(arg))

  return connect
}
