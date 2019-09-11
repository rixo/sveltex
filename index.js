import { getContext, setContext, onDestroy } from 'svelte'

import { createConnector } from './lib/connect'

export { binder } from './lib/binder'

export { default as connectable } from './lib/connectable'

export const connect = createConnector({
  getContext,
  setContext,
  onDestroy,
})
