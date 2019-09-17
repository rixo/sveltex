import createCollector from './collector'
import { identity, noop, pipe } from './util/fp'

// eslint-disable-next-line no-console
const consoleWarn = (...args) => console.warn(...args)

// const callbagWriteAdapter = _ => inputCallbag => subscribe(_)(inputCallbag)
const callbagWriteAdapter = _ => inputCallbag => _.next(inputCallbag)

const defaultWrapConnection = (_, $) => ({ $, _ })

const makeCyclotron = (env = {}, config = {}) => {
  const { onDestroy, warn = consoleWarn } = env
  const {
    writeAdapter = callbagWriteAdapter,
    readAdapter = null,
    wrapConnection: customWrapConnection = defaultWrapConnection,
  } = config

  let currentOnDispose = onDestroy
  const resolvingHandlers = new WeakMap()

  const wrapConnection = (service, write) =>
    customWrapConnection(write, service.$)

  const onDisposal = callback => {
    if (!currentOnDispose) {
      throw new Error('Illegal state')
    }
    currentOnDispose(callback)
  }

  const applyReadAdapter = !readAdapter
    ? identity
    : collector$ => collector$ && readAdapter(collector$)

  const init = (handler, [_, collector$] = []) => {
    const previousOnDispose = currentOnDispose

    let disposeListeners = []

    const dispose = () => {
      const disposed = !disposeListeners
      if (disposed) return
      if (_) {
        _.dispose() // top down cleanup
      }
      disposeListeners.forEach(listener => listener())
      disposeListeners = null
    }

    // used by contexter to prune disposed services
    const onDispose = listener => {
      const disposed = !disposeListeners
      if (disposed) {
        warn('trying to add a listener to a disposed cyclotron')
        return
      }
      disposeListeners.push(listener)
    }

    currentOnDispose = onDispose

    const sink$ = applyReadAdapter(collector$)
    const $ = handler(sink$)

    currentOnDispose = previousOnDispose

    const service = {
      _,
      $,
      dispose,
      onDispose,
      _refCount: 0,
      _disconnect: () => {
        service._refCount--
        if (service._refCount === 0) {
          service.dispose()
        }
      },
    }

    const ouroborosCallbacks = resolvingHandlers.get(handler)
    if (ouroborosCallbacks) {
      ouroborosCallbacks.forEach(callback => callback(service))
    }

    return service
  }

  const initService = handler => {
    // spec: returns a passthrough cyclotron when called with no handler
    if (!handler) {
      const collector = createCollector()
      return init(() => collector.$, collector)
    }
    // spec: returns a read-only cyclotron when called with a zero-length handler
    const readOnly = handler.length === 0
    if (readOnly) {
      return init(handler)
    }
    // writable (readable or not)
    {
      const collector = createCollector()
      return init(handler, collector)
    }
  }

  const makeWrite = _ => {
    let doWrite
    const write = input => {
      if (!doWrite) {
        doWrite = writeAdapter(_)
      }
      const dispose = doWrite(input)
      if (dispose) {
        onDisposal(dispose)
        return dispose
      } else {
        return noop
      }
    }
    return write
  }

  const monitorRefCount = service => {
    service._refCount++
    onDisposal(service._disconnect)
  }

  const makeCreateConnection = service => {
    const readOnly = !service._
    if (readOnly) {
      // for read only services, one single connection can be shared because
      // the entirety of the cleanup logic takes place at the out stream level,
      // that is entirely out of the cyclotron's control / concern
      const connection = wrapConnection(service)
      return () => connection
    } else {
      const write = makeWrite(service._)
      return () => wrapConnection(service, write)
    }
  }

  const makeItConnectable = service => {
    const createConnection = makeCreateConnection(service)
    service.connect = () => {
      monitorRefCount(service)
      return createConnection()
    }
    return service
  }

  const createService = pipe(
    initService,
    makeItConnectable,
  )

  const throwOuroborosMultiConnect = () => {
    throw new Error('Cyclically resolved cyclotrons can be connected only once')
  }

  const createOuroboros = handler => {
    const selfRefs = resolvingHandlers.get(handler)
    let connected = false
    const connect = () => {
      connected = true
      ouroboros.connect = throwOuroborosMultiConnect
    }
    const proxyDispose = () => ouroboros.dispose()
    const ouroboros = Object.assign(proxyDispose, {
      isProxy: true,
      connect,
    })
    selfRefs.push(service => {
      ouroboros.isProxy = service
      ouroboros.dispose = () => {
        service._disconnect()
        ouroboros.dispose = noop
      }
      if (connected) {
        service._refCount++
      }
    })
    return ouroboros
  }

  const createCyclotron = handler => {
    // case: no handler
    // 1. falsy handlers cannot be used as key to resolvingHandlers WeakMap
    // 2. fortunately, no handler also means no possibility of circular dep
    if (!handler) {
      return createService(handler)
    }
    // case: circular dependency
    if (resolvingHandlers.has(handler)) {
      return createOuroboros(handler)
    }
    // case: normal
    resolvingHandlers.set(handler, [])
    const service = createService(handler)
    resolvingHandlers.delete(handler)
    return service
  }

  return createCyclotron
}

export default makeCyclotron
