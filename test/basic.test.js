import Heylock from '../index.js';

// Basic test for Heylock instantiation and method presence
function testHeylockInstantiation() {
  const heylock = new Heylock('4hFxK/ZJfPLmvhYUwqFeE1Va4RgJZ8VlAxyHPJMZTBo=', false, false);
  if (!(heylock instanceof Heylock)) throw new Error('Instance creation failed');
  if (typeof heylock.message !== 'function') throw new Error('Missing message method');
  if (typeof heylock.rewrite !== 'function') throw new Error('Missing rewrite method');
  if (typeof heylock.sort !== 'function') throw new Error('Missing sort method');
  if (typeof heylock.shouldEngage !== 'function') throw new Error('Missing shouldEngage method');
  if (typeof heylock.greet !== 'function') throw new Error('Missing greet method');
  if (typeof heylock.addContext !== 'function') throw new Error('Missing addContext method');
  if (typeof heylock.getContext !== 'function') throw new Error('Missing getContext method');
  if (typeof heylock.getContextAsString !== 'function') throw new Error('Missing getContextAsString method');
  if (typeof heylock.clearContext !== 'function') throw new Error('Missing clearContext method');
  console.log('Heylock instantiation and method presence: PASS');
}

try {
  testHeylockInstantiation();
} catch (e) {
  console.error('Test failed:', e.message);
  process.exit(1);
}
