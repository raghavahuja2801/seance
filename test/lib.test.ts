import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain browser JS module, no types
import { boardLayout, intensityOf, spellSteps, stripDirections } from '../public/lib.js';

test('spellSteps keeps board words whole and sanitizes everything else', () => {
  assert.deepEqual(spellSteps('yes'), ['YES']);
  assert.deepEqual(spellSteps(' Goodbye '), ['GOODBYE']);
  assert.deepEqual(spellSteps('Mary  Ellen!'), [...'MARY ELLEN']);
  assert.deepEqual(spellSteps('<script>'), [...'SCRIPT']);
  assert.equal(spellSteps('A'.repeat(100)).length, 16);
  assert.deepEqual(spellSteps(undefined), []);
  assert.deepEqual(spellSteps({ evil: 1 }), [...'OBJECT OBJECT']);
});

test('every spellable step has a spot on the board', () => {
  const spots = boardLayout();
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') assert.ok(spots[ch], ch);
  for (const w of ['YES', 'NO', 'GOODBYE']) assert.ok(spots[w], w);
});

test('stripDirections removes Drama 3 markup but keeps the words', () => {
  assert.equal(
    stripDirections('[a trembling whisper] I remember... [shaky breath] the cold. <whisper>So cold.</whisper>'),
    'I remember... the cold. So cold.',
  );
  assert.equal(stripDirections('<|speaker:0|>Hello <emphasis>there</emphasis>'), 'Hello there');
  assert.equal(stripDirections('plain'), 'plain');
});

test('intensityOf defaults anything unknown to gentle', () => {
  assert.equal(intensityOf('violent'), 'violent');
  assert.equal(intensityOf('VIOLENT'), 'gentle');
  assert.equal(intensityOf(undefined), 'gentle');
});
