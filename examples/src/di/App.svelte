<script>
  import Sveltex from '../Sveltex.svelte'

  import Form from './Form.svelte'

  let renderComponents = true
</script>

<style>
  .scope {
    float: left;
    padding: 16px;
    margin: 8px;
    border: 2px solid;
    color: darkslategray;
  }
  .scope.a {
    border-color: mediumorchid;
  }
  /* typography */
  em {
    color: silver;
  }
  /* headers */
  h1 {
    margin-top: 0;
  }
  .scope.a h1,
  .scope.a h2 {
    color: mediumorchid;
  }
  .scope.b {
    border-color: mediumseagreen;
  }
  .scope.b h1 {
    color: mediumseagreen;
  }
  .scope.c {
    border-color: orange;
  }
  .scope.c h1 {
    color: orange;
  }
  .scope.d {
    border-color: lightsteelblue;
  }
  .scope.d h1 {
    color: lightsteelblue;
  }
</style>

<label>
  <input type="checkbox" bind:checked={renderComponents} />
  Render components
  <em>(to test lifecycle)</em>
</label>

<div class="scope a">
  <Sveltex {renderComponents}>
    <h1>Shared Scope</h1>
    <h2>Instance #1</h2>
    <Form />
    <hr />
    <h2>Instance #2</h2>
    <Form />
  </Sveltex>
</div>

<div class="scope d">
  <Sveltex {renderComponents}>
    <h1>Daemon</h1>
    <Form daemon />
  </Sveltex>
</div>

<div class="scope b">
  <Sveltex {renderComponents}>
    <h1>Isolated Scope</h1>
    <Form />
    <div class="scope c">
      <Sveltex {renderComponents}>
        <h1>Nested Isolated Scope</h1>
        <Form />
      </Sveltex>
    </div>
  </Sveltex>
</div>
