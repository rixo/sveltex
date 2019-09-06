import { tap } from 'rxjs/operators'

// eslint-disable-next-line no-console
export const log = o => o.pipe(tap(x => console.log(x)))
