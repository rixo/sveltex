export { readable, writable, derived } from './store.js'

import { setContext, getContext } from 'svelte'
import { createServiceFactory } from './service.js'
export const { service, sveltex } = createServiceFactory({
  svelte: {
    setContext,
    getContext,
  },
})
