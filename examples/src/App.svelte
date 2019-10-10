<script>
  import AppLayout from './AppLayout.svelte'

  import AppDi from './di/App.svelte'

  export let name

  const apps = [
    {
      text: 'Dependency injection',
      App: AppDi,
    },
  ]

  let app = apps.filter(({ default: dft }) => dft)[0] || apps[0]

  const goto = async toApp => {
    app = toApp
  }
</script>

<AppLayout>
  <ul slot="menu">
    {#each apps as app}
      <li>
        <a href on:click|preventDefault={() => goto(app)}>{app.text}</a>
      </li>
    {/each}
  </ul>

  <svelte:component this={app.App} />

</AppLayout>
