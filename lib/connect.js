import toRx from 'callbag-to-rxjs'

import { isFunction, isStream } from './util/index'
import { loop, mapEntries, pipe } from './util/fp'
import flattenName from './util/flattenName'
import createPort from './port'

const isReadOnly = factory => factory.length === 0

// const contextResolver = ({ getContext, setContext }) => (
//   factory,
//   key = factory
// ) => () => {
//   let value = getContext(key)
//   if (value === undefined) {
//     value = factory()
//     setContext(key, value)
//   }
//   return value
// }

const Cache = env => {
  if (env) {
    return {
      fromCache: env.getContext,
      toCache: env.setContext,
    }
  }
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
const makeWritableStore = (set, target = set) =>
  Object.assign(target, {
    set,
    subscribe: loop,
  })

const wrapConnection = (_ = {}, $ = {}) =>
  Object.assign($, {
    _,
    $,
    // enables: `const [_, $] = connect(_foo$$)`
    [Symbol.iterator]: () => [_, $][Symbol.iterator](),
    // enables: `$foo$ = 42` in svelte
    set: _.set,
    // NOTE subscribe is already present since $ is an actual stream
  })

const create = (wrapper, factory) => {
  if (isReadOnly(factory)) {
    return { source$: factory() }
  } else {
    // const sink = createSink()
    const sink = createPort()
    const sink$ = wrapper(sink.$)
    const source$ = factory(sink$)
    return { sink: sink._, source$ }
  }
}

export const createConnector = env => {
  const { onDestroy } = env
  const sinkAdapter = toRx

  const { fromCache, toCache } = Cache(env)

  const resolveOne = factory => {
    const existing = fromCache(factory)
    if (existing) {
      return existing
    }
    const result = create(sinkAdapter, factory)
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
      // complete: () => sink.complete(),
      // not complete: sink is a forever stream
    })
    // unsubscribe
    onDestroy(() => sub.unsubscribe())
  }

  const wrapSink = pipe(
    createWriter,
    makeWritableStore
  )

  const connectOne = factory => {
    const { source$, sink } = resolveOne(factory)
    // guard: read-only
    if (!sink) return wrapConnection(undefined, source$)
    const _ = wrapSink(sink)
    // guard: write-only
    if (!source$) return wrapConnection(_, _)
    // read/write
    return wrapConnection(_, source$)
  }

  const connectAll = mapEntries(([key, factory]) => [
    flattenName(key),
    connectOne(factory),
  ])

  const connect = arg => (isFunction(arg) ? connectOne(arg) : connectAll(arg))

  return connect
}
