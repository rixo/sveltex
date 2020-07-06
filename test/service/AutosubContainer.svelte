<script>
  export let sveltex
  export let answerSync = null
  export let answer
  export let service

  sveltex()

  if (answerSync) {
    answerSync($service)
  }

  $: answer($service)
</script>
