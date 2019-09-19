import { concat, NEVER } from 'rxjs'
import { fake } from 'sinon'

export const FakeContext = () => {
  const elip = [new Map()] // reversed "pile"

  const current = () => elip[0]

  const setContext = (key, value) => current().set(key, value)

  const getContext = key => {
    for (const context of elip) {
      if (context.has(key)) {
        return context.get(key)
      }
    }
  }

  const clear = () => {
    elip[0] = new Map()
  }

  const shadow = () => {
    elip.unshift(new Map())
  }

  const pop = () => {
    elip.shift()
  }

  return { setContext, getContext, clear, shadow, pop }
}

export const FakeLifecycle = () => {
  const destroyHandlers = {}

  const getHandlers = key => {
    const handlers = destroyHandlers[key]
    if (!handlers) {
      const handlers = []
      destroyHandlers[key] = handlers
      return destroyHandlers[key]
    }
    return handlers
  }

  const onDestroy = (handler, key = me.current) => {
    getHandlers(key).push(handler)
  }

  const destroy = (key = me.current) => {
    getHandlers(key).forEach(handler => handler())
    destroyHandlers[key] = []
  }

  const _in = (key, fn) => {
    const previous = me.current
    me.current = key
    fn()
    me.current = previous
    return me
  }

  const me = { onDestroy, destroy, in: _in, current: null }

  return me
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
