<script>
  import { binder, connect } from 'sveltex'
  import { combineLatest, fromEvent, merge } from 'rxjs'
  import { filter, map, mapTo, mergeMap, switchMap } from 'rxjs/operators'

  import {
    _dbConfig,
    _formatConfig,
    db$_,
    dbDaemon$_,
    format$,
    formatDaemon$,
  } from './model'

  export let daemon = false

  // auto-connectables
  //
  // Intended use case is when you want a service to be immediately (and
  // synchronously) available in your script block.
  //
  // This would work:
  //
  //     const format = $format$
  //     format('') // NOT "undefined is not a function"
  //
  // But this is better, because it will react if format changes:
  //
  //     $: format = $format$
  //     // ...
  //     $: format('')
  //

  $: formatProvider = daemon ? formatDaemon$ : format$
  $: format = $formatProvider

  // outer sources

  const db$ = daemon ? connect(dbDaemon$_) : connect(db$_)

  // inner sources

  const input$ = binder()
  const button$ = binder()

  const quoteButton$ = binder()

  // transformations

  const click$ = button$.pipe(switchMap(btn => fromEvent(btn, 'click')))

  const enter$ = input$.pipe(
    switchMap(el => fromEvent(el, 'keydown')),
    filter(e => e.key === 'Enter'),
  )

  const nameValue$ = combineLatest(input$, merge(click$, enter$)).pipe(
    map(([input]) => input.value),
  )

  const dbConfig$ = nameValue$.pipe(map(name => ({ name })))

  const formatConfig$ = quoteButton$.pipe(
    mergeMap(({ node: el, config: value }) =>
      fromEvent(el, 'click').pipe(mapTo(value)),
    ),
  )

  // outer sinks

  connect(_dbConfig)(dbConfig$)
  connect(_formatConfig)(formatConfig$)

  // => view (inner sinks)

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

<section>
  <div class="db name">
    Database name:
    {@html formattedName}
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
</section>
