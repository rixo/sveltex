import makeSubject from 'callbag-subject'
import subscribe from 'callbag-subscribe'

const DATA = 1
const DONE = 2

const makeSubscribable = (_, subject) => {
  const { next } = _

  let memo = []

  _.next = value => {
    if (memo) {
      memo.push(value)
    } else {
      next(value)
    }
  }

  const $ = (t, d) => {
    if (t === 0) {
      // subscribe
      subject(0, d)
      if (memo) {
        // flush
        memo.forEach(next)
        // become hot
        memo = null
        _.next = next
        $.subscribe = observer => subscribe(observer)(subject)
      }
    }
  }

  $.subscribe = observer => subscribe(observer)($)

  return $
}

// 1. remember everything that is written until the first reader
// 2. flush everything to first reader
// 3. becomes & stay hot
const createPort = () => {
  const subject = makeSubject()

  const next = value => {
    subject(DATA, value)
  }

  const error = error => subject(DONE, error)

  const complete = () => subject(DONE)

  const _ = { next, error, dispose: complete }
  const $ = makeSubscribable(_, subject)

  const port = [_, $]
  port._ = _
  port.$ = $

  return port
}

export default createPort
