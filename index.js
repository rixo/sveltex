import { getContext, setContext, onDestroy } from 'svelte'

import { createConnector } from './core'

export * from './core'

export const connect = createConnector({
  getContext,
  setContext,
  onDestroy,
})
