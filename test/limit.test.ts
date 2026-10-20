import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../src/limit.ts';

test('allows up to the limit per key, then refuses with a retry time', () => {
  let t = 0;
  const l = createLimiter({ limit: 2, windowMs: 1000, now: () => t });
  assert.deepEqual(l.take('a'), { ok: true });
  t = 100;
  assert.deepEqual(l.take('a'), { ok: true });
  t = 300;
  assert.deepEqual(l.take('a'), { ok: false, retryAfterMs: 700 });
  assert.deepEqual(l.take('b'), { ok: true }, 'keys are independent');
});

test('the window slides: old hits expire one by one', () => {
  let t = 0;
  const l = createLimiter({ limit: 2, windowMs: 1000, now: () => t });
  l.take('a');
  t = 500;
  l.take('a');
  t = 999;
  assert.equal(l.take('a').ok, false);
  t = 1000; // the first hit has left the window
  assert.equal(l.take('a').ok, true);
  assert.equal(l.take('a').ok, false);
});

test('refused attempts do not extend the wait', () => {
  let t = 0;
  const l = createLimiter({ limit: 1, windowMs: 1000, now: () => t });
  l.take('a');
  for (t = 100; t < 1000; t += 100) assert.equal(l.take('a').ok, false);
  t = 1000;
  assert.equal(l.take('a').ok, true);
});
