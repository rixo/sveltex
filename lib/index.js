import { getContext, setContext, onDestroy } from 'svelte'

import makeConnector from './connect'

export { binder } from './binder'

export { default as auto } from './auto'

export const { bootstrap, connect } = makeConnector({
  getContext,
  setContext,
  onDestroy,
})
