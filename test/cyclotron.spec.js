import assert from 'assert'
import { fake } from 'sinon'
import subscribe from 'callbag-subscribe'
import of from 'callbag-of'
import tap from 'callbag-tap'
import pipe from 'callbag-pipe'

import makeCyclotron from '@/cyclotron'
import { isFunction } from '@/util'
import { noop } from '@/util/fp'

import { FakeLifecycle } from './helpers'

const interopDispose = o => {
  if (o.dispose) {
    o.dispose()
  } else if (isFunction(o)) {
    o()
  } else {
    throw new Error('Unsupported disposable')
  }
}

describe('cyclotron', () => {
  let disposables
  beforeEach(() => {
    disposables = []
  })
  afterEach(() => {
    disposables.forEach(interopDispose)
  })

  const disposable = dispose => disposables.push(dispose)

  let lifecycle
  let warn
  let makeCyclo
  let Cyclo
  beforeEach(() => {
    lifecycle = FakeLifecycle()
    warn = fake()
    const env = {
      onDestroy: lifecycle.onDestroy,
      warn,
    }
    makeCyclo = config => {
      const Cyclo = makeCyclotron(env, config)
      return (...args) => {
        const cyclo = Cyclo(...args)
        disposables.push(cyclo)
        return cyclo
      }
    }
    Cyclo = makeCyclo()
  })

  describe('the Cyclotron factory', () => {
    it('is a function', () => {
      assert(isFunction(Cyclo))
    })

    it('creates a cyclotron object', () => {
      const __ = x => x
      const cyclo = Cyclo(__)
      assert.ok(cyclo)
    })
  })

  const it_is_a_cyclotron = ({
    create,
    read = false,
    write = false,
    theConnection,
  }) => {
    if (read) {
      it('has a $ property', () => {
        const cyclo = create()
        assert.ok(cyclo.$)
      })
    } else {
      it('has an undefined $ property', () => {
        const cyclo = create()
        assert.equal(cyclo.$, undefined)
      })
    }

    if (write) {
      it('has a _ property', () => {
        const cyclo = create()
        assert.ok(cyclo._)
      })
    } else {
      it('has an undefined _ property', () => {
        const cyclo = create()
        assert.equal(cyclo._, undefined)
      })
    }

    it('exposes a dispose function', () => {
      const { dispose } = create()
      assert(isFunction(dispose))
    })

    it('exposes a onDispose function', () => {
      const { onDispose } = create()
      assert(isFunction(onDispose))
    })

    it('exposes a connect function', () => {
      const { connect } = create()
      assert(isFunction(connect))
    })

    describe('the onDispose function', () => {
      let cyclo
      let disposed

      beforeEach(() => {
        cyclo = create()
        disposed = fake()
        cyclo.onDispose(disposed)
      })

      it('calls back when the cyclotron is disposed', () => {
        assert(disposed.notCalled, 'onDispose has not been called')
        cyclo.dispose()
        assert(disposed.calledOnce, 'onDispose has been called')
      })

      it('ever only calls back once', () => {
        assert(disposed.notCalled, 'onDispose has not been called')
        cyclo.dispose()
        assert(disposed.calledOnce, 'onDispose has been called')
        cyclo.dispose()
        assert(disposed.calledOnce, 'onDispose has not been called again')
      })
    })

    describe('the connect function', () => {
      it('creates a connection object', () => {
        const cyclo = create()
        const connec = cyclo.connect()
        assert.ok(connec)
      })
    })

    describe('the connection', () => {
      let cyclo
      let conn
      beforeEach(() => {
        cyclo = create()
        conn = cyclo.connect()
      })

      if (write) {
        it('has a defined _ property', () => {
          assert.ok(conn._)
        })

        describe('the _ property', () => {
          it('is a function', () => {
            assert(isFunction(conn._))
          })
        })
      } else {
        it('has an undefined _ property', () => {
          assert.equal(conn._, undefined)
        })
      }

      if (read) {
        it('has a defined $ property', () => {
          assert.ok(conn.$)
        })

        if (typeof read === 'object') {
          describe('the $ property', () => {
            it('is the value returned by the handler', () => {
              assert.strictEqual(conn.$, read.expected(conn))
            })

            it('is the same value as the $ property of the cyclotron', () => {
              assert.strictEqual(conn.$, cyclo.$)
            })
          })
        }
      } else {
        it('has an undefined $ property', () => {
          assert.equal(conn.$, undefined)
        })
      }

      if (theConnection) {
        theConnection()
      }
    })
  }

  describe('a passthrough cyclotron', () => {
    const create = () => Cyclo()

    it_is_a_cyclotron({
      create,
      read: {
        expected: service => service.$,
      },
      write: true,
    })

    it('outputs input values', () => {
      const cyclo = create()
      const conn = cyclo.connect()
      const next = fake()
      disposable(subscribe({ next })(conn.$))
      assert.equal(next.callCount, 0)
      conn._(of(42))
      assert.equal(next.callCount, 1)
      assert(next.lastArg, 42)
    })

    it('can be written multiple times', () => {
      const cyclo = create()
      const conn = cyclo.connect()
      const next = fake()
      disposable(subscribe({ next })(conn.$))
      conn._(of(42))
      conn._(of(54))
      assert.equal(next.callCount, 2)
      assert(next.lastArg, 54)
    })
  })

  describe('a read-only cyclotron', () => {
    const handler = () => true
    const create = () => Cyclo(handler)
    it_is_a_cyclotron({ create, read: { expected: () => true } })
  })

  describe('a write-only cyclotron', () => {
    // eslint-disable-next-line no-unused-vars
    const handler = sink$ => {}
    const create = () => Cyclo(handler)
    it_is_a_cyclotron({ create, write: true })
  })

  describe('a read/write cyclotron', () => {
    // eslint-disable-next-line no-unused-vars
    const handler = sink$ => 42
    const create = () => Cyclo(handler)
    it_is_a_cyclotron({ create, read: { expected: () => 42 }, write: true })
  })

  describe('config: readAdapter', () => {
    let readAdapter

    beforeEach(() => {
      readAdapter = fake(x => x)
      Cyclo = makeCyclo({
        readAdapter,
      })
    })

    it('does not call readAdapter prematurely', () => {
      assert.equal(readAdapter.callCount, 0)
    })

    it('wraps input sink$ on passthrough', () => {
      Cyclo()
      assert.equal(readAdapter.callCount, 1)
    })

    it('wraps input sink$ on write-only', () => {
      // eslint-disable-next-line no-unused-vars
      Cyclo(sink$ => {})
      assert.equal(readAdapter.callCount, 1)
    })

    it('wraps input sink$ on read / write', () => {
      Cyclo(sink$ => sink$)
      assert.equal(readAdapter.callCount, 1)
    })

    it('does not wrap anything on read-only', () => {
      Cyclo(() => 42)
      assert.equal(readAdapter.callCount, 0)
    })

    it('is called on each new cyclotron', () => {
      Cyclo(sink$ => sink$)
      assert.equal(readAdapter.callCount, 1, 'called on first')
      Cyclo()
      assert.equal(readAdapter.callCount, 2, 'called on second')
    })
  })

  describe('config: writeAdapter', () => {
    const write = () => {}

    let writeAdapter

    beforeEach(() => {
      writeAdapter = fake(() => write)
      Cyclo = makeCyclo({
        writeAdapter,
      })
    })

    it('is not called before actually calling the write function', () => {
      const cyclo = Cyclo()
      cyclo.connect()
      assert(writeAdapter.notCalled)
    })

    it('is called with the sink subject as argument', () => {
      const cyclo = Cyclo()
      const _ = cyclo.connect()._
      _(42)
      assert.equal(writeAdapter.lastArg, cyclo._)
    })

    it('is called when writing in passthrough', () => {
      const cyclo = Cyclo()
      const conn = cyclo.connect()
      assert.equal(writeAdapter.callCount, 0)
      conn._(42)
      assert.equal(writeAdapter.callCount, 1)
    })

    it('is called when writing in write-only', () => {
      const cyclo = Cyclo(sink$ => noop(sink$))
      const conn = cyclo.connect()
      assert.equal(writeAdapter.callCount, 0)
      conn._(42)
      assert.equal(writeAdapter.callCount, 1)
    })

    it('is called when writing in read / write', () => {
      const cyclo = Cyclo(sink$ => sink$)
      const conn = cyclo.connect()
      assert.equal(writeAdapter.callCount, 0)
      conn._(42)
      assert.equal(writeAdapter.callCount, 1)
    })
  })

  describe('the dispose function', () => {
    describe('on a passthrough cyclotron', () => {
      it('emits complete on the sink$', () => {
        const complete = fake()
        const cyclo = Cyclo()
        disposable(subscribe({ complete })(cyclo.$))
        assert.equal(complete.callCount, 0)
        cyclo.dispose()
        assert.equal(complete.callCount, 1)
      })

      it('has no effect when called again', () => {
        const complete = fake()
        const cyclo = Cyclo()
        disposable(subscribe({ complete })(cyclo.$))
        assert.equal(complete.callCount, 0)
        cyclo.dispose()
        assert.equal(complete.callCount, 1)
        cyclo.dispose()
        assert.equal(complete.callCount, 1)
      })
    })

    describe('on a writable cyclotron', () => {
      it('emits complete on the sink$', () => {
        const complete = fake()
        const handler = sink$ =>
          pipe(
            sink$,
            tap(null, null, complete)
          )
        const cyclo = Cyclo(handler)
        disposable(subscribe()(cyclo.$))
        assert.equal(complete.callCount, 0)
        cyclo.dispose()
        assert.equal(complete.callCount, 1)
      })

      it('has no effect when called again', () => {
        const complete = fake()
        const handler = sink$ =>
          pipe(
            sink$,
            tap(null, null, complete)
          )
        const cyclo = Cyclo(handler)
        disposable(subscribe()(cyclo.$))
        assert.equal(complete.callCount, 0)
        cyclo.dispose()
        assert.equal(complete.callCount, 1)
        cyclo.dispose()
        assert.equal(complete.callCount, 1)
      })
    })
  })

  describe('when a consumer is destroyed', () => {
    let unsubscribe
    let conn
    let cyclo

    beforeEach(() => {
      unsubscribe = fake()
      Cyclo = makeCyclo({
        writeAdapter: () => () => unsubscribe,
      })
      cyclo = Cyclo()
      conn = cyclo.connect()
    })

    it('unsubscribes from a single input streams', () => {
      assert.equal(unsubscribe.callCount, 0)
      conn._()
      lifecycle.destroy()
      assert.equal(unsubscribe.callCount, 1)
    })

    it('unsubscribes from all input streams', () => {
      assert.equal(unsubscribe.callCount, 0)
      conn._()
      conn._()
      lifecycle.destroy()
      assert.equal(unsubscribe.callCount, 2)
    })

    describe('when the last consumer is disposed', () => {
      it('does not dispose the cyclotron', () => {
        const disposed = fake()
        cyclo.onDispose(disposed)
        assert.equal(disposed.callCount, 0)
        conn._()
        lifecycle.destroy()
        assert.equal(disposed.callCount, 0)
      })
    })
  })

  describe('dependencies lifecycle', () => {
    let unsubscribe

    beforeEach(() => {
      unsubscribe = {
        a: fake(),
        ba: fake(),
        ca: fake(),
      }
      Cyclo = makeCyclo({
        writeAdapter: () => key => unsubscribe[key],
      })
    })

    describe('when cyclo B connects to cyclo A', () => {
      let a, b
      let complete
      beforeEach(() => {
        complete = fake()
        a = Cyclo()
        b = Cyclo(() => {
          const conn = a.connect()
          conn._('ba')
          subscribe({ complete })(conn.$)
        })
      })

      it('unsubscribes B from A when B is disposed', () => {
        assert.equal(unsubscribe.ba.callCount, 0)
        b.dispose()
        assert.equal(unsubscribe.ba.callCount, 1)
      })

      it('does not unsubscribes B from A when B is merely disconnected', () => {
        lifecycle.destroy()
        assert.equal(unsubscribe.ba.callCount, 0)
        b.dispose()
        assert.equal(unsubscribe.ba.callCount, 1)
      })

      it('emits complete on A connection in B when A is disposed', () => {
        assert.equal(complete.callCount, 0)
        a.dispose()
        assert.equal(complete.callCount, 1)
      })
    })

    describe('when both cyclos B and C connects to cyclo A', () => {
      let a, b, c
      let completeB, completeC
      beforeEach(() => {
        completeB = fake()
        completeC = fake()
        a = Cyclo()
        b = Cyclo(() => {
          const conn = a.connect()
          conn._('ba')
          subscribe({ complete: completeB })(conn.$)
        })
        c = Cyclo(() => {
          const conn = a.connect()
          conn._('ca')
          subscribe({ complete: completeC })(conn.$)
        })
      })

      it('unsubscribes B from A when B is disposed', () => {
        assert.equal(unsubscribe.ba.callCount, 0)
        b.dispose()
        assert.equal(unsubscribe.ba.callCount, 1)
      })

      it('unsubscribes C from A when C is disposed', () => {
        assert.equal(unsubscribe.ca.callCount, 0)
        c.dispose()
        assert.equal(unsubscribe.ca.callCount, 1)
      })

      it('does not unsubscribe C from A when B is disposed', () => {
        b.dispose()
        assert.equal(unsubscribe.ca.callCount, 0)
      })

      it('emits complete on A connections in B and C when A is disposed', () => {
        assert.equal(completeB.callCount, 0)
        assert.equal(completeC.callCount, 0)
        a.dispose()
        assert.equal(completeB.callCount, 1)
        assert.equal(completeC.callCount, 1)
      })
    })

    it('warns when trying to add a dispose callback to a disposed cyclotron', () => {
      const cyclo = Cyclo()
      cyclo.dispose()
      const disposed = fake()
      assert(warn.notCalled)
      cyclo.onDispose(disposed)
      assert(warn.calledOnce)
    })
  })
})
