<style>
  :global(body) {
    min-height: 100%;
    padding: 0;
    margin: 0;
    padding-left: 200px;
  }
  .menu {
    background: lightpink;
    position: absolute;
    height: 100%;
    top: 0;
    left: 0;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    width: 200px;
  }
  .shadow {
    box-shadow: 0 0 25px rgba(0, 0, 0, 0.25);
  }
  .container {
    overflow: hidden;
    padding: 16px;
  }

  h1 {
    text-align: center;
    white-space: collapse;
  }
  h1 span:first-child {
    font-style: italic;
    color: darkslategray;
  }
  h1 span + span {
    display: inline-block;
    position: relative;
    left: -0.2em;
    color: mediumvioletred;
  }

  menu :global(ul) {
    padding: 0.5em;
  }
  menu :global(li) {
    list-style: none;
    font-weight: 120%;
  }
</style>

<menu class="menu shadow">
  <h1>
    <span>Svelte</span>
    <span>X</span>
  </h1>
  <slot name="menu" />
</menu>

<div class="container">
  <slot />
</div>
