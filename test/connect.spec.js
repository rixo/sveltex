import { map, multicast } from 'rxjs/operators'
import { EMPTY, NEVER, of, concat, ReplaySubject } from 'rxjs'
import assert from 'assert'
import { fake } from 'sinon'

import { createConnector } from '@/connect'
import { isFunction, isReadWrite, isStream } from '@/util/fp'

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

  it('can resolves multiple providers from an object', () => {
    const read = () => of(42)
    const write = sink$ => {} // eslint-disable-line no-unused-vars
    const readWrite = sink$ => sink$.pipe(map(double))
    const { read: r, write: w, readWrite: rw } = connect({
      read,
      write,
      readWrite,
    })
    assert(isStream(r))
    assert(isFunction(w))
    assert(isReadWrite(rw))
  })

  it('drops _ and $ in $$ from provider names when resolving multiple', () => {
    const read$$ = () => of(42)
    const _write = sink$ => {} // eslint-disable-line no-unused-vars
    const _readWrite$$ = sink$ => sink$.pipe(map(double))
    const { read$, write, readWrite$ } = connect({
      read$$,
      _write,
      _readWrite$$,
    })
    assert(isStream(read$))
    assert(isFunction(write))
    assert(isReadWrite(readWrite$))
  })

  describe('with read/write providers', () => {
    it('returns the source$', () => {
      // eslint-disable-next-line no-unused-vars
      const _foo$$ = sink$ => of(42)
      const foo$ = connect(_foo$$)
      assert.ok(foo$)
      assert(isStream(foo$), 'foo$ is a stream')
    })

    it('returns an object that can be destructured as [sink, source$]', () => {
      // eslint-disable-next-line no-unused-vars
      const _foo$$ = sink$ => of(33)
      const [foo, foo$] = connect(_foo$$)
      assert(isFunction(foo), 'foo is a function')
      assert.ok(foo$)
      assert(isStream(foo$), 'foo$ is a stream')
    })

    it('returns an object that can be destructured as {_, $}', () => {
      // eslint-disable-next-line no-unused-vars
      const _foo$$ = sink$ => of(33)
      const { _: foo, $: foo$ } = connect(_foo$$)
      assert.equal(typeof foo, 'function')
      assert.ok(foo$)
      assert(isStream(foo$))
    })

    it('returns a writable store (enables $foo$ = 42 in svelte)', () => {
      const next = fake()
      const _foo$$ = sink$ => sink$
      const foo$ = connect(_foo$$)
      assert.ok(foo$)
      assert(isStream(foo$), 'foo$ is a stream')
      assert(isFunction(foo$.set), 'foo$ is a writable store')
      disposable(foo$.subscribe(next))
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

      it('is resubscribed when downstream is resubscribed after dispose', () => {
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

  describe('sink$', () => {
    it('is passed as only argument to write-only services', () => {
      const factory = fake() // can't use a fake as provider because of fn.length
      function _foo(sink$) {
        assert(isStream(sink$), 'sink$ is a stream')
        assert.equal(arguments.length, 1)
        factory()
      }
      assert(factory.notCalled)
      connect(_foo)
      assert(factory.calledOnce)
    })

    it('is passed as only argument to read/write services', () => {
      const factory = fake() // can't use a fake as provider because of fn.length
      function _foo$$(sink$) {
        assert(isStream(sink$), 'sink$ is a stream')
        assert.equal(arguments.length, 1)
        factory()
        return of(1)
      }
      assert(factory.notCalled)
      connect(_foo$$)
      assert(factory.calledOnce)
    })

    it('is not passed to read-only services', () => {
      const factory = fake() // can't use a fake as provider because of fn.length
      function _foo$$() {
        assert.equal(arguments.length, 0)
        factory()
        return of(1)
      }
      assert(factory.notCalled)
      connect(_foo$$)
      assert(factory.calledOnce)
    })

    // can't see how to do that without Proxy
    //
    //     const _foo = ({ sinkA$, sinkB$ }) => ...
    //
    it.skip('can be an object of sinks', () => {
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

    it('can be piped to source$', () => {
      const _foo$$ = sink$ => sink$.pipe(map(double))
      const foo$ = connect(_foo$$)
      const next = fake()
      disposable(foo$.subscribe(next))
      assert(next.notCalled)
      foo$.set(42)
      assert(next.calledOnceWith(84))
    })

    it('can be written before the first read', () => {
      const _foo$$ = sink$ => sink$.pipe(map(double))
      const foo$ = connect(_foo$$)
      // write
      foo$.set(42)
      // first read
      const next = fake()
      disposable(foo$.subscribe(next))
      assert(next.calledOnceWith(84))
      // second read
      const next2 = fake()
      disposable(foo$.subscribe(next2))
      assert(next.calledOnceWith(84))
    })

    it('does not emit before the first write', () => {
      const next = fake()
      const _foo$$ = sink$ => sink$.pipe(map(double))
      const foo$ = connect(_foo$$)
      disposable(foo$.subscribe(next))
      assert(next.notCalled)
      // write
      foo$.set(42)
      assert(next.calledOnceWith(84))
    })

    it('flushes all past values to first reader', () => {
      const next = fake()
      const _foo$$ = sink$ => sink$.pipe(map(double))
      const foo$ = connect(_foo$$)
      ;[1, 2, 3].forEach(x => foo$.set(x))
      assert(next.notCalled)
      disposable(foo$.subscribe(next))
      assert.equal(next.callCount, 3)
      assert.deepEqual(next.args, [[2], [4], [6]])
    })

    it('becomes hot when first reader subscribe', () => {
      const _foo$$ = sink$ => sink$.pipe(map(double))
      const foo$ = connect(_foo$$)
      ;[1, 2, 3].forEach(x => foo$.set(x))
      // first reader (flush)
      const next = fake()
      assert(next.notCalled)
      disposable(foo$.subscribe(next))
      assert.equal(next.callCount, 3)
      assert.deepEqual(next.args, [[2], [4], [6]])
      // second reader
      const next2 = fake()
      disposable(foo$.subscribe(next2))
      assert(next2.notCalled)
      foo$.set(42)
      assert.equal(next.callCount, 4)
      assert.equal(next.lastArg, 84)
      assert(next2.calledOnceWith(84))
    })

    it('remains hot on subsequent connections', () => {
      const _foo$$ = sink$ => sink$.pipe(map(double))
      // first connectiton
      {
        const foo$ = connect(_foo$$)
        ;[1, 2, 3].forEach(x => foo$.set(x))
        const next = fake()
        assert(next.notCalled)
        disposable(foo$.subscribe(next))
        assert.equal(next.callCount, 3)
        assert.deepEqual(next.args, [[2], [4], [6]])
      }
      // second connection
      {
        const next = fake()
        const foo$ = connect(_foo$$)
        disposable(foo$.subscribe(next))
        assert(next.notCalled)
        foo$.set(42)
        assert.equal(next.callCount, 1)
        assert.equal(next.lastArg, 84)
      }
    })

    // ----o-x---------> in createSink
    // ------o--x------> connection 1
    // -----------o----> connection 2
    // o: subscribe, x: unsubscribe
    it('remains functional after last subscriber unsubscribe', () => {
      const _foo$$ = sink$ => sink$.pipe(map(double))
      // first connectiton
      {
        const foo$ = connect(_foo$$)
        ;[1, 2, 3].forEach(x => foo$.set(x))
        const next = fake()
        assert(next.notCalled)
        const sub = foo$.subscribe(next)
        assert.equal(next.callCount, 3)
        assert.deepEqual(next.args, [[2], [4], [6]])
        // unsubscribe
        sub.unsubscribe()
        foo$.set(4) // lost because hot
        assert.equal(next.callCount, 3, 'does not receive after unsubscribe')
      }
      // second connection
      {
        const next = fake()
        const foo$ = connect(_foo$$)
        foo$.set(5) // lost
        foo$.subscribe(next)
        assert(next.notCalled)
        foo$.set(42)
        assert.equal(next.callCount, 1)
        assert.equal(next.lastArg, 84)
      }
    })
  })
})
