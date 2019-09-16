import tapUp from 'callbag-tap-up'

import createCollector from './collector'
import { noop, pipe } from './util/fp'

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

  const wrapConnection = (service, write) =>
    customWrapConnection(write, service.$)

  const onDisposal = callback => {
    if (!currentOnDispose) {
      throw new Error('Illegal state')
    }
    currentOnDispose(callback)
  }

  // spec: a cyclo is disposed when the sink$ is unsubscribed (from the inside)
  const harnessSink = (dispose, collector$) => {
    let sink$ = collector$
    if (!sink$) return sink$
    sink$ = tapUp(noop, noop, dispose)(sink$)
    if (readAdapter) sink$ = readAdapter(sink$)
    return sink$
  }

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

    const sink$ = harnessSink(dispose, collector$)
    const $ = handler(sink$)

    currentOnDispose = previousOnDispose

    return {
      _,
      $,
      dispose,
      onDispose,
    }
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

  const makeConnectable = service => {
    const readOnly = !service._
    if (readOnly) {
      // for read only services, one single connection can be shared because
      // the entirety of the cleanup logic takes place at the out stream level,
      // that is entirely out of the cyclotron's control / concern
      const connection = wrapConnection(service)
      service.connect = () => connection
    } else {
      const write = makeWrite(service._)
      service.connect = () => wrapConnection(service, write)
    }
    return service
  }

  const create = pipe(
    initService,
    makeConnectable,
  )

  return create
}

export default makeCyclotron
