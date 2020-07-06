const KEY = { context_key: 'sveltex' }

export const createServiceFactory = ({ setContext, getContext }) => {
  let lastId = 0

  const nextId = () => ++lastId

  const service = (opts, provider) => {
    // service({ name: string }, provider)
    // service(name: string, provider: function)
    if (typeof opts === 'string') {
      opts = { name: opts }
    }
    // service(provider: function)
    if (typeof opts === 'function') {
      provider = opts
      opts = { name: provider.name }
    }

    const {
      name,
      // strict (bool) prevent late resolving (placeholder) -- insures that we
      // don't inadvertently resolve a dangling placeholder from a parent
      strict = false,
    } = opts || {}

    const subscribe = subscriber => {
      const container = getContext(KEY) || (!strict && placeholder())

      if (!container) {
        throw new Error(
          'Tried to resolve service outside of a Sveltex container'
        )
      }

      return container.subscribe(handle, provider, subscriber)
    }

    const handle = { name, subscribe }

    return handle
  }

  // placeholder container, to wait for the sveltex() call in a container
  // component (because autosubs happens before init)
  const placeholder = () => {
    const queue = []
    const subscribe = (...args) => {
      let stoped = false
      const ctx = { stoped: false, args }
      queue.push(ctx)
      return () => {
        if (stoped) return
        stoped = true
        if (ctx.stop) ctx.stop()
      }
    }
    const flush = container => {
      for (const ctx of queue) {
        ctx.stop = container.subscribe(...ctx.args)
        if (ctx.stoped) ctx.stop()
      }
    }
    return { isPlaceholder: true, subscribe, flush }
  }

  const resolveContext = () => {
    const node = getContext(KEY)
    if (!node) return {}
    let placeholder
    let parent
    if (node.isPlaceholder) {
      placeholder = node
    } else {
      parent = node
    }
    return { placeholder, parent }
  }

  const sveltex = override => {
    const { placeholder, parent } = resolveContext()
    const registry = new WeakMap()
    const overrides = override && new WeakMap(override)

    const resolving = (parent && parent.resolving) || new Set()

    const get = handle => registry.get(handle) || (parent && parent.get(handle))

    const getProvider = handle =>
      (overrides && overrides.get(handle)) ||
      (parent && parent.getProvider(handle))

    const subscribe = (handle, baseProvider, subscriber) => {
      const entry = resolve(handle, baseProvider)
      resolving.add(handle)
      const result = entry.store.subscribe(subscriber)
      resolving.delete(handle)
      return result
    }

    const container = { subscribe, resolving, get, getProvider }

    const hasOverride = handle => {
      if (overrides && overrides.has(handle)) return true
      const entry = get(handle)
      if (entry) {
        for (const dep of entry.deps) {
          if (hasOverride(dep)) return true
        }
      }
      return false
    }

    // get & create
    const pull = (handle, parent) => {
      let entry = registry.get(handle)
      if (!entry) {
        const deps = parent ? new Set(parent.get(handle).deps) : new Set()
        entry = {
          id: nextId(),
          deps,
        }
        registry.set(handle, entry)
      }
      return entry
    }

    const resolve = (handle, baseProvider) => {
      const isLocal = overrides && overrides.has(handle)

      if (parent && !isLocal && !hasOverride(handle)) {
        return parent.resolve(handle, baseProvider)
      }

      const entry = pull(handle, !isLocal && parent)

      if (!entry.store) {
        const provider = getProvider(handle) || baseProvider
        entry.store = provider()
      }

      resolving.forEach(dep => {
        pull(dep).deps.add(handle)
      })

      return entry
    }

    setContext(KEY, Object.assign(container, { resolve, hasOverride }))

    if (placeholder) {
      placeholder.flush(container)
    }

    return container
  }

  return { service, sveltex }
}
