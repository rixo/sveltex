const KEY = { context_key: 'sveltex' }

export const createServiceFactory = ({
  svelte: { setContext, getContext },
}) => {
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

    const resolve = () => {
      let container = getContext(KEY)
      if (!container) {
        if (strict) {
          throw new Error(
            'Tried to resolve service outside of a Sveltex container'
          )
        }
        container = placeholder()
        setContext(KEY, container)
      }
      return container
    }

    const subscribe = subscriber =>
      resolve().subscribe(handle, provider, subscriber)

    const handle = {
      name,
      subscribe,
      set: x => resolve().set(handle, provider, x),
    }

    return handle
  }

  // placeholder container, to wait for the sveltex() call in a container
  // component (because autosubs happens before init)
  const placeholder = () => {
    let queue = []

    // ensure a sveltex() container is created at this level (we never want
    // to resolve late from upper)
    setTimeout(() => {
      if (queue) throw new Error('No Sveltex container to resolve the service')
    })

    const subscribe = (...args) => {
      let stoped = false
      const op = { stoped: false, args }
      queue.push(op)
      return () => {
        if (stoped) return
        stoped = true
        if (op.stop) op.stop()
      }
    }

    const set = (...args) => {
      queue.push({ write: true, args, stoped: false })
    }

    const flush = container => {
      if (!queue) return
      const currentQueue = queue
      queue = null
      for (const op of currentQueue) {
        if (op.write) {
          container.set(...op.args)
        } else {
          op.stop = container.subscribe(...op.args)
          if (op.stoped) op.stop()
        }
      }
    }

    return { isPlaceholder: true, subscribe, set, flush }
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

    const set = (handle, baseProvider, x) => {
      const entry = resolve(handle, baseProvider)
      resolving.add(handle)
      if (!entry.store.set)
        throw new Error("Can't write to read-only service's store")
      const result = entry.store.set(x)
      resolving.delete(handle)
      return result
    }

    const container = { subscribe, set, resolving, get, getProvider }

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
