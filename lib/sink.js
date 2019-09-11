// import { merge, pipe, share, take } from 'callbag-basics'
import makeSubject from 'callbag-subject'
import subscribe from 'callbag-subscribe'

const DATA = 1
const DONE = 2

const makeSubscribeFirst = (sink, subscribe, next) => {
  const memo = []

  const subscribeFirst = observer => {
    // subscribe
    const sub = subscribe(observer)
    // flush
    memo.forEach(next)
    // become hot
    sink.subscribe = subscribe
    sink.next = next
    return sub
  }

  subscribeFirst.next = value => {
    memo.push(value)
  }

  return subscribeFirst
}

// 1. remember everything that is written until the first reader
// 2. flush everything to first reader
// 3. becomes & stay hot
const makeSink = () => {
  const subject = makeSubject()

  const next = value => {
    subject(DATA, value)
  }

  const subscribeToSink = observer => subscribe(observer)(subject)

  const sink = {}
  sink.subscribe = makeSubscribeFirst(sink, subscribeToSink, next)

  sink.next = sink.subscribe.next
  sink.error = error => subject(DONE, error)
  sink.complete = () => subject(DONE)

  return sink
}

export default makeSink
