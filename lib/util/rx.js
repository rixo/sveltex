import { tap } from 'rxjs/operators'

// eslint-disable-next-line no-console
export const log = (...args) => tap(x => console.log(...args, x))
