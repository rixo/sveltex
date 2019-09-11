import assert from 'assert'
import { fake, spy } from 'sinon'
import toRx from 'callbag-to-rxjs'
import of from 'callbag-of'
import { map } from 'rxjs/operators'

import makeSink from '@/sink'

const nextTo = sink => x => sink.next(x)

describe('sink', () => {
  describe('import sink from "sveltex/sink"', () => {
    it('is function', () => {
      assert.equal(typeof makeSink, 'function')
    })
  })

  describe('a sink', () => {
    let sink
    beforeEach(() => {
      sink = makeSink()
    })

    // it('is an object', () => {
    //   assert.equal(typeof sink, 'object')
    // })

    it('can be used as an observable listener', () => {
      assert.equal(typeof sink.next, 'function')
      assert.equal(typeof sink.complete, 'function')
      assert.equal(typeof sink.error, 'function')
    })

    it('can be used as a stream source', () => {
      assert.equal(typeof sink.subscribe, 'function')
    })

    describe('as a listener', () => {
      it('has a next method', () => {
        assert.equal(typeof sink.next, 'function')
      })

      it('has a error method', () => {
        assert.equal(typeof sink.error, 'function')
      })

      it('has a complete method', () => {
        assert.equal(typeof sink.complete, 'function')
      })

      it('can be subscribed to a stream', () => {
        const next = fake()
        sink.subscribe(next)
        assert(next.notCalled)
        toRx(of(1, 2, 3)).subscribe(sink)
        assert.equal(next.callCount, 3)
      })

      it('can be subscribed to multiple completing stream', () => {
        const next = fake()
        const complete = fake()
        sink.subscribe({ next, complete })
        assert(next.notCalled)
        toRx(of(1, 2, 3)).subscribe(sink)
        assert.equal(next.callCount, 3)
        assert.equal(complete.callCount, 1)
        toRx(of(5, 6)).subscribe(sink)
        assert.equal(next.callCount, 5)
        assert.equal(complete.callCount, 2)
      })
    })

    describe('as a source stream', () => {
      it('accepts functions as observer', () => {
        const next = fake()
        sink.subscribe(next)
        assert(next.notCalled)
        sink.next(42)
        assert(next.calledOnceWith(42))
        sink.error(new Error('oops'))
        assert(next.calledOnceWith(42), 'not called on error')
      })

      describe('with an observer object', () => {
        it('calls next on emissions', () => {
          const next = fake()
          const observer = { next }
          sink.subscribe(observer)
          assert(next.notCalled)
          sink.next(42)
          assert(next.calledOnceWith(42))
        })

        it('calls error on errors', () => {
          const error = fake()
          const observer = { error }
          sink.subscribe(observer)
          sink.next(42)
          const err = new Error('oops')
          sink.error(err)
          assert(error.calledOnceWith(err), 'calls error handler')
        })

        it('calls complete on completion', () => {
          const complete = fake()
          const observer = { complete }
          sink.subscribe(observer)
          sink.next(42)
          assert(complete.notCalled)
          sink.complete()
          assert(complete.calledOnce)
        })

        it('returns a dispose function on subscribe', () => {
          const sub = sink.subscribe()
          assert.equal(typeof sub, 'function')
        })
      })

      it('emits values to first observer', () => {
        const next = fake()
        sink.subscribe(next)
        assert(next.notCalled)
        sink.next(1)
        assert(next.calledOnceWith(1))
      })

      it('emits values to second observer', () => {
        const next1 = fake()
        const next2 = fake()
        sink.subscribe(next1)
        sink.subscribe(next2)
        assert(next2.notCalled)
        sink.next(1)
        assert(next2.calledOnceWith(1))
      })

      it('flushes all past values to first observer', () => {
        const next = fake()
        const values = [1, 2, 3]
        const expected = values.map(x => Array.of(x))
        values.forEach(nextTo(sink))
        assert(next.notCalled)
        sink.subscribe(next)
        assert.deepEqual(next.args, expected)
      })

      it('becomes hot after first observer', () => {
        const next = fake()
        const values = [1, 2, 3]
        values.forEach(nextTo(sink))
        // first observer
        sink.subscribe(next)
        // second
        const next2 = fake()
        sink.subscribe(next2)
        assert(next2.notCalled)
        sink.next(42)
        // assert(next.calledOnceWith(42))
        assert(next2.calledOnceWith(42))
      })
    })

    describe.skip('with rxjs streams', () => {
      it('it is unsubscribed when the streams end', () => {
        const dispose = fake()
        const stream = toRx(of(5, 6)).pipe(map(x => x * 2))
        const subscribe = spy(sink, 'subscribe')
        sink.subscribe()
        // assert(dispose.notCalled)
      })
    })

    // it('is initially a pullable source', () => {
    //   sink.subscribe()
    // })
  })
})
