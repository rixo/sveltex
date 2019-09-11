import assert from 'assert'
import { fake, spy } from 'sinon'
import toRx from 'callbag-to-rxjs'
import of from 'callbag-of'
import { map } from 'rxjs/operators'

import createSink from '@/port'

const nextTo = ({ _ }) => x => _.next(x)

describe('port', () => {
  describe('import createPort from "sveltex/port"', () => {
    it('is function', () => {
      assert.equal(typeof createSink, 'function')
    })
  })

  describe('a port', () => {
    let port
    beforeEach(() => {
      port = createSink()
    })

    // it('is an object', () => {
    //   assert.equal(typeof sink, 'object')
    // })

    describe('_ property', () => {
      it('can be used as an observable listener', () => {
        assert.equal(typeof port._.next, 'function')
        assert.equal(typeof port._.complete, 'function')
        assert.equal(typeof port._.error, 'function')
      })

      it('has a next method', () => {
        assert.equal(typeof port._.next, 'function')
      })

      it('has a error method', () => {
        assert.equal(typeof port._.error, 'function')
      })

      it('has a complete method', () => {
        assert.equal(typeof port._.complete, 'function')
      })

      it('can be subscribed to a stream', () => {
        const next = fake()
        port.$.subscribe(next)
        assert(next.notCalled)
        toRx(of(1, 2, 3)).subscribe(port._)
        assert.equal(next.callCount, 3)
      })

      it('can be subscribed to multiple completing stream', () => {
        const next = fake()
        const complete = fake()
        port.$.subscribe({ next, complete })
        assert(next.notCalled)
        toRx(of(1, 2, 3)).subscribe(port._)
        assert.equal(next.callCount, 3)
        assert.equal(complete.callCount, 1)
        toRx(of(5, 6)).subscribe(port._)
        assert.equal(next.callCount, 5)
        assert.equal(complete.callCount, 2)
      })
    })

    describe('$ property', () => {
      it('can be used as a stream source (i.e. has a subscribe function)', () => {
        assert.equal(typeof port.$.subscribe, 'function')
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
          port._.complete()
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

    describe.skip('with rxjs streams', () => {
      it('it is unsubscribed when the streams end', () => {
        const dispose = fake()
        const stream = toRx(of(5, 6)).pipe(map(x => x * 2))
        const subscribe = spy(port, 'subscribe')
        port.subscribe()
        // assert(dispose.notCalled)
      })
    })

    // it('is initially a pullable source', () => {
    //   sink.subscribe()
    // })
  })
})
