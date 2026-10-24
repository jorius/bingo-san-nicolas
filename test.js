import assert from 'node:assert/strict';
import { shouldAdvance, cardError, remaining, backupError, letter, byCard, clashes } from './logic.js';

// Pink 4307 from the real card photo, column-major, 0 = free heart.
const card = { code: '4307', color: 'pink', person: null,
  nums: [5, 8, 9, 15, 10, 17, 21, 30, 22, 28, 40, 43, 0, 37, 34, 54, 51, 58, 57, 55, 73, 69, 63, 72, 62] };
const with_ = (patch, i, v) => { const c = { ...card, ...patch, nums: [...card.nums] }; if (i !== undefined) c.nums[i] = v; return c; };

assert.equal(shouldAdvance('1', 0), false); // could be 10–15
assert.equal(shouldAdvance('2', 0), true);
assert.equal(shouldAdvance('3', 1), false); // could be 30
assert.equal(shouldAdvance('62', 4), true);

assert.equal(cardError(card, []), null);
assert.match(cardError(with_({}, 0, 16), []), /column B/);
assert.match(cardError(with_({}, 1, 5), []), /twice/);
assert.match(cardError(with_({}, 3, NaN), []), /Missing/);
assert.match(cardError(with_({}), [card]), /Pink 4307/);
assert.equal(cardError(with_({ color: 'blue' }), [card]), null);
assert.match(cardError(with_({ code: 4307 }), []), /6 digits/);
assert.equal(cardError(with_({ code: '123456' }), []), null);
assert.match(cardError(with_({ code: '1234567' }), []), /6 digits/);
assert.match(cardError(with_({ code: '' }), []), /6 digits/);

assert.equal(remaining(card, []), 24);
assert.equal(remaining(card, [5, 8, 99]), 22);
assert.equal(remaining(card, card.nums.filter(Boolean)), 0);

assert.equal(backupError({ cards: [card], teams: [], game: { color: null, called: [] } }), null);
assert.match(backupError({ cards: [card, card], teams: [], game: { color: null, called: [] } }), /already entered/);

const twin = with_({ code: '4351' }), blue43 = with_({ color: 'blue' }), pink12 = with_({ code: '1299' });
assert.deepEqual([blue43, twin, card, pink12].sort(byCard).map(c => c.color + c.code), ['pink4307', 'pink4351', 'pink1299', 'blue4307']);
const pink07 = with_({ code: '1207' });
assert.deepEqual([...clashes([card, pink07, blue43, twin])], [card, pink07]); // same "07" in blue doesn't clash
assert.match(backupError([]), /not a bingo backup/);

assert.equal(letter(15), 'B');
assert.equal(letter(16), 'I');
assert.equal(letter(75), 'O');
console.log('all good');
