import { BehaviorSubject, Subject, pipe } from 'rxjs'
import { map, shareReplay } from 'rxjs/operators'

import { identity, isFunction, isStream, loop, mapEntries } from './util/fp'

const contextResolver = ({ getContext, setContext }) => (
  factory,
  key = factory
) => () => {
  let value = getContext(key)
  if (value === undefined) {
    value = factory()
    setContext(key, value)
  }
  return value
}

export const createAllOptions = (env, fromContext = true) => {
  const resolve = fromContext ? contextResolver(env) : identity

  const resolveCache = resolve(() => new Map())
  const resolveRoot = resolve(() => new Map())
  const resolveAllOptions = resolve(() => new BehaviorSubject(resolveRoot()))

  const resolveOptions = factory => {
    const cache = resolveCache()
    if (cache.has(factory)) {
      return cache.get(factory)
    } else {
      const allOptions$ = resolveAllOptions()
      const options$ = allOptions$.pipe(
        map(allOptions => allOptions.get(factory)),
        shareReplay(1)
      )
      cache.set(factory, options$)
      return options$
    }
  }

  const configure = (factory, options) => {
    const root = resolveRoot()
    root.set(factory, options)
    const allOptions$ = resolveAllOptions()
    allOptions$.next(root)
  }

  return {
    resolveOptions,
    configure,
  }
}

const Cache = () => {
  const cache = new Map()
  return {
    fromCache: cache.get.bind(cache),
    toCache: cache.set.bind(cache),
  }
}

const createSink = factory => {
  if (factory.length === 0) {
    return undefined
  }
  return new Subject()
}

export const createConnector = env => {
  // const { getContext: fromCache, setContext: toCache, onDestroy } = env
  const { onDestroy } = env

  const { fromCache, toCache } = Cache()

  // const { resolveOptions } = createAllOptions(env)

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

  const wrapSink = pipe(
    createWriter,
    makeAssignable
  )

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

  const connectOne = factory => {
    const { source$, sink } = resolveOne(factory)
    if (!sink) {
      return source$
    }
    const _ = wrapSink(sink)
    if (!source$) {
      return _
    }
    return wrapConnected(_, source$)
  }

  const connectAll = mapEntries(([key, factory]) => [key, connectOne(factory)])

  const connect = arg => (isFunction(arg) ? connectOne(arg) : connectAll(arg))

  return connect
}
