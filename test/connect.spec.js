import assert from 'assert'
import { fake } from 'sinon'

import makeConnector from '@/connect'
import { isFunction } from '@/util'

import { FakeContext } from './helpers'

describe('connect', () => {
  let context
  let connect
  let resolve
  let bootstrap

  beforeEach(() => {
    context = FakeContext()
    const provider = makeConnector(context)
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
      const resolved = resolve(handler)
      assert.strictEqual(resolved, cyclo)
    })

    it('dispose all cyclotrons when bootstrap component is destroyed', () => {
      const handlers = {
        a: () => {},
        b: sink$ => sink$,
        c: () => {
          connect(handlers.a)
        },
      }
      // connect
      connect(handlers.b)
      connect(handlers.c)
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
    })

    it('wraps connections with wrapConnection', () => {
      assert.equal(wrapConnection.callCount, 0)
      connect(() => {})
      assert.equal(wrapConnection.callCount, 1)
      connect(() => {})
      assert.equal(wrapConnection.callCount, 2)
    })
  })
})
