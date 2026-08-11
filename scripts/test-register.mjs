// Enregistre le résolveur de tests (voir scripts/test-resolver.mjs).
// Utilisé via `node --import ./scripts/test-register.mjs` dans `npm test`.
import { register } from 'node:module'
register('./test-resolver.mjs', import.meta.url)
