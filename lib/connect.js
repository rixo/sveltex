import { identity } from './util/fp'
import makeCyclotron from './cyclotron'

const runtimeKey = { id: 'sveltex.connect.runtime' }

const makeConnector = env => {
  const { getContext, setContext } = env

  const getRuntime = () => {
    const runtime = getContext(runtimeKey)
    if (!runtime) {
      throw new Error(
        'You must call bootstrap from a root component before calling connect',
      )
    }
    return runtime
  }

  const setRuntime = runtime => setContext(runtimeKey, runtime)

  const proxyAttach = (...args) => {
    const { attach } = getRuntime()
    return attach(...args)
  }

  const proxyConnect = (...args) => {
    const { connect } = getRuntime()
    return connect(...args)
  }

  // TODO test env only
  const proxyResolve = x => getRuntime().resolve(x)

  const makeConnect = ({ contextKey = identity }, { Cyclotron, cache }) => {
    const resolve = (handler, existingOnly = false) => {
      const key = contextKey(handler)
      const existing = cache.get(key)
      if (existing) {
        return existing
      } else if (existingOnly) {
        return undefined
      } else {
        const cyclo = Cyclotron(handler)
        if (!cyclo.isProxy) {
          cache.set(key, cyclo)
          cyclo.onDispose(() => {
            if (cache.get(key) === cyclo) {
              cache.delete(key)
            }
          })
        }
        return cyclo
      }
    }

    const attach = onDispose => handler => resolve(handler).attach(onDispose)

    const connect = handler => resolve(handler).connect()

    return { attach, connect, resolve }
  }

  const bootstrap = (config = {}) => {
    const cache = new Map()
    const Cyclotron = makeCyclotron(env, config)
    const { attach, connect, resolve } = makeConnect(config, {
      Cyclotron,
      cache,
    })
    setRuntime({ config, attach, connect, resolve })
    // dispose
    const dispose = () => {
      cache.forEach(cyclo => cyclo.dispose())
      cache.clear()
    }
    return dispose
  }

  // TODO test env only
  bootstrap.debugConfig = () => getRuntime()

  proxyConnect.resolve = proxyResolve

  return {
    bootstrap,
    attach: proxyAttach,
    connect: proxyConnect,
    resolve: proxyResolve,
  }
}

export default makeConnector
