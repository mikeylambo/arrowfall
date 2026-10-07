/**
 * One design for every menu (title, pause, options, camp stations): an eyebrow over the title,
 * an icon per row, values as pills, toggles as switches and ranks as pips. The shell renders
 * plain buttons; this rebuilds their insides whenever a screen appears, keeping each
 * data-choice-id (and so keyboard, pad and click handling) untouched.
 */
const EYEBROW: Record<string, string> = {
  title: '',
  pause: 'The hunt waits',
  options: 'Settings',
  settings: 'Settings',
  trail: 'Set out',
  phase: 'The night ahead',
  fletcher: 'Choose your bow',
  altar: 'Spend Moonsilver',
  log: 'Hunter’s Log',
  trophies: 'Deeds',
  'range-setup': 'Practice',
  camp: 'Hunter’s Camp',
};

const ICON: Record<string, string> = {
  play: '<path d="M8 5v14l11-7Z"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  door: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h9"/>',
  bow: '<path d="M7 3c7 4 7 14 0 18"/><path d="M7 3v18"/><path d="M7 12h12"/><path d="m16 9 3 3-3 3"/>',
  moon: '<path d="M16 4a8 8 0 1 0 4 12 7 7 0 0 1-4-12Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>',
  altar: '<path d="M5 20h14M7 20v-6h10v6M12 14V4M9 7l3-3 3 3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5"/>',
  trophy:
    '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  eye: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  sound: '<path d="M5 10v4h3l5 4V6L8 10Z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.5-3L4 13a1.5 1.5 0 0 1 2.6-1.4L8 13"/>',
  screen: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  star: '<path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.3 7 19l1.2-5.6L4 9.6 9.6 9Z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};

/** Icon for a row, from its id (and screen). */
function iconFor(screen: string, id: string, disabled: boolean) {
  if (disabled && (screen === 'fletcher' || screen === 'phase')) return 'lock';
  if (id === 'start' || id === 'resume' || id === 'begin' || id === 'retry') return 'play';
  if (id === 'restart') return 'restart';
  if (id === 'settings' || id === 'options') return 'gear';
  if (id === 'quit' || id === 'camp') return 'door';
  if (id === 'fletcher' || id.startsWith('bow:')) return 'bow';
  if (id === 'phase' || id.startsWith('phase:')) return 'moon';
  if (id === 'nightly') return 'calendar';
  if (id.startsWith('challenge') || id === 'free' || id.startsWith('range')) return 'target';
  if (id.startsWith('boon:')) return 'altar';
  if (id.startsWith('entry:') || id.startsWith('run:')) return 'book';
  if (id.startsWith('deed')) return 'trophy';
  if (id.startsWith('option:')) {
    const k = id.slice(7);
    if (/music|sfx/.test(k)) return 'sound';
    if (/holdFire|autoLoose|toggle|assist|rebind/.test(k)) return 'hand';
    if (/colorblind|numbers|bands|reducedMotion|shake/.test(k)) return 'eye';
    if (/uiScale|fullscreen/.test(k)) return 'screen';
    if (k === 'tutorial') return 'star';
    return 'gear';
  }
  return '';
}

const svg = (name: string) =>
  name
    ? `<span class="menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg></span>`
    : '';
const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** "Name · Value" labels become a name plus a switch, pips or a pill. */
function valueHtml(value: string) {
  if (value === 'On' || value === 'Off')
    return `<span class="menu-switch ${value === 'On' ? 'on' : ''}" aria-hidden="true"><i></i></span><span class="sr">${value}</span>`;
  const ranks = /^(\d+)\/(\d+)$/.exec(value);
  if (ranks && Number(ranks[2]) <= 10)
    return `<span class="menu-pips" aria-label="${value}">${Array.from(
      { length: Number(ranks[2]) },
      (_, i) => `<i class="${i < Number(ranks[1]) ? 'on' : ''}"></i>`,
    ).join('')}</span>`;
  return `<span class="menu-pill">${escape(value)}</span>`;
}

function decorate(section: HTMLElement) {
  const screen = section.dataset.screenId ?? '';
  if (screen === 'levelup' || screen === 'gameplay-placeholder') return;
  section.dataset.decorated = '1';
  section.classList.add('menu');
  const eyebrow = EYEBROW[screen];
  const header = section.querySelector('.slu-header');
  if (eyebrow && header && !header.querySelector('.menu-eyebrow')) {
    const e = document.createElement('span');
    e.className = 'menu-eyebrow';
    e.textContent = eyebrow;
    header.prepend(e);
  }
  if (screen === 'results') return;
  section.querySelectorAll<HTMLButtonElement>('.slu-choice').forEach((button) => {
    const id = button.dataset.choiceId ?? '';
    const labelEl = button.querySelector('.slu-choice-label'),
      descEl = button.querySelector('.slu-choice-desc');
    let label = labelEl?.textContent ?? '';
    const selected = label.startsWith('◆ ');
    if (selected) label = label.slice(2);
    const split = label.lastIndexOf(' · ');
    const name = split > 0 ? label.slice(0, split) : label,
      value = split > 0 ? label.slice(split + 3) : '';
    const desc = descEl?.textContent ?? '';
    button.classList.toggle('selected', selected);
    button.classList.toggle('toggle', value === 'On' || value === 'Off');
    button.innerHTML = `${svg(iconFor(screen, id, button.disabled))}
      <span class="menu-text"><span class="slu-choice-label">${escape(name)}${
        selected ? ' <em class="menu-tag">Equipped</em>' : ''
      }</span>${desc ? `<span class="slu-choice-desc">${escape(desc)}</span>` : ''}</span>
      ${value ? `<span class="menu-value">${valueHtml(value)}</span>` : ''}`;
  });
}

/** Watch the UI root and decorate every screen as it is rendered. */
export function decorateMenus(root: HTMLElement) {
  const run = () => {
    const section = root.querySelector<HTMLElement>('.slu-screen');
    if (section && !section.dataset.decorated) decorate(section);
  };
  new MutationObserver(run).observe(root, { childList: true });
  run();
}
