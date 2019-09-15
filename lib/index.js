import { getContext, setContext, onDestroy } from 'svelte'

import makeConnector from './connect'

export { binder } from './binder'

export { default as connectable } from './connectable'

export const { bootstrap, connect } = makeConnector({
  getContext,
  setContext,
  onDestroy,
})
