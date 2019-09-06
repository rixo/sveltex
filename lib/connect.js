import { Subject, pipe } from 'rxjs'
import { shareReplay } from 'rxjs/operators'

import { isFunction, isStream, loop, mapEntries } from './util/fp'

const isReadOnly = factory => factory.length === 0

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

export const createConnector = ({ onDestroy }) => {
  const { fromCache, toCache } = Cache()

  const disposables = [] // TODO destroy & dispose

  const createSink = () => {
    const sink = new Subject().pipe(shareReplay(1))
    const sub = sink.subscribe()
    disposables.push(sub)
    return sink
  }

  const create = factory => {
    if (isReadOnly(factory)) {
      return { source$: factory() }
    } else {
      const sink = createSink()
      const source$ = factory(sink)
      return { sink, source$ }
    }
  }

  const resolveOne = factory => {
    const existing = fromCache(factory)
    if (existing) {
      return existing
    }
    const result = create(factory)
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
