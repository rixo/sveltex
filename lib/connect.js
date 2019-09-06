import { merge, pipe, Subject } from 'rxjs'
import { shareReplay, takeWhile } from 'rxjs/operators'

import { isFunction, isStream, loop, mapEntries } from './util/fp'
import flattenName from './util/flattenName'

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

const wrapConnection = (_, $) => {
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

// monkey patches a method to run a handler once after its next call
const afterOnce = (o, method, handler) => {
  const sup = o[method]
  const own = o.hasOwnProperty(method)
  const restore = () => {
    if (own) o[method] = sup
    else delete o[method]
  }
  o[method] = function(...args) {
    const result = sup.apply(this, args)
    handler(...args)
    restore()
    return result
  }
}

const bindSink = (sink, socket) => {
  sink.next = socket.next.bind(socket)
  sink.error = socket.error.bind(socket)
  sink.complete = socket.complete.bind(socket)
  return sink
}

export const createConnector = ({ onDestroy }) => {
  const { fromCache, toCache } = Cache()

  // 1. remember everything that is written until the first reader
  // 2. flush everything to first reader
  // 3. becomes & stay hot
  const createSink = () => {
    // input socket
    const socket = new Subject()

    let readers = 0
    const before = socket.pipe(
      shareReplay(),
      takeWhile(() => readers < 1)
    )

    const after = socket.pipe()

    const sink = merge(before, after)

    // add input methods to sink
    bindSink(sink, socket)

    // subscribe immediately or writes before first subscriber will be lost
    const sub = sink.subscribe()

    // spec: on first subscriber, replay all previous emissions and become hot
    afterOnce(sink, 'subscribe', () => {
      readers += 1
      // test seems to indicate it is safe to unsubscribe once we've got our
      // first subscriber
      sub.unsubscribe()
    })

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
      // not complete: sink is a forever stream
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
    return wrapConnection(_, source$)
  }

  const connectAll = mapEntries(([key, factory]) => [
    flattenName(key),
    connectOne(factory),
  ])

  const connect = arg => (isFunction(arg) ? connectOne(arg) : connectAll(arg))

  return connect
}
