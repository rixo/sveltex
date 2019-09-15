import { concat, NEVER } from 'rxjs'
import { fake } from 'sinon'

export const FakeContext = () => {
  let context = new Map()

  const setContext = (key, value) => context.set(key, value)

  const getContext = key => context.get(key)

  const clear = () => {
    context = new Map()
  }

  return { setContext, getContext, clear }
}

export const FakeLifecycle = () => {
  const destroyHandlers = {}
  let current = null

  const setCurrent = x => {
    current = x
  }

  const getHandlers = () => {
    const handlers = destroyHandlers[current]
    if (!handlers) {
      const handlers = []
      destroyHandlers[current] = handlers
      return destroyHandlers[current]
    }
    return handlers
  }

  const onDestroy = handler => {
    getHandlers().push(handler)
  }

  const destroy = () => {
    getHandlers().forEach(handler => handler())
    destroyHandlers[current] = []
  }

  return { onDestroy, destroy, setCurrent }
}

export const spyObservable = (source$, end$ = NEVER) => {
  const stream = concat(source$, end$)
  const { subscribe: superSubscribe } = stream
  const subscribe = fake(function(...args) {
    const sub = superSubscribe.apply(this, args)
    const { unsubscribe: superUnsubscribe } = sub
    const unsubscribe = fake(function(...args) {
      stream.unsubscribeCount++
      return superUnsubscribe.apply(this, args)
    })
    stream.subscribeCount++
    return Object.assign(sub, { unsubscribe })
  })
  return Object.assign(stream, {
    subscribe,
    subscribeCount: 0,
    unsubscribeCount: 0,
  })
}
