export const COLORS = { pink: 'Pink', yellow: 'Yellow', orange: 'Orange', blue: 'Blue' };

// Cards are stored column-major (B column top to bottom, then I...); index 12 is the free heart.
export const FREE = 12;
export const colRange = col => [col * 15 + 1, col * 15 + 15];
export const letter = v => 'BINGO'[Math.floor((v - 1) / 15)];

// Jump to the next cell once no further digit could keep the value inside this column's range.
export const shouldAdvance = (value, col) => value.length >= 2 || Number(value) * 10 > colRange(col)[1];

export const remaining = (card, called) => card.nums.filter((v, i) => i !== FREE && !called.includes(v)).length;

const ORDER = Object.keys(COLORS);
// Cards go by the ID's last two digits: the first two repeat a lot within a color.
export const shortId = c => c.code.slice(-2);
export const byCard = (a, b) => ORDER.indexOf(a.color) - ORDER.indexOf(b.color)
  || shortId(a).localeCompare(shortId(b)) || a.code.localeCompare(b.code);

// Cards whose short id is shared with another card of the same color.
export function clashes(cards) {
  const count = {};
  for (const c of cards) count[c.color + shortId(c)] = (count[c.color + shortId(c)] || 0) + 1;
  return new Set(cards.filter(c => count[c.color + shortId(c)] > 1));
}

export function cardError(card, others) {
  if (!COLORS[card.color]) return 'Pick the card color';
  if (typeof card.code !== 'string' || !/^\d{4}$/.test(card.code)) return 'ID must be 4 digits';
  if (others.some(c => c.color === card.color && c.code === card.code)) return `${COLORS[card.color]} ${card.code} is already entered`;
  if (!Array.isArray(card.nums) || card.nums.length !== 25) return 'A card has 24 numbers';
  const seen = new Set();
  for (let i = 0; i < 25; i++) {
    if (i === FREE) continue;
    const v = card.nums[i], [lo, hi] = colRange(Math.floor(i / 5)), col = 'BINGO'[Math.floor(i / 5)];
    if (!v) return `Missing a number in column ${col}`;
    if (!Number.isInteger(v) || v < lo || v > hi) return `${v} can't be in column ${col} (${lo}–${hi})`;
    if (seen.has(v)) return `${v} is on the card twice`;
    seen.add(v);
  }
  return null;
}

export function backupError(d) {
  if (!d || !Array.isArray(d.cards) || !Array.isArray(d.teams) || !d.game || !Array.isArray(d.game.called)) return 'That file is not a bingo backup';
  if (!d.teams.every(t => typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.people)
    && t.people.every(p => typeof p.id === 'string' && typeof p.name === 'string'))) return 'The teams in that file are damaged';
  if (d.game.color !== null && !COLORS[d.game.color]) return 'The round in that file is damaged';
  for (let k = 0; k < d.cards.length; k++) {
    const err = cardError(d.cards[k], d.cards.slice(0, k));
    if (err) return `Card ${d.cards[k].code}: ${err}`;
  }
  return null;
}
