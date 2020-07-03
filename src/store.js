import * as store from 'svelte/store'

const noop = () => {}

const isPromise = x => x && typeof x.then === 'function'

const wrapStop = (promise, set) => {
  let stoped = false
  let stop = noop

  const stopedPromise = Promise.resolve(promise)
    .then(_stop => {
      if (stoped) return _stop()
      stop = _stop
    })
    .catch(err => {
      if (stoped) return
      set(err)
    })
    .finally(() => {
      if (stop) return stop()
    })
    .then(noop) // return void

  return () => {
    if (stoped) return
    stoped = true
    if (stop !== noop && typeof stop === 'function') stop()
    return stopedPromise
  }
}

const wrapLifecycle = lifecycle => {
  if (!lifecycle) return noop
  return (set, ...args) => {
    try {
      const result = lifecycle(set, ...args)
      if (!isPromise(result)) return result
      return wrapStop(result, set)
    } catch (err) {
      set(err)
    }
  }
}

const wrapDerivedLifecycle = lifecycle => {
  if (!lifecycle) return lifecycle
  const auto = lifecycle.length < 2
  if (auto) return lifecycle
  return (deps, set) => {
    try {
      const result = lifecycle(deps, set)
      if (!isPromise(result)) return result
      return wrapStop(result, set)
    } catch (err) {
      set(err)
    }
  }
}

// const wrapDerivedStop = (result, set, auto) => {
//   let stoped = false
//   let stop = noop
//
//   const stopedPromise = Promise.resolve(result)
//     .then(_stop => {
//       if (stoped) {
//         if (typeof _stop === 'function') {
//           return _stop()
//         }
//         return _stop
//       }
//       if (stop !== undefined && typeof _stop !== 'function') {
//         set(stop)
//       }
//       stop = _stop
//     })
//     .catch(err => {
//       if (stoped) return
//       set(err)
//     })
//     .finally(() => {
//       if (typeof stop === 'function') return stop()
//     })
//     .then(noop) // return void
//
//   return () => {
//     if (stoped) return
//     stoped = true
//     if (stop !== noop && typeof stop === 'function') stop()
//     return stopedPromise
//   }
// }

export const readable = (initial, lifecycle) =>
  store.readable(initial, wrapLifecycle(lifecycle))

export const writable = (initial, lifecycle) =>
  store.writable(initial, wrapLifecycle(lifecycle))

export const derived = (deps, lifecycle, initial) =>
  store.derived(deps, wrapDerivedLifecycle(lifecycle), initial)

// const removeListener = (listeners, listener, index) => {
//   if (listeners.length === 0) return false
//   for (let i = index; i >= 0; i--) {
//     if (listeners[i] !== listener) continue
//     listeners.splice(i, 1)
//     return listeners.length === 0
//   }
//   return false
// }
//
// export const readable = (initial, lifecycle) => {
//   const listeners = []
//   let value = initial
//   let stop
//
//   const set = x => {
//     if (value === x) return
//     value = x
//     for (const listener of listeners) {
//       listener(x)
//     }
//   }
//
//   const subscribe = listener => {
//     if (listeners.length === 0) {
//       if (lifecycle) {
//         stop = wrapStop(lifecycle(set))
//       } else {
//         stop = noop
//       }
//     }
//
//     const i = listeners.length
//     listeners.push(listener)
//
//     listener(value)
//
//     return () => {
//       if (removeListener(listeners, listener, i)) stop()
//     }
//   }
//
//   return { subscribe }
// }
