<script>
  /**
   * This component bootstraps Sveltex, which creates an isolated dependency
   * resolution scope (in the component's branch of Svelte's context).
   *
   * AFAICT you would normally only do this once at the root of you app. But
   * it is possible to have multiple scopes, and it is used for demo purposes.
   */
  import { bootstrap } from 'sveltex/rxjs'

  export let renderComponents = true

  bootstrap() // <- must be called near the root of your components tree
</script>

{#if renderComponents}
  <slot />
{/if}
