import assert from 'assert'
import { fake } from 'sinon'

import createPort from '@/port'

const nextTo = ({ _ }) => x => _.next(x)

describe('createPort', () => {
  it('is a function', () => {
    assert.equal(typeof createPort, 'function')
  })
})

describe('port', () => {
  let port
  beforeEach(() => {
    port = createPort()
  })

  it('is an object', () => {
    assert.equal(typeof port, 'object')
  })

  describe('the _ property', () => {
    it('is an observer object', () => {
      assert.equal(typeof port._.next, 'function', 'has a next method')
      assert.equal(
        typeof port._.complete,
        'undefined',
        'has no complete method'
      )
      assert.equal(typeof port._.error, 'function', 'has an error method')
    })

    it('exposes a dispose function', () => {
      assert.equal(typeof port._.dispose, 'function', 'has a dispose method')
    })
  })

  describe('the $ property', () => {
    it('has a subscribe function', () => {
      assert.equal(typeof port.$.subscribe, 'function')
    })

    describe('the subscribe function', () => {
      it('returns a dispose function', () => {
        const dispose = port.$.subscribe()
        assert.equal(typeof dispose, 'function')
      })
    })

    it('accepts functions as observer', () => {
      const next = fake()
      port.$.subscribe(next)
      assert(next.notCalled)
      port._.next(42)
      assert(next.calledOnceWith(42))
      port._.error(new Error('oops'))
      assert(next.calledOnceWith(42), 'not called on error')
    })

    describe('with an observer object', () => {
      it('calls next on emissions', () => {
        const next = fake()
        const observer = { next }
        port.$.subscribe(observer)
        assert(next.notCalled)
        port._.next(42)
        assert(next.calledOnceWith(42))
      })

      it('calls error on errors', () => {
        const error = fake()
        const observer = { error }
        port.$.subscribe(observer)
        port._.next(42)
        const err = new Error('oops')
        port._.error(err)
        assert(error.calledOnceWith(err), 'calls error handler')
      })

      it('calls complete on completion', () => {
        const complete = fake()
        const observer = { complete }
        port.$.subscribe(observer)
        port._.next(42)
        assert(complete.notCalled)
        port._.dispose()
        assert(complete.calledOnce)
      })

      it('returns a dispose function on subscribe', () => {
        const sub = port.$.subscribe()
        assert.equal(typeof sub, 'function')
      })
    })

    it('emits values to first observer', () => {
      const next = fake()
      port.$.subscribe(next)
      assert(next.notCalled)
      port._.next(1)
      assert(next.calledOnceWith(1))
    })

    it('emits values to second observer', () => {
      const next1 = fake()
      const next2 = fake()
      port.$.subscribe(next1)
      port.$.subscribe(next2)
      assert(next2.notCalled)
      port._.next(1)
      assert(next2.calledOnceWith(1))
    })

    it('flushes all past values to first observer', () => {
      const next = fake()
      const values = [1, 2, 3]
      const expected = values.map(x => Array.of(x))
      values.forEach(nextTo(port))
      assert(next.notCalled)
      port.$.subscribe(next)
      assert.deepEqual(next.args, expected)
    })

    it('becomes hot after first observer', () => {
      const next = fake()
      const values = [1, 2, 3]
      values.forEach(nextTo(port))
      // first observer
      port.$.subscribe(next)
      // second
      const next2 = fake()
      port.$.subscribe(next2)
      assert(next2.notCalled)
      port._.next(42)
      // assert(next.calledOnceWith(42))
      assert(next2.calledOnceWith(42))
    })
  })

  // describe.skip('with rxjs streams', () => {
  //   it('it is unsubscribed when the streams end', () => {
  //     const dispose = fake()
  //     const stream = toRx(of(5, 6)).pipe(map(x => x * 2))
  //     const subscribe = spy(port, 'subscribe')
  //     port.subscribe()
  //     // assert(dispose.notCalled)
  //   })
  // })

  // it('is initially a pullable source', () => {
  //   sink.subscribe()
  // })
})
