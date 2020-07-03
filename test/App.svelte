<script>
  export let spec
  export let resolve = null

  const { init, children } = typeof spec === 'function' ? { init: spec } : spec

  if (init) init()

  let resolved = 0

  const resolveChild = () => {
    resolved++
    if (resolved === children.length) {
      resolve()
    }
  }

  if (!children || !children.length) {
    resolve()
  }
</script>

{#if children}
  {#each children as spec}
    <svelte:self {spec} resolve={resolveChild} />
  {/each}
{/if}
