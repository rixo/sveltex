import assert from 'assert'
import { fake } from 'sinon'
import { EMPTY, from, of, Observable, pipe } from 'rxjs'
import {
  mergeMap,
  retry,
  share,
  shareReplay,
  switchMap,
  tap,
  finalize,
} from 'rxjs/operators'

import { writable } from 'svelte/store'

describe('assumptions', () => {
  it.skip('works', () => {
    const next = fake()
    const store = writable()
    const { set } = store
    const $ = of()
    // store.subscribe(next)
    set(42)
    set(54)
    assert.deepEqual(next.args, [[undefined], [42], [54]])

    // writable(42, set => {
    //   const dispose = () => {}
    //
    //   return dispose
    // })
  })

  const it_lets_errors_pass_through = create =>
    it('lets errors pass through', () => {
      const err = new Error('bim')
      const o = pipe(switchMap(x => of(10 * x)))(create(err))
      const next = fake()
      const error = fake()
      o.subscribe({ next, error })
      assert(next.calledOnceWith(10))
      assert(error.calledOnceWith(err))
    })

  const it_lets_complete_pass_through = create =>
    it('lets complete pass through', () => {
      const o = pipe(switchMap(x => of(10 * x)))(create())
      const next = fake()
      const complete = fake()
      o.subscribe({ next, complete })
      assert(next.calledOnceWith(10))
      assert(complete.calledOnceWith())
    })

  describe('a svelte store', () => {})

  describe('switchMap', () => {
    it('lets errors pass through', () => {
      const err = new Error('bim')
      const producer = observer => {
        observer.next(1)
        observer.error(err)
        observer.next(2)
      }
      const o = new Observable(producer).pipe(switchMap(x => of(10 * x)))
      const next = fake()
      const error = fake()
      o.subscribe({ next, error })
      assert(next.calledOnceWith(10))
      assert(error.calledOnceWith(err))
    })

    it('lets complete pass through', () => {
      const producer = observer => {
        observer.next(1)
        observer.complete()
        observer.next(2)
      }
      const o = new Observable(producer).pipe(switchMap(x => of(10 * x)))
      const next = fake()
      const complete = fake()
      o.subscribe({ next, complete })
      assert(next.calledOnceWith(10))
      assert(complete.calledOnceWith())
    })
  })

  describe('RxJS', () => {
    describe('of(...)', () => {
      it('completes', () => {
        const sink$ = of(1)
        const next = fake()
        const complete = fake()
        sink$.subscribe({ next, complete })
        assert.deepEqual(next.args, [[1]])
        assert(complete.calledOnce)
      })

      it("can be tap'd for complete", () => {
        const sink$ = of(1, 2)
        const next = fake()
        const complete = fake()
        sink$.pipe(tap({ complete })).subscribe({ next })
        assert.deepEqual(next.args, [[1], [2]])
        assert(complete.calledOnce)
      })

      it("can be tap'd for complete in switchMap", () => {
        const values = [1, 2]
        const sink$ = of(...values)
        const next = fake()
        const complete = fake()
        sink$
          .pipe(
            switchMap(x =>
              new Observable(obs => {
                obs.next(x * 10)
                obs.complete()
                obs.next(42)
              }).pipe(finalize(complete))
            )
          )
          .subscribe({ next })
        assert.deepEqual(next.args, values.map(x => [x * 10]))
        assert.equal(complete.callCount, values.length)
      })
    })
  })

  describe('use cases', () => {
    // const longRunning = config$ => config$.pipe(
    //   retry(),
    //   switchMap(
    //     config => new Observable(
    //       async ({ next }) => {
    //         const db = await createDb(config)
    //         next(db)
    //         const dispose = () => db.destroy().catch(err => { ... })
    //         return dispose
    //       }
    //     )
    //   ),
    //   tap({
    //     complete: () => {
    //
    //     }
    //   }),
    //   share(),
    // )
    describe('pattern: pausable service', () => {
      it('can tap complete after switchMap', () => {
        const next = fake()
        const complete = fake()
        const producer = observer => {
          observer.next(1)
          observer.complete()
          observer.next(2)
        }
        const o = new Observable(producer).pipe(
          switchMap(x => of(10 * x)),
          tap({ complete })
        )
        o.subscribe({ next })
        assert(next.calledOnceWith(10))
        assert(complete.calledOnceWith())
      })

      it('reruns after complete', () => {
        const dispose = fake()
        const producer = fake(observer => {
          observer.next(1)
          observer.next(2)
          observer.complete() // imagine the complete has come from sink$
          observer.next(3)
          return dispose
        })
        const complete = fake()
        const o = new Observable(producer).pipe(
          switchMap(x => of(10 * x)),
          tap({ complete })
        )
        {
          const next = fake()
          o.subscribe({ next })
          assert.deepEqual(next.args, [[10], [20]])
          assert(producer.calledOnce)
          assert(dispose.calledOnce)
          assert(complete.calledOnce)
        }
        {
          const next = fake()
          o.subscribe({ next })
          assert.deepEqual(next.args, [[10], [20]])
          assert.equal(producer.callCount, 2)
          assert.equal(dispose.callCount, 2)
          assert.equal(complete.callCount, 2)
        }
      })

      it('reruns after complete when piped', () => {
        const complete = fake()
        const config$ = of(1, 2)
        const createService = cfg => of(10 * cfg).pipe(tap({ complete }))
        const o = config$.pipe(switchMap(createService))
        {
          const next = fake()
          o.subscribe({ next })
          assert.deepEqual(next.args, [[10], [20]])
          assert.equal(complete.callCount, 2)
        }
        {
          const next = fake()
          o.subscribe({ next })
          assert.deepEqual(next.args, [[10], [20]])
          assert.equal(complete.callCount, 4)
        }
      })

      it.skip('reruns after complete when piped', () => {
        const complete = fake()
        const source = of(1, 2)
        const o = source.pipe(
          switchMap(x => of(10 * x)), // <- create here & store local ref
          tap({ complete }) // <- dispose here
        )
        {
          const next = fake()
          o.subscribe({ next })
          assert.deepEqual(next.args, [[10], [20]])
          assert(complete.calledOnce)
        }
        {
          const next = fake()
          o.subscribe({ next })
          assert.deepEqual(next.args, [[10], [20]])
          assert.equal(complete.callCount, 2)
        }
      })

      // it('can shareReplay after tap complete after switchMap', () => {
      //   const complete = fake()
      //   const producer = observer => {
      //     observer.next(1)
      //     observer.next(2)
      //     observer.complete()
      //     observer.next(3)
      //   }
      //   const o = new Observable(producer).pipe(
      //     switchMap(x => of(10 * x)),
      //     tap({ complete }),
      //     shareReplay()
      //   )
      //   {
      //     const next = fake()
      //     o.subscribe({ next })
      //     assert.deepEqual(next.args, [[10], [20]])
      //     assert(complete.calledOnceWith())
      //   }
      //   {
      //     const next = fake()
      //     o.subscribe({ next })
      //     assert.deepEqual(next.args, [[10], [20]])
      //     assert(complete.calledOnceWith())
      //   }
      // })
    })
  })
})
