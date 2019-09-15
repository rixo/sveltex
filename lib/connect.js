import { identity } from './util/fp'
import makeCyclotron from './cyclotron'

const runtimeKey = { id: 'sveltex.connect.runtime' }

const makeConnector = env => {
  const { getContext, setContext } = env

  const getRuntime = () => {
    const runtime = getContext(runtimeKey)
    if (!runtime) {
      throw new Error(
        'You must call bootstrap from a root component before calling connect'
      )
    }
    return runtime
  }

  const setRuntime = runtime => setContext(runtimeKey, runtime)

  const proxyConnect = (...args) => {
    const { connect } = getRuntime()
    return connect(...args)
  }

  // TODO test env only
  const proxyResolve = x => getRuntime().resolve(x)

  const makeConnect = ({ contextKey = identity }, { Cyclotron, cache }) => {
    const resolve = (handler, existingOnly = false) => {
      const key = contextKey(handler)
      const existing = getContext(key)
      if (existing) {
        return existing
      } else if (existingOnly) {
        return undefined
      } else {
        const cyclo = Cyclotron(handler)
        setContext(key, cyclo)
        cache.add(cyclo)
        cyclo.onDispose(() => {
          setContext(key, null)
          cache.delete(cyclo)
        })
        return cyclo
      }
    }

    const connect = handler => resolve(handler).connect()

    return { connect, resolve }
  }

  const bootstrap = (config = {}) => {
    const Cyclotron = makeCyclotron(env, config)
    const cache = new Set()
    const { connect, resolve } = makeConnect(config, { Cyclotron, cache })
    setRuntime({ config, connect, resolve, cache })
    // dispose
    const dispose = () => {
      const cache = getRuntime().cache
      cache.forEach(cyclo => {
        cyclo.dispose()
      })
      cache.clear()
    }
    return dispose
  }

  // TODO test env only
  bootstrap.debugConfig = () => getRuntime()

  return {
    bootstrap,
    connect: proxyConnect,
    resolve: proxyResolve,
  }
}

export default makeConnector
