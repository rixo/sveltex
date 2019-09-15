import assert from 'assert'
import { fake } from 'sinon'
import {
  of,
  from,
  Observable,
  BehaviorSubject,
  Subject,
  ReplaySubject,
} from 'rxjs'
import {
  filter,
  map,
  mergeAll,
  mergeMap,
  multicast,
  share,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs/operators'
import subscribe from 'callbag-subscribe'
import toRx from 'callbag-to-rxjs'

import makeConnector from '@/connect'
import { isFunction, isStream } from '@/util'

import { FakeContext, FakeLifecycle, spyObservable } from './helpers'

const shareBehavior = init => o =>
  o.pipe(multicast(() => new BehaviorSubject(init))).refCount()

const myShareReplay = n => o =>
  o.pipe(multicast(() => new ReplaySubject(n))).refCount()

// import connect from '@/connect2'

/*

const producer = {
  // called when:
  // - first listener subscribes
  // - service is paused and listeners 0 -> 1
  start(listener) {
    const { next, error, complete } = listener
  },

  // optional
  // called when service listeners 1 -> 0
  pause() { ... },

  // optional
  // called when app (i.e. DI container) is disposed
  stop() { ... },
}

const service = sink$ => producer

const service = sink$ => {
  // spec: the function is called when service is started
  const db = createDb()

  sink$
    .subscribe({
      complete: () => {
        // ...
      }
    })
}

spec: service is started when listeners (connect) to service goes from 0 -> 1

const service = connect.pipe(_service1$_, _service2_) // write only
const service = connect.pipe(_service1$_, _service2) // write only
const service = connect.pipe(service1$_, _service2_) // read only
const service = connect.pipe(service1$_, _service2) // you can still connect it...

const service$ = connect.auto(service)
const service$ = connect.able(service)

const permanents = sink$ => {
  connect(db_)

  sink$.subcribe({
    complete: () => {}
  })
}

connect.attach(permanents)


// sink$: behavior
// complete: pause
const pausable = delay$ => {
  let id
  const next = delay => {
    id = setInterval(delay, next)
  }
  const complete = () => {
    clearInterval(id)
  }
  return delay$.pipe( tap({ next, complete }) )
}

const pausable_ = () => delay => new Observable(listener => {
  const { next, error, complete } = listener
  const tick = () => next()
  const id = setInterval(tick, delay)
  const dispose = () => {
    clearInterval(id)
  }
  return { dispose }
})

const selectablePausable$ = connect.auto(selectablePausable$_)

import { selectablePausable$ } from '@/model'
$: getInterval = $selectablePausable$

const selectablePausable$_ = sink$ => sink$
  .pipe(
    switchMap(async sink => {
      if (!sink) return
      const getInterval = await createService(sink.a, sink.b)
      return getInterval
    })
  )

// sink$: behavior
// complete: dispose
const longRunning = config$ => {
  let db
  return config$
    .pipe(
      switchMap(config => db = createDb(config))
      tap({
        complete: () => {
          if (!db) return
          db.dispose()
        },
      })
    )
}

// sink$: behavior
// complete: dispose
const longRunning = config$ => config$.pipe(
  retry(),
  switchMap(
    config => new Observable(
      async ({ next }) => {
        const db = await createDb(config)
        next(db)
        const dispose = () => db.destroy().catch(err => { ... })
        return dispose
      }
    )
  ),
  tap({
    complete: () => {

    }
  }),
  share(),
)

const longRunning = config$ => new Observable(({ next, complete }) => {
  config$
    .pipe(
      switchMap(config => createDb(config)),
      tap({
        complete() {
          if (!db) return
          db.dispose()
        }
      })
    )
    .subscribe()
})

 */

// describe('createConnector', () => {
//   it('is a function', () => {
//     assert(isFunction(createConnector))
//   })
//
//   it('returns a connect function', () => {
//     const context = FakeContext()
//     const lifecycle = FakeLifecycle()
//     const connect = createConnector({ ...context, ...lifecycle })
//     assert(isFunction(connect))
//   })
// })

const wrapConnection = (_, $) => {
  if (!$) {
    if (!_) {
      return Object.assign([_, $], { _, $ })
    }
    return wrapConnection(_, _)
  }
  return Object.assign($, {
    _,
    $,
    // enables: `const [_, $] = connect(_foo$$)`
    [Symbol.iterator]: () => [_, $][Symbol.iterator](),
    // enables: `$foo$ = 42` in svelte
    set: _ ? x => _(of(x)) : undefined,
    // NOTE subscribe is already present since $ is an actual stream
  })
}

describe('connect with RxJS', () => {
  let context
  let lifecycle
  let connect
  let bootstrap

  beforeEach(() => {
    context = FakeContext()
    lifecycle = FakeLifecycle()
    const connector = makeConnector({ ...context, ...lifecycle })
    connect = connector.connect
    bootstrap = connector.bootstrap
    bootstrap({
      readAdapter: toRx,
      writeAdapter: _ => input$ => {
        _.next(input$)
        // const sub = input$.subscribe(_)
        // return () => sub.unsubscribe()
      },
      wrapConnection,
    })
  })

  let disposables
  const disposable = (...args) => disposables.push(...args)

  beforeEach(() => {
    disposables = []
  })
  afterEach(() => {
    disposables.forEach(sub => sub.unsubscribe())
  })

  it('is a function', () => {
    assert(isFunction(connect))
  })

  describe('when sink emits complete', () => {
    // DEBUG what??
  })

  describe('when service listeners 1 -> 0', () => {
    it('stops the producer')
    it('(with the sink?) it sends complete on the sink') // DEBUG really?
    it('')
  })

  describe('read-only services', () => {
    it('returns a driver', () => {
      const service = { id: 'service' }
      const foo_ = () => service
      const foo = connect(foo_)
      assert.strictEqual(foo, service)
    })
  })

  describe('patterns', () => {
    describe('long lived service', () => {
      it('', () => {
        const dispose = fake()
        const _foo$_ = sink$ =>
          sink$.pipe(
            mergeAll(),
            switchMap(
              x =>
                new Observable(obs => {
                  obs.next(x * 2)
                  return dispose
                })
            ),
            shareReplay(1)
          )
        {
          const foo$ = connect(_foo$_)
          const next = fake()
          const sub = foo$.subscribe(next)
          assert.equal(next.callCount, 0)
          foo$._(of(1, 2, 3))
          assert.equal(next.callCount, 3)
          assert.equal(next.lastArg, 6)
          sub.unsubscribe()
        }
        {
          const foo$ = connect(_foo$_)
          const next = fake()
          const sub = foo$.subscribe(next)
          assert.equal(next.callCount, 1)
          assert.equal(next.lastArg, 6)
          foo$._(of(4, 5, 6))
          assert.equal(next.callCount, 4)
          assert.equal(next.lastArg, 12)
          sub.unsubscribe()
        }
      })

      describe('with no multicast', () => {
        describe('with serial subscribers', () => {
          it('', () => {
            // const _foo$_ = sink$ => sink$.pipe(map(x => x * 2))
            const dispose = fake()
            const _foo$_ = sink$ =>
              sink$.pipe(
                mergeAll(),
                switchMap(
                  x =>
                    new Observable(obs => {
                      obs.next(x * 2)
                      return dispose
                    })
                )
              )
            {
              const foo$ = connect(_foo$_)
              const next = fake()
              const sub = foo$.subscribe(next)
              foo$._(of(1, 2, 3))
              assert.equal(dispose.callCount, 2)
              sub.unsubscribe()
              assert.equal(dispose.callCount, 3)
            }
            {
              const foo$ = connect(_foo$_)
              const next = fake()
              const sub = foo$.subscribe(next)
              foo$._(of(4, 5, 6))
              assert.equal(dispose.callCount, 5)
              sub.unsubscribe()
              assert.equal(dispose.callCount, 6)
            }
          })
        })

        describe('with concurrent subscribers', () => {
          it('creates a new inner observable for each value in the sink for each subscriber', () => {
            const dispose = fake()
            const mapper = fake(
              x =>
                new Observable(obs => {
                  obs.next(x * 2)
                  return dispose
                })
            )
            const _foo$_ = sink$ =>
              sink$.pipe(
                mergeAll(),
                switchMap(mapper)
              )
            let next1, next2
            {
              const foo$ = connect(_foo$_)
              next1 = fake()
              disposable(foo$.subscribe(next1))
              assert.equal(mapper.callCount, 0)
              foo$._(of(1, 2, 3))
              assert.equal(mapper.callCount, 3)
            }
            {
              const foo$ = connect(_foo$_)
              next2 = fake()
              disposable(foo$.subscribe(next2))
              assert.equal(mapper.callCount, 3)
              foo$._(of(4, 5))
              assert.equal(mapper.callCount, 3 + 2 + 2)
            }
          })

          it('disposes every intermediate inner observables', () => {
            // const _foo$_ = sink$ => sink$.pipe(map(x => x * 2))
            const dispose = fake()
            const _foo$_ = sink$ =>
              sink$.pipe(
                mergeAll(),
                switchMap(
                  x =>
                    new Observable(obs => {
                      obs.next(x * 2)
                      return dispose
                    })
                )
              )
            let sub1, sub2, next1, next2
            {
              const foo$ = connect(_foo$_)
              next1 = fake()
              sub1 = foo$.subscribe(next1)
              disposable(sub1)
              foo$._(of(1, 2, 3))
              assert.equal(
                dispose.callCount,
                2,
                'intermediate observables have been disposed'
              )
            }
            {
              const foo$ = connect(_foo$_)
              next2 = fake()
              sub2 = foo$.subscribe(next2)
              disposable(sub2)
              foo$._(of(4, 5, 6))
              assert.equal(
                dispose.callCount,
                7,
                'intermediate observables have been disposed'
              )
            }
          })

          it('disposes last inner observables after unsubscribe', () => {
            // const _foo$_ = sink$ => sink$.pipe(map(x => x * 2))
            const dispose = fake()
            const _foo$_ = sink$ =>
              sink$.pipe(
                mergeAll(),
                switchMap(
                  x =>
                    new Observable(obs => {
                      obs.next(x * 2)
                      return dispose
                    })
                )
              )
            let sub1, sub2, next1, next2
            {
              const foo$ = connect(_foo$_)
              next1 = fake()
              sub1 = foo$.subscribe(next1)
              foo$._(of(1, 2, 3))
            }
            {
              const foo$ = connect(_foo$_)
              next2 = fake()
              sub2 = foo$.subscribe(next2)
              foo$._(of(4, 5, 6))
            }
            // sanity check
            assert.equal(
              dispose.callCount,
              7,
              'intermediate observables have been disposed'
            )
            // dispose
            sub1.unsubscribe()
            assert.equal(
              dispose.callCount,
              3 + 3 + 2,
              'last observable of subscription 1 has been disposed'
            )
            sub2.unsubscribe()
            assert.equal(
              dispose.callCount,
              3 + 3 + 3,
              'last observable of subscription 2 has been disposed'
            )
          })
        })
      })

      describe('with shareReplay', () => {
        it('last inner observable is disposed', () => {
          const dispose = fake()
          const complete = fake()
          const _foo$_ = sink$ =>
            sink$.pipe(
              mergeAll(),
              switchMap(
                x =>
                  new Observable(obs => {
                    obs.next(x * 2)
                    return dispose
                  })
              ),
              myShareReplay(1),
              tap({ complete })
            )
          // subscriber 1
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            foo$._(of(1, 2, 3))
            assert.equal(
              dispose.callCount,
              2,
              'intermediate observables are diposed'
            )
            sub.unsubscribe()
            assert.equal(
              dispose.callCount,
              3,
              'last observable is not disposed'
            )
          }
          // subscriber 2
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            foo$._(of(4, 5, 6))
            assert.equal(
              dispose.callCount,
              5,
              'last observable is not disposed'
            )
            sub.unsubscribe()
            assert.equal(
              dispose.callCount,
              6,
              'last observable is not disposed'
            )
          }
        })

        it('why? last inner observable is never disposed', () => {
          const dispose = fake()
          const complete = fake()
          const _foo$_ = sink$ =>
            sink$.pipe(
              mergeAll(),
              switchMap(
                x =>
                  new Observable(obs => {
                    obs.next(x * 2)
                    return dispose
                  })
              ),
              shareReplay(1),
              tap({ complete })
            )

          // subscriber 1
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            foo$._(of(1, 2, 3))
            assert.equal(
              dispose.callCount,
              2,
              'intermediate observables are diposed'
            )
            assert.equal(
              dispose.callCount,
              2,
              'last observable is not disposed'
            )
            sub.unsubscribe()
            assert.equal(
              dispose.callCount,
              2,
              'last observable is not disposed'
            )
          }
          // subscriber 2
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            foo$._(of(4, 5, 6))
            assert.equal(
              dispose.callCount,
              5,
              'last observable is not disposed'
            )
            sub.unsubscribe()
            assert.equal(
              dispose.callCount,
              5,
              'last observable is not disposed'
            )
          }
        })
      })

      describe('with shareBehavior', () => {
        it('creates a new inner observable for each value in the sink', () => {
          const dispose = fake()
          const producer = fake(
            x =>
              new Observable(obs => {
                obs.next(x * 2)
                return dispose
              })
          )
          const _foo$_ = sink$ =>
            sink$.pipe(
              mergeAll(),
              switchMap(producer),
              shareBehavior()
            )
          // subscriber 1
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            assert.equal(producer.callCount, 0)
            foo$._(of(1, 2, 3))
            assert.equal(producer.callCount, 3)
            sub.unsubscribe()
          }
          // subscriber 2
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            assert.equal(producer.callCount, 3)
            foo$._(of(4, 5, 6))
            assert.equal(producer.callCount, 6)
            sub.unsubscribe()
          }
        })

        it.skip('replays current value for late subscribers', () => {
          // const dispose = fake()
          const _foo$_ = sink$ =>
            sink$.pipe(
              switchMap(
                x =>
                  new Observable(obs => {
                    obs.next(x * 2)
                    // return dispose
                  })
              ),
              shareBehavior()
            )
          // subscriber 1
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            assert.equal(next.callCount, 1)
            assert.equal(next.lastArg, undefined)
            foo$._(of(1, 2, 3))
            assert.equal(next.callCount, 4)
            assert.equal(next.lastArg, 6)
            sub.unsubscribe()
          }
          // subscriber 2
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            assert.equal(next.callCount, 1)
            assert.equal(next.lastArg, 6)
            foo$._(of(4, 5, 6))
            assert.equal(next.callCount, 4)
            assert.equal(next.lastArg, 12)
            sub.unsubscribe()
          }
        })

        it('disposes last observable after last unsubscribe', () => {
          const dispose = fake()
          const _foo$_ = sink$ =>
            sink$.pipe(
              mergeAll(),
              switchMap(
                x =>
                  new Observable(obs => {
                    obs.next(x * 2)
                    return dispose
                  })
              ),
              shareBehavior()
            )
          // subscriber 1
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            foo$._(of(1, 2, 3))
            assert.equal(
              dispose.callCount,
              2,
              'last observable is not disposed'
            )
            sub.unsubscribe()
            assert.equal(dispose.callCount, 3, 'last observable is disposed')
          }
          // subscriber 2
          {
            const foo$ = connect(_foo$_)
            const next = fake()
            const sub = foo$.subscribe(next)
            foo$._(of(4, 5, 6))
            assert.equal(
              dispose.callCount,
              5,
              'current observable and new intermediate observables have been diposed'
            )
            sub.unsubscribe()
            assert.equal(
              dispose.callCount,
              6,
              'last observable has been disposed'
            )
          }
        })
      })

      // DEBUG DEBUG DEBUG
      it('with shareReplay, emits complete when ...', () => {
        // const _foo$_ = sink$ => sink$.pipe(map(x => x * 2))
        const dispose = fake()
        const complete = fake()
        const _foo$_ = sink$ =>
          sink$.pipe(
            mergeAll(),
            switchMap(
              x =>
                new Observable(obs => {
                  obs.next(x * 2)
                  return dispose
                })
            ),
            tap(complete),
            shareReplay(1)
          )
        // subscriber 1
        {
          const foo$ = connect(_foo$_)
          const next = fake()
          const sub = foo$.subscribe(next)
          foo$._(of(1, 2, 3))
          assert.equal(complete.callCount, 3)
          sub.unsubscribe()
          assert.equal(complete.callCount, 3)
        }
        // subscriber 2
        {
          const foo$ = connect(_foo$_)
          const next = fake()
          assert.equal(complete.callCount, 3)
          const sub = foo$.subscribe(next)
          assert.equal(complete.callCount, 3)
          foo$._(of(4, 5, 6))
          assert.equal(complete.callCount, 6)
          sub.unsubscribe()
          assert.equal(complete.callCount, 6)
        }
        // disconnect
        {
          lifecycle.destroy()
          // assert.equal(complete.callCount, 8)
          // await new Promise(resolve => setTimeout(resolve, 400))
          // assert.equal(dispose.callCount, 6)
        }
      })
    })
  })
})
