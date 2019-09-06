import { map, multicast } from 'rxjs/operators'
import { EMPTY, NEVER, of, concat, ReplaySubject } from 'rxjs'
import assert from 'assert'
import { fake } from 'sinon'

import { createConnector } from '@/connect'
import { isFunction } from '@/util/fp'

const double = x => 2 * x

const FakeContext = () => {
  let context = new Map()

  const setContext = (key, value) => context.set(key, value)

  const getContext = key => context.get(key)

  const clear = () => {
    context = new Map()
  }

  return { setContext, getContext, clear }
}

const FakeLifecycle = () => {
  let destroyHandlers = []

  const onDestroy = handler => {
    destroyHandlers.push(handler)
  }

  const destroy = () => {
    destroyHandlers.forEach(handler => handler())
    destroyHandlers = []
  }

  return { onDestroy, destroy }
}

const spyObservable = (source$, end$ = NEVER) => {
  const stream = concat(source$, end$)
  const { subscribe: superSubscribe } = stream
  const subscribe = fake(function(...args) {
    const sub = superSubscribe.apply(this, args)
    const { unsubscribe: superUnsubscribe } = sub
    const unsubscribe = fake(function(...args) {
      stream.unsubscribeCount++
      return superUnsubscribe.apply(this, args)
    })
    stream.subscribeCount++
    return Object.assign(sub, { unsubscribe })
  })
  return Object.assign(stream, {
    subscribe,
    subscribeCount: 0,
    unsubscribeCount: 0,
  })
}

describe('connect', () => {
  let context
  let lifecycle
  let connect
  let configure

  beforeEach(() => {
    context = FakeContext()
    lifecycle = FakeLifecycle()
    connect = createConnector({ ...context, ...lifecycle })
    // connect = connector.connect
    // configure = connector.configure
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
    assert.equal(typeof connect, 'function')
  })

  it('resolves read-only providers to their source stream', () => {
    const source$$ = () => of(42)
    const source$ = connect(source$$)
    const next = fake()
    assert.equal(next.callCount, 0)
    disposable(source$.subscribe(next))
    assert.equal(next.callCount, 1)
    assert.equal(next.lastArg, 42)
  })

  it('resolves write-only providers to their sink write function', () => {
    const next = fake()
    const _foo = sink$ => {
      sink$.subscribe(next)
    }
    const foo = connect(_foo)
    const value$ = of(42)
    assert.equal(next.callCount, 0)
    foo(value$)
    assert.equal(next.callCount, 1)
    assert.equal(next.lastArg, 42)
  })

  // const _foo = ({ sinkA$, sinkB$ }) => ...
  it.skip('resolves sink objects', () => {
    const nextA = fake()
    const nextB = fake()
    const _foo = o => {
      o.a$.subscribe(nextA)
      o.b$.subscribe(nextB)
    }
    const foo = connect(_foo)
    const a$ = of(42)
    const b$ = of(54)
    assert.equal(nextA.callCount, 0)
    assert.equal(nextB.callCount, 0)
    foo({ a$, b$ })
    assert.equal(nextA.callCount, 1)
    assert.equal(nextA.lastArg, 42)
    // assert.equal(nextB.callCount, 0)
    // foo({ b$ })
    assert.equal(nextA.callCount, 1)
    assert.equal(nextA.callCount, 1)
    assert.equal(nextA.lastArg, 54)
  })

  describe('mixed source & sink', () => {
    it('returns the source$', () => {
      // eslint-disable-next-line no-unused-vars
      const _foo$$ = sink$ => of(42)
      const foo$ = connect(_foo$$)
      assert.ok(foo$)
      assert(isFunction(foo$.subscribe), 'foo$ is a stream')
    })

    it('returns an object that can be destructured as [sink, source$]', () => {
      // eslint-disable-next-line no-unused-vars
      const _foo$$ = sink$ => of(33)
      const [foo, foo$] = connect(_foo$$)
      assert(isFunction(foo), 'foo is a function')
      assert.ok(foo$)
      assert(isFunction(foo$.subscribe), 'foo$ is a stream')
    })

    it('returns an object that can be destructured as {_, $}', () => {
      // eslint-disable-next-line no-unused-vars
      const _foo$$ = sink$ => of(33)
      const { _: foo, $: foo$ } = connect(_foo$$)
      assert.equal(typeof foo, 'function')
      assert.ok(foo$)
      assert.equal(typeof foo$.subscribe, 'function')
    })

    it('returns a writable store (enables $foo$ = 42 in svelte)', () => {
      const next = fake()
      const _foo$$ = sink$ => sink$
      const foo$ = connect(_foo$$)
      assert.ok(foo$)
      assert(isFunction(foo$.subscribe), 'foo$ is a stream')
      assert(isFunction(foo$.set), 'foo$ is a writable store')
      disposables.push(foo$.subscribe(next))
      assert(next.notCalled)
      foo$.set(42)
      assert(next.calledOnceWith(42))
    })

    it('resolves mixed source & sink', () => {
      const nextIn = fake()
      const nextOut = fake()
      const _foo$$ = sink$ => {
        sink$.pipe(map(double)).subscribe(nextIn)
        return sink$.pipe(map(x => x * 3))
      }
      // const [foo, foo$] = connect(_foo$$)
      const { _: foo, $: foo$ } = connect(_foo$$)
      disposable(foo$.subscribe(nextOut))
      assert(nextIn.notCalled)
      assert(nextOut.notCalled)
      foo(of(42))
      assert(nextIn.calledOnceWith(84), 'value written to sink')
      assert(nextOut.calledOnceWith(126), 'value output from source')
    })
  })

  describe("sink's write function", () => {
    it('accepts streams', () => {
      const next = fake()
      const _foo = sink$ => {
        sink$.subscribe(next)
      }
      const foo = connect(_foo)
      foo(of('lifted'))
      assert(next.calledOnceWith('lifted'))
    })

    it('accepts flat values', () => {
      const next = fake()
      const _foo = sink$ => {
        sink$.subscribe(next)
      }
      const foo = connect(_foo)
      foo('flat')
      assert(next.calledOnceWith('flat'))
    })

    it('can be called multiple times on same connection', () => {
      const next = fake()
      const _foo = sink$ => {
        sink$.subscribe(next)
      }
      const foo = connect(_foo)
      assert(next.notCalled)
      foo(of(42))
      assert(next.calledOnceWith(42))
      foo(of(54))
      assert.equal(next.callCount, 2)
      assert.equal(next.lastArg, 54)
    })

    it('can be called with multi value observable', () => {
      const next = fake()
      const _foo = sink$ => {
        sink$.subscribe(next)
      }
      const foo = connect(_foo)
      assert(next.notCalled)
      foo(of(42, 54))
      assert.equal(next.callCount, 2)
      assert.equal(next.lastArg, 54)
    })

    it('unsubscribes from passed observables on destroy', () => {
      const next = fake()
      const value$ = spyObservable(of(20, 29))
      const _foo = sink$ => {
        sink$.subscribe(next)
      }
      const foo = connect(_foo)
      assert.equal(value$.unsubscribeCount, 0)
      foo(value$)
      assert.equal(value$.unsubscribeCount, 0)
      lifecycle.destroy()
      assert.equal(value$.unsubscribeCount, 1)
      lifecycle.destroy()
      assert.equal(value$.unsubscribeCount, 1)
    })
  })

  describe('source$', () => {
    it('is unsubscribed when downstream is unsubscribed', () => {
      const next = fake()
      const value$ = spyObservable(of(1, 2, 3))
      const foo$$ = () => value$
      const foo$ = connect(foo$$)
      assert(next.notCalled)
      const sub = foo$.subscribe(next)
      assert.equal(next.callCount, 3)
      assert.equal(value$.unsubscribeCount, 0)
      sub.unsubscribe()
      assert.equal(value$.unsubscribeCount, 1)
    })

    describe('with ReplaySubject', () => {
      it('is unsubscribed when downstream is unsubscribed', () => {
        const next = fake()
        const value$ = spyObservable(
          of(42)
            .pipe(multicast(() => new ReplaySubject(1)))
            .refCount(),
          EMPTY
        )
        const foo$$ = () => value$
        const foo$ = connect(foo$$)
        assert(next.notCalled)
        const sub = foo$.subscribe(next)

        assert.equal(next.callCount, 1)
        assert.equal(value$.unsubscribeCount, 0)

        sub.unsubscribe()

        assert.equal(value$.unsubscribeCount, 1)
      })

      it('is resubscribed when downstream is resubscribed after dipose', () => {
        const next = fake()
        const value$ = spyObservable(of(42))
        const foo$$ = () =>
          value$.pipe(multicast(() => new ReplaySubject(1))).refCount()
        const foo$ = connect(foo$$)
        assert(next.notCalled)
        const sub = foo$.subscribe(next)

        assert.equal(next.callCount, 1)
        assert.equal(value$.unsubscribeCount, 0, 'not unsubscribed')
        assert.equal(value$.subscribeCount, 2)

        sub.unsubscribe()

        assert.equal(value$.unsubscribeCount, 2)
        assert.equal(value$.subscribeCount, 2)

        const sub2 = foo$.subscribe(next)
        assert.equal(next.callCount, 2)
        assert.equal(value$.unsubscribeCount, 2)
        assert.equal(value$.subscribeCount, 4)

        sub2.unsubscribe()
        assert.equal(next.callCount, 2)
        assert.equal(value$.unsubscribeCount, 4)
        assert.equal(value$.subscribeCount, 4)
      })
    })
  })
})
