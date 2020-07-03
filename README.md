# Sveltex

> Minimalistic DI, & async friendly stores for Svelte

## FAQ

### But stores are already async in Svelte?

Of course, they are. What Sveltex does is allowing `async` syntax on the lifecycle function, enabling a leaner syntax with some use cases.

```js
import { readable } from 'sveltex'

const foo = readable(
  null,
  // this wouldn't work in Svelte's stores (it crashes when stopping the store)
  async set => {
    await ...
    return () => { ... }
  }
)
```

(Sveltex stores are also a little more opinionated on error management.)

### What DI?

**Dependency Injection** (DI) introduces a level of indirection in your code between the provider of a service and its consumer. That is, instead of directly importing a dependency, you import an abstract service that provides the dependency.

The actual instance that you get is not directly referenced by the consumer, but it is rather "injected" into it by a DI container (that's why this pattern is also called IOC -- Inversion Of Control).

The advantage of doing so is that the code dependencies are not hardwired in the code. You can easily replace services in tests, or when developing components in isolation (e.g. with [Svench](https://github.com/rixo/svench)!).

### How DI?

- Services are resolved from Svelte's context

- The service `import` points to the default service implementation (which is great during dev to "jump to definition"!)

- Nodes can be nested, and services can be overridden at node level

  - All dependent services of a service that is overridden are recreated in this node

## DI

### Provider

`services.js`

```js
import { service, readable, derived } from 'sveltex'

export const foo = service(() => readable('foo'))

export const bar = service(() => readable('bar'))

export const foobar = service(
  () => derived([foo, bar], ([foo$, bar$] => foo$ + bar$))
)
```

### Container

`App.svelte`

```svelte
<script>
  import { sveltex } from 'sveltex'
  import Child from './Child.svelte'

  sveltex() // internally calls setContext
</script>

<Child />
```

#### Override services

`Child.svelte`

```svelte
<script>
  import { sveltex } from 'sveltex'
  import { foo, bar } from './services.js'

  sveltex([
    [foo, () => readable('inner foo')],
    [bar, () => readable('inner bar')],
  ])
</script>
```

### Consumer

`Whatever.svelte`

```svelte
<script>
  import { foobar } from './services.js'

  $: value = $foobar // internally calls getContext
</script>

<h1>Hello, {$foobar}</h1>
```

## Async stores

```js
import { writable, readable, derived } from 'sveltex/store'
```

Sveltex lets you define your store in a more concise & expressive way with async/generator lifecycle functions.

The lifecycle function is the function that receives `set` and returns a stop function in a `writable`, `readable` or `derived` store.

```js
import { readable } from 'svelte/store'

const lifecycleFunction = set => {
  ...
  return () => { ... }
}

const myStore = readable(lifecycleFunction)
```

### Vanilla

In vanilla Svelte store, the lifecycle function can't be async (i.e. use `async` keyword, they can have async behaviour of course), because you have to synchronously return a cleanup function (and not a promise for a cleanup function).

This can lead to clumsy code sometimes.

```js
const db = readable(null, set => {
  let stopped = false
  let stop = noop

  import('./db.js')
    .then(({ default: Db }) => {
      if (stopped) return
      const _db = new Db()
      stop = () => _db.dispose()
      set(_db)
    })
    .catch(err => {
      if (stopped) return
      if (stop) {
        stop()
        stopped = true
      }
      set(err)
    })

  return () => {
    stopped = true
    stop()
  }
}
```

### Async

With Sveltex store, the lifecycle function can be `async` and the cleanup / error management is a little bit more opinionated, allowing for a much leaner syntax in some cases. Notably the cases where you use a store to define a Sveltex service...

```js
const db = sveltex.readable(null, async set => {
  try {
    const { default: Db } = await import('./db.js')
    const _db = new Db()
    set(_db) // ignored if has been stopped while waiting
    // stop function is called immediately if stopped while waiting
    return () => _db.dispose()
  } catch (err) {
    set(err)
  }
})
```

#### Auto catch

Actually, Sveltex stores catch errors and set the value of the store to the error, so the previous example can be shortened like this:

```js
const db = sveltex.readable(null, async set => {
  const { default: Db } = await import('./db.js')
  const _db = new Db()
  set(_db)
  return () => _db.dispose()
})
```

If you don't want this behaviour, just catch your errors yourself.

## License

ISC
