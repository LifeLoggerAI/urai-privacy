import assert from 'node:assert/strict'
import test from 'node:test'
import { assertCallableLoaded } from './check-functions-emulator-loaded.mjs'

test('only loaded protected callable rejection establishes emulator authority', () => {
  assert.doesNotThrow(() => assertCallableLoaded({ status: 401 }, { error: { status: 'UNAUTHENTICATED' } }))
  for (const [status,body] of [
    [404,{ error: { status: 'NOT_FOUND' } }],
    [500,{ error: { status: 'INTERNAL' } }],
    [200,{ data: { status: 'pending' } }],
    [401,{ error: { status: 'INVALID_ARGUMENT' } }],
    [401,{}],
  ]) assert.throws(() => assertCallableLoaded({ status }, body))
})
