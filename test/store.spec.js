import { test, describe } from 'zorax'
import { get } from 'svelte/store'
import { readable, writable, derived } from '../index.js'
// import { get, derived } from 'svelte/store'
// import { readable, writable } from '../index.js'

describe('readable', () => {
  test('readable(initial)', t => {
    const store = readable(42)
    const value = get(store)
    t.is(value, 42)
  })

  const macro = async (t, init) => {
    const o = init(t)
    const { stop, lifecycle } = o
    const store = readable(42, lifecycle)
    const listener = t.spy()
    const unsubscribe = store.subscribe(listener)
    lifecycle.wasCalled('lifecycle')
    listener.wasCalledWith(42)
    o.set(43)
    listener.wasCalledWith(43)
    stop.hasBeenCalled(0)
    await unsubscribe()
    o.set(44)
    listener.hasBeenCalled(2)
    stop.wasCalled('stop')
  }

  test('readable(initial, lifecycle)', macro, t => {
    let set
    const stop = t.spy()
    const lifecycle = t.spy(_set => {
      o.set = _set
      return stop
    })
    const o = { stop, lifecycle }
    return o
  })

  test('readable(initial, async lifecycle)', macro, t => {
    let set
    const stop = t.spy()
    const lifecycle = t.spy(async _set => {
      o.set = _set
      return stop
    })
    const o = { stop, lifecycle }
    return o
  })
})

describe('writable', () => {
  test('writable(initial)', t => {
    const store = writable(42)
    t.is(get(store), 42)
    store.set(43)
    t.is(get(store), 43)
    store.update(x => x + 1)
    t.is(get(store), 44)
  })

  const macro = async (t, init) => {
    const o = init(t)
    const { stop, lifecycle } = o
    const store = writable(42, lifecycle)
    const listener = t.spy()
    const unsubscribe = store.subscribe(listener)
    lifecycle.wasCalled('lifecycle')
    listener.wasCalledWith(42)
    o.set(43)
    listener.wasCalledWith(43)
    store.set(44)
    listener.wasCalledWith(44)
    store.update(x => x + 1)
    listener.wasCalledWith(45)
    stop.hasBeenCalled(0)
    await unsubscribe()
    o.set(99)
    listener.hasBeenCalled(4)
    stop.wasCalled('stop')
  }

  test('writable(initial, lifecycle)', macro, t => {
    let set
    const stop = t.spy()
    const lifecycle = t.spy(_set => {
      o.set = _set
      return stop
    })
    const o = { stop, lifecycle }
    return o
  })

  test('writable(initial, async lifecycle)', macro, t => {
    let set
    const stop = t.spy()
    const lifecycle = t.spy(async _set => {
      o.set = _set
      return stop
    })
    const o = { stop, lifecycle }
    return o
  })
})

describe('derived', () => {
  test('auto derived(deps, deps => value)', t => {
    const a = writable(2)
    const b = writable(4)
    const store = derived([a, b], ([$a, $b]) => $a + $b)
    t.eq(get(store), 6)
    a.set(8)
    t.eq(get(store), 12)
    b.set(16)
    t.eq(get(store), 24)
  })

  // DEBUG DEBUG DEBUG really?
  test('async auto derived(deps, async deps => value)', async t => {
    const a = writable(2)
    const b = writable(4)
    const store = derived([a, b], async ([$a, $b]) => $a + $b)
    t.eq(await get(store), 6)
    a.set(8)
    t.eq(await get(store), 12)
    b.set(16)
    t.eq(await get(store), 24)
  })

  test('derived(deps, lifecycle, initial)', t => {
    const a = writable(2)
    const b = writable(4)
    const store = derived([a, b], ([$a, $b], set) => {
      set($a + $b)
      return () => {}
    })
    t.eq(get(store), 6)
    a.set(8)
    t.eq(get(store), 12)
    b.set(16)
    t.eq(get(store), 24)
  })

  test('derived(deps, async lifecycle, initial)', async t => {
    const a = writable(2)
    const b = writable(4)
    const store = derived(
      [a, b],
      async ([$a, $b], set) => {
        set($a + $b)
        return () => {}
      },
      0,
    )
    t.eq(get(store), 6)
    a.set(8)
    t.eq(get(store), 12)
    b.set(16)
    t.eq(get(store), 24)
  })

  const macro = async (t, init) => {
    const a = writable(2)
    const b = writable(4)
    const o = init(t)
    const { stop, lifecycle } = o
    const store = derived([a, b], lifecycle, 42)
    const listener = t.spy()
    const unsubscribe = store.subscribe(listener)
    lifecycle.spy.wasCalled('lifecycle')
    listener.wasCalledWith(6)
    o.set(43)
    listener.wasCalledWith(43)
    a.set(8)
    stop.wasCalled('stop')
    listener.wasCalledWith(12)
    await unsubscribe()
    o.set(99)
    listener.hasBeenCalled(3)
    stop.wasCalled('stop')
  }

  test('auto derived(deps, deps => value)', macro, t => {
    let set
    const stop = t.spy()
    const lifecycle = ([$a, $b], _set) => {
      lifecycle.spy([$a, $b], _set)
      o.set = _set
      _set($a + $b)
      return stop
    }
    lifecycle.spy = t.spy()
    const o = { stop, lifecycle }
    return o
  })

  // test.only('derived(deps, async (deps, set) => stop, initial)', macro, t => {
  //   let set
  //   const stop = t.spy()
  //   const lifecycle = async ([$a, $b], _set) => {
  //     lifecycle.spy([$a, $b], _set)
  //     o.set = _set
  //     _set($a + $b)
  //     return stop
  //   }
  //   lifecycle.spy = t.spy()
  //   const o = { stop, lifecycle }
  //   return o
  // })

  // test('derived(initial, async lifecycle)', macro, t => {
  //   let set
  //   const stop = t.spy()
  //   const lifecycle = t.spy(async ([$a, $b], _set) => {
  //     o.set = _set
  //     _set($a + $b)
  //     return stop
  //   })
  //   const o = { stop, lifecycle }
  //   return o
  // })
})
