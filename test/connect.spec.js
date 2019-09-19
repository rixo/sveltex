import assert from 'assert'
import { fake } from 'sinon'

import makeConnector from '@/connect'
import { isFunction } from '@/util'
import { noop } from '@/util/fp'

import { FakeContext, FakeLifecycle } from './helpers'

describe('connect', () => {
  let context
  let lifecycle
  let attach
  let connect
  let resolve
  let bootstrap

  beforeEach(() => {
    context = FakeContext()
    lifecycle = FakeLifecycle()
    const provider = makeConnector({ ...context, ...lifecycle })
    attach = provider.attach
    connect = provider.connect
    bootstrap = provider.bootstrap
    resolve = provider.resolve
  })

  describe('bootstrap', () => {
    it('is a function', () => {
      assert(isFunction(bootstrap))
    })

    it('stores config in context', () => {
      const config = { a: 1 }
      const dispose = bootstrap(config)
      const runtime = bootstrap.debugConfig()
      assert.strictEqual(runtime.config, config)
      if (dispose) dispose()
    })

    it('returns a dispose function', () => {
      const dispose = bootstrap()
      assert(isFunction(dispose))
    })

    describe('contextual runtime resolution', () => {
      let handler
      let runtime0
      let resolve0
      let cyclo0

      beforeEach(() => {
        bootstrap()
        handler = () => {}
        runtime0 = bootstrap.debugConfig()
        resolve0 = runtime0.resolve
        cyclo0 = resolve0(handler)
        const cyclo2 = resolve0(handler)
        assert.strictEqual(cyclo0, cyclo2) // sanity check
      })

      const it_resolves_same_runtime = () => {
        it('resolves the same runtime', () => {
          const runtime = bootstrap.debugConfig()
          assert.strictEqual(runtime, runtime0)
        })
      }

      const it_resolves_same_cyclo = () => {
        it('resolves to the same instance of an already resolved cyclo', () => {
          const { resolve } = bootstrap.debugConfig()
          const cyclo = resolve(handler)
          assert.strictEqual(cyclo, cyclo0)
        })
      }

      const it_resolves_another_disposed_cyclo = () => {
        it('resolves to another instance of a disposed cyclo', () => {
          const { resolve } = bootstrap.debugConfig()
          cyclo0.dispose()
          const cyclo = resolve(handler)
          assert.notStrictEqual(cyclo, cyclo0)
        })
      }

      describe('from the same context', () => {
        it_resolves_same_runtime()
        it_resolves_same_cyclo()
        it_resolves_another_disposed_cyclo()
      })

      describe('from non bootstrapped child context', () => {
        beforeEach(() => {
          context.shadow()
        })
        it_resolves_same_runtime()
        it_resolves_same_cyclo()
        it_resolves_another_disposed_cyclo()
      })

      describe('from bootstrapped child context', () => {
        beforeEach(() => {
          context.shadow()
          bootstrap()
        })

        it('resolves a new runtime', () => {
          const runtime = bootstrap.debugConfig()
          assert.notStrictEqual(runtime, runtime0)
        })

        it('resolves to another instance of an already resolved cyclo', () => {
          const { resolve } = bootstrap.debugConfig()
          const cyclo = resolve(handler)
          assert.notStrictEqual(cyclo, cyclo0)
        })

        it_resolves_another_disposed_cyclo()
      })
    })
  })

  const test_disposes_all_on_bootstrap_destroy = (doConnect, disposeAll) => {
    const handlers = {
      a: () => {},
      b: sink$ => sink$,
      c: () => {
        doConnect(handlers.a)
      },
    }
    // attach
    doConnect(handlers.b)
    doConnect(handlers.c)
    // before dispose
    const disposed = {}
    {
      const r = Object.entries(handlers).map(([k, handler]) => {
        const cyclo = resolve(handler, true)
        assert.ok(cyclo, `cyclo ${k} has been started`)
        disposed[k] = fake()
        cyclo.onDispose(disposed[k])
        assert(disposed[k].notCalled, `cyclo ${k} has not been disposed`)
      })
      assert.equal(r.length, 3) // sanity check
    }
    // dispose
    disposeAll()
    // after
    {
      const r = Object.entries(disposed).map(([k, disposed]) => {
        assert(disposed.calledOnce, `cyclo ${k} has been disposed`)
      })
      assert.equal(r.length, 3) // sanity check
    }
  }

  describe('attach', () => {
    let wrapConnection
    let disposeAll
    beforeEach(() => {
      wrapConnection = fake()
      disposeAll = bootstrap({
        wrapConnection,
      })
    })
    afterEach(() => {
      disposeAll()
    })

    it('is a function', () => {
      assert(isFunction(attach))
    })

    it('returns a connect function', () => {
      const connect = attach(noop)
      assert(isFunction(connect))
    })

    it('disconnects when the attached lifecycle is disposed', () => {
      const handler = () => {}
      let destroy
      const onDestroy = cb => (destroy = cb)
      const connect = attach(onDestroy)
      const cyclo = resolve(handler)
      connect(handler)
      const disposed = fake()
      cyclo.onDispose(disposed)
      assert(disposed.notCalled)
      lifecycle.destroy()
      assert(disposed.notCalled)
      destroy()
      assert(disposed.calledOnce)
    })

    it('disposes all cyclotrons when bootstrap component is destroyed', () =>
      test_disposes_all_on_bootstrap_destroy(
        attach(lifecycle.onDestroy),
        disposeAll,
      ))

    it('disposes a cyclotron when its number of connections falls from 1 to 0', () => {
      const handler = () => {}
      attach(lifecycle.onDestroy)(handler)
      const cyclo = resolve(handler)
      const disposed = fake()
      cyclo.onDispose(disposed)
      assert(disposed.notCalled)
      lifecycle.destroy()
      assert(disposed.calledOnce)
    })
  })

  describe('connect', () => {
    let wrapConnection
    let disposeAll
    beforeEach(() => {
      wrapConnection = fake()
      disposeAll = bootstrap({
        wrapConnection,
      })
    })
    afterEach(() => {
      disposeAll()
    })

    it('is a function', () => {
      assert(isFunction(connect))
    })

    it('resolves actual connect function from context', () => {
      const runtime = bootstrap.debugConfig()
      runtime.connect = fake()
      connect('xxx')
      assert(runtime.connect.calledOnceWith('xxx'))
    })

    it('lazily creates cyclotrons', () => {
      const handler = fake()
      assert.equal(handler.callCount, 0)
      connect(handler)
      assert.equal(handler.callCount, 1)
    })

    it('resolves already created cyclotrons from context, base on their handler identity', () => {
      const handler = fake()
      const cyclo = resolve(handler)
      const resolved = connect.resolve(handler)
      assert.strictEqual(resolved, cyclo)
    })

    it('wraps connections with wrapConnection', () => {
      assert.equal(wrapConnection.callCount, 0)
      connect(() => {})
      assert.equal(wrapConnection.callCount, 1)
      connect(() => {})
      assert.equal(wrapConnection.callCount, 2)
    })

    it('disposes all cyclotrons when bootstrap component is destroyed', () =>
      test_disposes_all_on_bootstrap_destroy(connect, disposeAll))

    it('disposes a cyclotron when its number of connections falls from 1 to 0', () => {
      const handler = () => {}
      connect(handler)
      const cyclo = resolve(handler)
      const disposed = fake()
      cyclo.onDispose(disposed)
      assert(disposed.notCalled)
      lifecycle.destroy()
      assert(disposed.calledOnce)
    })

    it('does not dispose a cyclotron that connects to itself (daemon)', () => {
      const handler = () => {
        connect(handler)
      }
      connect(handler)
      const cyclo = resolve(handler)
      const disposed = fake()
      cyclo.onDispose(disposed)
      // before onDestroy
      assert(disposed.notCalled)
      assert.equal(cyclo._refCount, 2)
      // after onDestroy
      lifecycle.destroy()
      assert(disposed.notCalled)
      assert.equal(cyclo._refCount, 1)
      // after extraneous onDestroy
      lifecycle.destroy()
      assert(disposed.notCalled)
      assert.equal(cyclo._refCount, 1)
    })
  })
})
