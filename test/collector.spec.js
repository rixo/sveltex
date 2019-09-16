import assert from 'assert'
import { fake } from 'sinon'

import createCollector from '@/collector'

const nextTo = ({ _ }) => x => _.next(x)

describe('createCollector', () => {
  it('is a function', () => {
    assert.equal(typeof createCollector, 'function')
  })
})

describe('collector', () => {
  let collector
  beforeEach(() => {
    collector = createCollector()
  })

  it('is an object', () => {
    assert.equal(typeof collector, 'object')
  })

  describe('the _ property', () => {
    it('is an observer object', () => {
      assert.equal(typeof collector._.next, 'function', 'has a next method')
      assert.equal(
        typeof collector._.complete,
        'undefined',
        'has no complete method'
      )
      assert.equal(typeof collector._.error, 'function', 'has an error method')
    })

    it('exposes a dispose function', () => {
      assert.equal(
        typeof collector._.dispose,
        'function',
        'has a dispose method'
      )
    })
  })

  describe('the $ property', () => {
    it('has a subscribe function', () => {
      assert.equal(typeof collector.$.subscribe, 'function')
    })

    describe('the subscribe function', () => {
      it('returns a dispose function', () => {
        const dispose = collector.$.subscribe()
        assert.equal(typeof dispose, 'function')
      })
    })

    it('accepts functions as observer', () => {
      const next = fake()
      collector.$.subscribe(next)
      assert(next.notCalled)
      collector._.next(42)
      assert(next.calledOnceWith(42))
      collector._.error(new Error('oops'))
      assert(next.calledOnceWith(42), 'not called on error')
    })

    describe('with an observer object', () => {
      it('calls next on emissions', () => {
        const next = fake()
        const observer = { next }
        collector.$.subscribe(observer)
        assert(next.notCalled)
        collector._.next(42)
        assert(next.calledOnceWith(42))
      })

      it('calls error on errors', () => {
        const error = fake()
        const observer = { error }
        collector.$.subscribe(observer)
        collector._.next(42)
        const err = new Error('oops')
        collector._.error(err)
        assert(error.calledOnceWith(err), 'calls error handler')
      })

      it('calls complete on completion', () => {
        const complete = fake()
        const observer = { complete }
        collector.$.subscribe(observer)
        collector._.next(42)
        assert(complete.notCalled)
        collector._.dispose()
        assert(complete.calledOnce)
      })

      it('returns a dispose function on subscribe', () => {
        const sub = collector.$.subscribe()
        assert.equal(typeof sub, 'function')
      })
    })

    it('emits values to first observer', () => {
      const next = fake()
      collector.$.subscribe(next)
      assert(next.notCalled)
      collector._.next(1)
      assert(next.calledOnceWith(1))
    })

    it('emits values to second observer', () => {
      const next1 = fake()
      const next2 = fake()
      collector.$.subscribe(next1)
      collector.$.subscribe(next2)
      assert(next2.notCalled)
      collector._.next(1)
      assert(next2.calledOnceWith(1))
    })

    it('flushes all past values to first observer', () => {
      const next = fake()
      const values = [1, 2, 3]
      const expected = values.map(x => Array.of(x))
      values.forEach(nextTo(collector))
      assert(next.notCalled)
      collector.$.subscribe(next)
      assert.deepEqual(next.args, expected)
    })

    it('becomes hot after first observer', () => {
      const next = fake()
      const values = [1, 2, 3]
      values.forEach(nextTo(collector))
      // first observer
      collector.$.subscribe(next)
      // second
      const next2 = fake()
      collector.$.subscribe(next2)
      assert(next2.notCalled)
      collector._.next(42)
      // assert(next.calledOnceWith(42))
      assert(next2.calledOnceWith(42))
    })
  })

  // describe.skip('with rxjs streams', () => {
  //   it('it is unsubscribed when the streams end', () => {
  //     const dispose = fake()
  //     const stream = toRx(of(5, 6)).pipe(map(x => x * 2))
  //     const subscribe = spy(collector, 'subscribe')
  //     collector.subscribe()
  //     // assert(dispose.notCalled)
  //   })
  // })

  // it('is initially a pullable source', () => {
  //   sink.subscribe()
  // })
})
