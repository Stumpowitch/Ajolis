import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL('../src/components/ThemeScript.astro', import.meta.url),
  'utf8',
).match(/<script is:inline>([\s\S]*?)<\/script>/)[1];

function browser({ saved = null, dark = false, blocked = false } = {}) {
  const events = {};
  const attributes = {};
  const root = { dataset: {} };
  const label = {};
  const button = {
    hidden: true,
    setAttribute: (key, value) => {
      attributes[key] = value;
    },
    querySelector: () => label,
    addEventListener: (name, callback) => {
      events[name] = callback;
    },
  };
  const system = {
    matches: dark,
    addEventListener: (name, callback) => {
      events.system = callback;
    },
  };
  let stored = saved;
  const storage = {
    getItem: () => stored,
    setItem: (key, value) => {
      stored = value;
    },
  };
  const environment = {
    document: {
      documentElement: root,
      querySelector: () => ({ setAttribute() {} }),
      querySelectorAll: () => [button],
      addEventListener: (name, callback) => {
        events[name] = callback;
      },
    },
    window: {
      matchMedia: () => system,
      addEventListener: (name, callback) => {
        events[name] = callback;
      },
    },
  };
  Object.defineProperty(environment, 'localStorage', {
    get() {
      if (blocked) throw new Error('Storage unavailable');
      return storage;
    },
  });
  runInNewContext(source, environment);
  events.DOMContentLoaded();
  return {
    root,
    button,
    label,
    attributes,
    events,
    system,
    saved: () => stored,
  };
}

test('theme follows system changes until an explicit preference is selected', () => {
  const b = browser({ dark: true });
  assert.equal(b.root.dataset.theme, 'dark');
  assert.equal(b.root.dataset.themePreference, 'system');
  assert.equal(b.button.hidden, false);
  b.system.matches = false;
  b.events.system();
  assert.equal(b.root.dataset.theme, 'light');
  b.events.click();
  assert.equal(b.saved(), 'light');
  b.system.matches = true;
  b.events.system();
  assert.equal(b.root.dataset.theme, 'light');
  b.events.click();
  assert.equal(b.root.dataset.theme, 'dark');
  assert.equal(b.label.textContent, 'Dunkel');
  assert.match(b.attributes['aria-label'], /Dunkel.*Auto/);
  b.events.click();
  assert.equal(b.saved(), 'system');
  assert.equal(b.root.dataset.theme, 'dark');
});

test('theme restores preferences, synchronizes tabs, and ignores unrelated storage', () => {
  const b = browser({ saved: 'dark' });
  assert.equal(b.root.dataset.theme, 'dark');
  b.events.storage({ key: 'unrelated', newValue: 'light' });
  assert.equal(b.root.dataset.theme, 'dark');
  b.events.storage({ key: 'ajolis-theme', newValue: 'light' });
  assert.equal(b.root.dataset.theme, 'light');
  b.events.storage({ key: null, newValue: null });
  assert.equal(b.root.dataset.themePreference, 'system');
  assert.equal(
    browser({ saved: 'invalid', dark: true }).root.dataset.theme,
    'dark',
  );
});

test('theme controls remain usable with unavailable browser storage', () => {
  const b = browser({ blocked: true });
  b.events.click();
  b.events.click();
  assert.equal(b.root.dataset.theme, 'dark');
  assert.equal(b.label.textContent, 'Dunkel');
});
