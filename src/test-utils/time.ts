// Test-only module. Prefer importing time helpers directly from `@/utils/time` unless a test
// needs explicit test helpers (e.g. fake timers wrappers). Keeping this file as a stable funnel
// avoids production code accidentally depending on test utilities.
export { now } from '@/utils/time';
