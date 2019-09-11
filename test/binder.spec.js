import assert from 'assert'
import { fake } from 'sinon'
import { tap } from 'rxjs/operators'

import { isStream } from '@/util'

import { binder } from '..'

const it_is_a_binder_stream = ({ create }) => {
  describe('is a stream', () => {
    const b = create()
    assert(isStream(b))
  })

  describe('supports: <input bind:this={div$._} />', () => {
    it('has a _ setter', () => {
      const next = fake()
      const b = create()
      b.subscribe(next)
      assert(next.notCalled)
      // call
      const el = []
      b._ = el
      assert(next.calledOnceWith(el))
    })

    it('its _ property is a function', () => {})
  })

  describe('supports: <input bind:value={$value$} />', () => {
    it('has a set method', () => {
      const $ = create()
      assert.equal(typeof $.set, 'function')
    })

    it('the set method emits nodes', () => {
      const next = fake()
      const b = create()
      b.subscribe(next)
      assert(next.notCalled)
      // call
      const el = {}
      b.set(el)
      assert(next.calledOnceWith(el))
    })
  })

  describe('supports: <div use:div$ />', () => {
    it('has a call method', () => {
      const b = create()
      assert.equal(typeof b.call, 'function')
    })

    it('the call function emits nodes', () => {
      const next = fake()
      const b = create()
      b.subscribe(next)
      assert(next.notCalled)
      // call
      const el = {}
      b.call(null, el)
      assert(next.calledOnceWith(el))
    })
  })
}

describe('binder', () => {
  it('is a function', () => {
    assert.equal(typeof binder, 'function')
  })

  describe('binder()', () => {
    it_is_a_binder_stream({ create: binder })
  })

  describe('binder().pipe(...)', () => {
    it('has a pipe method', () => {
      const b = binder()
      assert.equal(typeof b.pipe, 'function')
    })

    it_is_a_binder_stream({
      create: () => binder().pipe(tap(() => {})),
    })
  })

  it('does not emit before having an actual value', () => {
    const b = binder()
    const next = fake()
    b.subscribe(next)
    assert(next.notCalled)
    // sanity check
    const el = {}
    b.set(el)
    assert(next.calledOnceWith(el))
  })
})
