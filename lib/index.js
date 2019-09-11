import { getContext, setContext, onDestroy } from 'svelte'

import { createConnector } from './connect'

export { binder } from './binder'

// export { default as Sveltex } from './Sveltex.svelte'

export { default as connectable } from './connectable'

export const connect = createConnector({
  getContext,
  setContext,
  onDestroy,
})
