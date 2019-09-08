import { getContext, setContext, onDestroy } from 'svelte'

import { createConnector } from './core'

export { binder } from './core'

export const connect = createConnector({
  getContext,
  setContext,
  onDestroy,
})
