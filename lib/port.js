// import { merge, pipe, share, take } from 'callbag-basics'
import makeSubject from 'callbag-subject'
import subscribe from 'callbag-subscribe'

const DATA = 1
const DONE = 2

const makeSubscribeFirst = (_, $) => {
  const { next } = _
  const { subscribe } = $

  const memo = []

  _.next = value => {
    memo.push(value)
  }

  $.subscribe = observer => {
    // subscribe
    const sub = subscribe(observer)
    // flush
    memo.forEach(next)
    // become hot
    $.subscribe = subscribe
    _.next = next
    return sub
  }
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

  const doSubscribe = observer => subscribe(observer)(subject)

  const _ = { next, complete, error }
  const $ = { subscribe: doSubscribe }

  makeSubscribeFirst(_, $)

  const port = [_, $]
  port._ = _
  port.$ = $

  return port
}

export default createPort
