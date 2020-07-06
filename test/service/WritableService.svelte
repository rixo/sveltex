<script>
  export let sveltex
  export let service
  export let write = null
  export let set = null
  export let answerSync = null
  export let answer = null

  if (write) {
    $service = write
  }

  if (set) {
    service.set(set)
  }

  sveltex()

  if (answerSync) answerSync($service)

  $: if (answer) answer($service)
</script>

<p>{$service}</p>
