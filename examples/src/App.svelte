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

  const goto = async link => {}
</script>

<AppLayout>
  <ul slot="menu">
    {#each apps as app}
      <li>
        <a href on:click|preventDefault={() => goto(app)}>{app.text}</a>
      </li>
    {/each}
  </ul>

  <AppDi />

</AppLayout>
