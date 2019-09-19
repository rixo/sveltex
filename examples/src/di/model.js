import { connect, auto } from 'sveltex'
import { map, mergeAll, shareReplay, startWith } from 'rxjs/operators'

const shareLast = () => shareReplay(1)

// --- Async Service ---

const createDb = ({ name }) => {
  const records = []
  const insert = record => records.push(record)
  return {
    name,
    insert,
  }
}

const _dbConfig$_ = config$ =>
  config$.pipe(
    mergeAll(),
    startWith({ name: 'demo' }),
  )

export const _dbConfig = () => connect(_dbConfig$_)._

export const db$_ = () =>
  connect(_dbConfig$_).pipe(
    map(config => createDb(config)),
    shareLast(),
  )

// Lifecycle / Daemons
//
// Connections made in the context of a component are disconnected when the
// component is destroyed.
//
// Connect does ref counting on the number of active connections to every
// "service", and disposes the service when the number reaches 0. (This way,
// the default behaviour does not create memory leaks.)
//
// Thus, a service that connects to itself will never be automatically disposed:
// this is the daemon pattern.
//
// NOTE: Self-connecting would create an infinite loop without some special
// handling, and so the nested self-connect returns a stub instead of an actual
// connection. This stub can only be used to release the internal connection,
// thus allowing the daemon to release its lock and become disposable (when
// its number of incoming connections falls to 0).
//
// NOTE: Apart from this special case, cyclical dependencies are NOT supported.
//
export const dbDaemon$_ = () => {
  const dispose = connect(dbDaemon$_)

  // the service can renounce its daemon status by releasing the self-connection
  // dispose()

  return connect(db$_)
}

// --- Sync Service ---

const makeFormat = ({ char, left = char, right = char }) => x =>
  `
    <span class="left quote">${left}</span>
    <span class="name">${x}</span>
    <span class="right quote">${right}</span>
  `

const _formatConfig$_ = config$ =>
  config$.pipe(
    mergeAll(),
    startWith({ left: '“', right: '”' }),
  )

export const _formatConfig = () => connect(_formatConfig$_)._

const format_ = () =>
  connect(_formatConfig$_).pipe(
    map(config => makeFormat(config)),
    shareLast(),
  )

export const format$ = auto(format_)

const formatDaemon_ = () => {
  connect(formatDaemon_)
  return connect(format_)
}

export const formatDaemon$ = auto(formatDaemon_)
