import { COLORS, FREE, colRange, letter, shouldAdvance, remaining, cardError, backupError, byCard, shortId, clashes } from './logic.js';

const KEY = 'bingo-san-nicolas';
const blank = () => ({ cards: [], teams: [], game: { color: null, called: [] } });
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { state = blank(); }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { alert('Could not save on this device: ' + e.message); }
}
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const uid = () => Math.random().toString(36).slice(2, 10);
const tag = c => `#${shortId(c)} · ${c.code}`;
const chips = (tag, attr) => Object.entries(COLORS).map(([k, label]) =>
  tag === 'radio' ? `<label class="chip ${k}"><input type="radio" name="color" value="${k}">${label}</label>`
    : `<button type="button" class="chip ${k}" ${attr}="${k}">${label}</button>`).join('');

function owner(card) {
  for (const t of state.teams) {
    const p = t.people.find(p => p.id === card.person);
    if (p) return `${p.name} (${t.name})`;
  }
  return '';
}

// ---------- tabs ----------
const TABS = ['cards', 'teams', 'play', 'backup'];
function show(tab) {
  for (const t of TABS) $('#' + t).hidden = t !== tab;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  try { localStorage.setItem(KEY + '-tab', tab); } catch {}
  if (tab === 'play') $('#call').focus();
}
$('nav').addEventListener('click', e => e.target.dataset.tab && show(e.target.dataset.tab));

// ---------- cards ----------
const form = $('#card-form');
const f = form.elements;
const grid = $('#entry-grid');
let editing = null;

$('#color-pick').innerHTML = chips('radio');
for (let i = 0; i < 25; i++) {
  grid.insertAdjacentHTML('beforeend', i === FREE ? '<div class="free">♥</div>'
    : `<input inputmode="numeric" maxlength="2" data-i="${i}" aria-label="${'BINGO'[i / 5 | 0]} row ${i % 5 + 1}">`);
}
const cells = [...grid.querySelectorAll('input')]; // DOM order is column-major, same as entry order

function checkCell(el) {
  const [lo, hi] = colRange(el.dataset.i / 5 | 0), v = +el.value;
  el.classList.toggle('bad', !!el.value && !(v >= lo && v <= hi));
}
function next(el) {
  checkCell(el);
  const k = cells.indexOf(el);
  (cells[k + 1] || $('#card-save')).focus();
}
grid.addEventListener('input', e => {
  const el = e.target;
  el.value = el.value.replace(/\D/g, '');
  el.classList.remove('bad');
  if (el.value && shouldAdvance(el.value, el.dataset.i / 5 | 0)) next(el);
});
grid.addEventListener('keydown', e => {
  const el = e.target;
  if (e.key === 'Enter') { e.preventDefault(); next(el); }
  else if (e.key === 'Backspace' && !el.value) { e.preventDefault(); cells[cells.indexOf(el) - 1]?.focus(); }
});
grid.addEventListener('change', e => checkCell(e.target));
f.code.addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '');
  if (e.target.value.length === 6) cells[0].focus();
});
// IDs shorter than 6 digits: Enter jumps to the grid instead of submitting.
f.code.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cells[0].focus(); } });

function resetForm(focus) {
  editing = null;
  cells.forEach(el => { el.value = ''; el.classList.remove('bad'); });
  f.code.value = '';
  $('#card-error').textContent = '';
  $('#card-cancel').hidden = true;
  $('#card-save').textContent = 'Save card';
  if (focus) f.code.focus();
}
function edit(card) {
  editing = card;
  f.code.value = card.code;
  f.color.value = card.color;
  cells.forEach(el => { el.value = card.nums[el.dataset.i]; el.classList.remove('bad'); });
  $('#card-error').textContent = '';
  $('#card-cancel').hidden = false;
  $('#card-save').textContent = `Update ${COLORS[card.color]} ${card.code}`;
  form.scrollIntoView({ behavior: 'smooth' });
}
$('#card-cancel').addEventListener('click', () => resetForm(false));

form.addEventListener('submit', e => {
  e.preventDefault();
  const nums = Array(25).fill(0);
  cells.forEach(el => { nums[el.dataset.i] = el.value === '' ? NaN : +el.value; });
  const card = { code: f.code.value, color: f.color.value, nums, person: editing ? editing.person : null };
  const err = cardError(card, state.cards.filter(c => c !== editing));
  $('#card-error').textContent = err || '';
  if (err) return;
  if (editing) Object.assign(editing, card); else state.cards.push(card);
  save();
  resetForm(true);
  render();
});

const personOptions = sel => '<option value="">Unassigned</option>' + state.teams.map(t =>
  `<optgroup label="${esc(t.name)}">${t.people.map(p =>
    `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');

function renderCards() {
  const count = c => state.cards.filter(x => x.color === c).length;
  const clash = clashes(state.cards);
  $('#card-count').textContent = `${state.cards.length} / 72 cards · ` + Object.entries(COLORS).map(([k, l]) => `${l} ${count(k)}`).join(' · ')
    + (clash.size ? ` · ⚠ ${clash.size} share their last two digits` : '');
  $('#card-list').innerHTML = [...state.cards].sort(byCard).map(c => `
    <div class="crow ${c.color}${clash.has(c) ? ' clash' : ''}" data-k="${c.color}-${esc(c.code)}">
      <span class="dot"></span><b>${tag(c)}</b><span class="muted">${COLORS[c.color]}</span>
      ${clash.has(c) ? '<span class="warn">same last digits</span>' : ''}
      <select data-act="assign" aria-label="Owner of ${COLORS[c.color]} ${esc(c.code)}">${personOptions(c.person)}</select>
      <button data-act="edit">Edit</button><button data-act="del">Delete</button>
    </div>`).join('');
}
const rowCard = el => state.cards.find(c => `${c.color}-${c.code}` === el.closest('[data-k]').dataset.k);
$('#card-list').addEventListener('click', e => {
  const act = e.target.dataset.act;
  if (act === 'edit') edit(rowCard(e.target));
  if (act === 'del') {
    const card = rowCard(e.target);
    if (!confirm(`Delete ${COLORS[card.color]} ${card.code}?`)) return;
    state.cards.splice(state.cards.indexOf(card), 1);
    if (editing === card) resetForm(false);
    save();
    render();
  }
});
$('#card-list').addEventListener('change', e => {
  rowCard(e.target).person = e.target.value || null;
  save();
  render();
});

// ---------- teams ----------
const cardsOf = pid => state.cards.filter(c => c.person === pid).sort(byCard).map(c => `${COLORS[c.color]} ${tag(c)}`).join(', ') || 'no cards';
function renderTeams() {
  $('#team-list').innerHTML = state.teams.map(t => `
    <div class="team" data-team="${t.id}">
      <header><h3>${esc(t.name)}</h3><button data-act="del-team">Delete team</button></header>
      <ul>${t.people.map(p => `<li data-person="${p.id}"><span>${esc(p.name)}</span><small class="muted">${cardsOf(p.id)}</small>
        <button data-act="del-person" aria-label="Remove ${esc(p.name)}">✕</button></li>`).join('')}</ul>
      <form class="inline"><input name="person" placeholder="Add person" required><button>Add</button></form>
    </div>`).join('') || '<p class="muted">No teams yet.</p>';
}
const unassign = ids => state.cards.forEach(c => { if (ids.includes(c.person)) c.person = null; });
const rowTeam = el => state.teams.find(t => t.id === el.closest('[data-team]').dataset.team);

$('#team-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = e.target.elements.team.value.trim();
  if (!name) return;
  state.teams.push({ id: uid(), name, people: [] });
  e.target.reset();
  save();
  render();
});
$('#team-list').addEventListener('submit', e => {
  e.preventDefault();
  const team = rowTeam(e.target), name = e.target.elements.person.value.trim();
  if (!name) return;
  team.people.push({ id: uid(), name });
  save();
  render();
  $(`[data-team="${team.id}"] input`).focus();
});
$('#team-list').addEventListener('click', e => {
  const act = e.target.dataset.act;
  if (!act) return;
  const team = rowTeam(e.target);
  if (act === 'del-team') {
    if (!confirm(`Delete team ${team.name}? Its cards become unassigned.`)) return;
    unassign(team.people.map(p => p.id));
    state.teams.splice(state.teams.indexOf(team), 1);
  } else {
    const pid = e.target.closest('[data-person]').dataset.person;
    if (!confirm(`Remove ${team.people.find(p => p.id === pid).name}? Their cards become unassigned.`)) return;
    unassign([pid]);
    team.people = team.people.filter(p => p.id !== pid);
  }
  save();
  render();
});

// ---------- play ----------
let lastMsg = '';
const playing = () => state.cards.filter(c => c.color === state.game.color);
const say = msg => { lastMsg = msg; render(); };

$('#round-color').innerHTML = chips('button', 'data-color') + '<button type="button" data-color="">New round</button>';
$('#round-color').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const g = state.game, color = b.dataset.color || g.color;
  if (!color || (b.dataset.color && color === g.color)) return;
  if (g.called.length && !confirm(`Start a new ${COLORS[color]} round? This clears the ${g.called.length} called numbers.`)) return;
  state.game = { color, called: [] };
  save();
  say(`${COLORS[color]} round started`);
  $('#call').focus();
});

$('#call-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#call'), g = state.game;
  if (!input.value) return;
  const v = +input.value;
  input.value = '';
  if (!g.color) return say('Pick the color being played first');
  if (!(Number.isInteger(v) && v >= 1 && v <= 75)) return say('Numbers go from 1 to 75');
  if (g.called.includes(v)) return say(`${v} was already called`);
  g.called.push(v);
  save();
  const hits = playing().filter(c => c.nums.includes(v)).sort(byCard);
  say(`${letter(v)}-${v} → ` + (hits.length ? 'mark ' + hits.map(tag).join(', ') : 'none of your cards'));
});
$('#call').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });

$('#called').addEventListener('click', e => {
  if (e.target.id !== 'undo') return;
  const v = state.game.called.pop();
  save();
  say(`Undid ${v}`);
});

function renderPlay() {
  const g = state.game, last = g.called.at(-1);
  document.querySelectorAll('#round-color [data-color]').forEach(b => b.classList.toggle('active', !!b.dataset.color && b.dataset.color === g.color));
  $('#call-msg').textContent = lastMsg;
  $('#called').innerHTML = g.called.length
    ? `<span class="muted">${g.called.length} called:</span> ` + g.called.map(v => `<span class="ball${v === last ? ' last' : ''}">${v}</span>`).join('')
      + ` <button id="undo">Undo ${last}</button>`
    : '';
  if (!g.color) {
    $('#bingo').hidden = true;
    $('#play-list').innerHTML = '<p class="muted">Pick the color being played.</p>';
    return;
  }
  const cards = playing().map(c => ({ c, left: remaining(c, g.called) })).sort((a, b) => a.left - b.left || byCard(a.c, b.c));
  const winners = cards.filter(x => x.left === 0);
  $('#bingo').hidden = !winners.length;
  $('#bingo').textContent = 'BINGO! ' + winners.map(({ c }) => `${tag(c)} ${owner(c)}`).join(' · ');
  $('#play-list').innerHTML = cards.map(({ c, left }) => `
    <div class="pcard ${c.color}${left === 0 ? ' won' : c.nums.includes(last) ? ' hit' : ''}">
      <header><b>${tag(c)}</b><span>${left ? left + ' left' : 'FULL'}</span></header>
      <div class="who">${esc(owner(c) || 'unassigned')}</div>
      <div class="grid mini">${c.nums.map((v, i) => i === FREE ? '<span class="on">♥</span>'
        : `<span class="${g.called.includes(v) ? 'on' : ''}${v === last ? ' new' : ''}">${v}</span>`).join('')}</div>
    </div>`).join('') || `<p class="muted">No ${COLORS[g.color]} cards entered.</p>`;
}

// ---------- backup ----------
$('#export').addEventListener('click', async () => {
  const file = new File([JSON.stringify(state)], `bingo-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch {}
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#import').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  const err = backupError(data);
  if (err) { $('#backup-msg').textContent = err; return; }
  if (state.cards.length && !confirm(`Replace the ${state.cards.length} cards on this device with the ${data.cards.length} in the file?`)) return;
  state = data;
  save();
  lastMsg = '';
  resetForm(false);
  render();
  $('#backup-msg').textContent = `Imported ${data.cards.length} cards and ${data.teams.length} teams.`;
});

function render() {
  renderCards();
  renderTeams();
  renderPlay();
  $('#backup-info').textContent = `This device has ${state.cards.length} cards and ${state.teams.length} teams.`;
}

resetForm(false);
render();
let tab;
try { tab = localStorage.getItem(KEY + '-tab'); } catch {}
show(TABS.includes(tab) ? tab : 'cards');
