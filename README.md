# SvelteX

> A Svelte-first reactive model to complement Svelte's reactive views.

**Current status:** experiment :volcano:

_(Did I fail to find the lab glass emoji, or does it just not exist in fact?)_

At this point I'm eager for feedback, so feel free to open issues to share any thought.

## Example

`model.js`

```js
import { connect, connectable } from 'sveltex'

import { map, startWith } from 'rxjs/operators'

// === Async Service ===

const createDb = ({ name }) => {
  const records = []
  const insert = record => records.push(record)
  return {
    name,
    insert,
  }
}

const _dbConfig$_ = config$ => config$.pipe(startWith({ name: 'demo' }))

// Exporting separate input sink & output source for cleaner API (not mandatory)
//
// NOTE Using `connect` in the provider function is how services can depend on
//      each others.
//
export const _dbConfig = () => connect(_dbConfig$_)._

export const db$_ = () =>
  connect(_dbConfig$_).pipe(map(config => createDb(config)))

// === Sync Service ===

const makeFormat = ({ char, left = char, right = char }) => x =>
  `
    <span class="left quote">${left}</span>
    <span class="name">${x}</span>
    <span class="right quote">${right}</span>
  `

// By keeping the config sink in a separated file, configuration code (that will
// most likely be executed during app init) won't need to reference (import) the
// actual implementation (format_ in this example). With code splitting, the
// brunt of the dependencies could be kept out of the initial chunk, to optimize
// init time. With tree shaking, the config sink wouldn't even have to live in a
// separated module (I guess, not too knowledgeable on tree shaking).
const _formatConfig$_ = config$ =>
  config$.pipe(startWith({ left: '“', right: '”' }))

export const _formatConfig = () => connect(_formatConfig$_)._

export const format_ = connectable(_formatConfig$_, config$ =>
  config$.pipe(map(config => makeFormat(config)))
)
```

`App.svelte`

```html
<script>
  import { binder, connect } from 'sveltex'
  import { combineLatest, fromEvent, merge } from 'rxjs'
  import { filter, map, mapTo, mergeMap, switchMap } from 'rxjs/operators'

  import { _dbConfig, _formatConfig, db$_, format_ } from './model'

  // === Services ===

  // Services are functions/resources that you want to resolved _synchronously_
  // in the root of your script tag (instead of a callback, for example).
  //
  // The intended use case is for configurable helper functions. Say, for
  // example, a date lib on which the user could configure their locale.

  $: format = $format_

  // Here, format function is already defined & usable.
  //
  //    const formatted = format(whatever) // WORKS
  //
  // Although it's often better to only use it in reactive context, so
  // that your component would react to possible upstream changes... it's
  // easy with Svelte:
  //
  //    $: formatted = format(whatever)

  // === Outer Sources ===

  const db$ = connect(db$_)

  // === Inner Sources ===

  const input$ = binder()
  const button$ = binder()

  const quoteButton$ = binder()

  // === Transformations ===

  const click$ = button$.pipe(switchMap(btn => fromEvent(btn, 'click')))

  const enter$ = input$.pipe(
    switchMap(el => fromEvent(el, 'keydown')),
    filter(e => e.key === 'Enter')
  )

  const nameValue$ = combineLatest(input$, merge(click$, enter$)).pipe(
    map(([input]) => input.value)
  )

  const dbConfig$ = nameValue$.pipe(map(name => ({ name })))

  const formatConfig$ = quoteButton$.pipe(
    mergeMap(({ node: el, config: value }) =>
      fromEvent(el, 'click').pipe(mapTo(value))
    )
  )

  // === Outer Sinks ===

  connect(_dbConfig)(dbConfig$)
  connect(_formatConfig)(formatConfig$)

  // === View (i.e. Inner Sinks) ===

  const formatConfigs = [
    { left: '“', right: '”' },
    { char: "'" },
    { char: '"' },
    { char: '`' },
  ]

  $: dbName = $db$ && $db$.name
  $: formattedName = format(dbName)
</script>

<style>
  .db.name {
    margin: 16px 0;
  }
  .db.name :global(.name) {
    color: deepskyblue;
  }
  .db.name :global(.quote) {
    color: deeppink;
  }
  .quote.button {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    margin-right: 8px;
  }
</style>

<div class="db name">
  Database name: {@html formattedName}
</div>

<input use:input$ type="text" value={dbName} />

<button use:button$>Rename</button>

<div>
  <h2>Quotes</h2>
  {#each formatConfigs as config}
    <button use:quoteButton$={config} class="quote button">
      {config.left || config.char} {config.right || config.char}
    </button>
  {/each}
</div>
```
