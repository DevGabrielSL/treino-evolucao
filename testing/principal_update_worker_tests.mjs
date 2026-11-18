import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';

const dist = join(process.argv[2], 'dist');
const code = readFileSync(join(dist, 'sw.js'), 'utf8');
const index = readFileSync(join(dist, 'index.html'), 'utf8');
const scope = 'https://example.com/treino-evolucao/';
const oldCache = 'treino-evolucao-android-shell-v205-brand';
const currentCache = 'treino-evolucao-android-shell-v206-deck-art';

function setup({html = index, brokenAsset = false} = {}) {
  const listeners = new Map();
  const storage = new Map([[oldCache, new Map()], ['sandbox-cache', new Map()]]);
  const calls = [];
  const self = {
    registration: {scope},
    location: new URL(scope),
    addEventListener(type, listener) { listeners.set(type, listener); },
    async skipWaiting() {
      assert.ok(storage.get(currentCache).has(scope));
      assert.ok(storage.get(currentCache).has(scope + 'principal_coastal.css?v=203'));
      calls.push('skipWaiting');
    },
    clients: {async claim() { calls.push('claim'); }}
  };
  const caches = {
    async keys() { return [...storage.keys()]; },
    async delete(name) { return storage.delete(name); },
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        async addAll(requests) {
          if (brokenAsset) throw new Error('Asset unavailable');
          for (const request of requests) {
            assert.equal(request.cache, 'reload');
            const relative = new URL(request.url).pathname.slice(new URL(scope).pathname.length);
            entries.set(request.url, new Response(readFileSync(join(dist, relative))));
          }
        },
        async put(url, response) { entries.set(url, response); },
        async match(key) { return entries.get(key.url || key)?.clone(); }
      };
    }
  };
  const fetch = async (request, options) => {
    assert.equal(request, scope + 'index.html?release=206');
    assert.equal(options.cache, 'reload');
    return new Response(html);
  };
  runInNewContext(code, {self, caches, fetch, URL, Request});
  function dispatch(type, request) {
    let result;
    const capture = promise => { result = promise; };
    listeners.get(type)({request, waitUntil: capture, respondWith: capture});
    return result;
  }
  return {calls, storage, dispatch};
}

const upgrade = setup();
await upgrade.dispatch('install');
await upgrade.dispatch('activate');
assert.deepEqual(upgrade.calls, ['skipWaiting', 'claim']);
assert.equal(upgrade.storage.has(oldCache), false);
assert.equal(upgrade.storage.has('sandbox-cache'), true);
const offlineEntry = await upgrade.dispatch('fetch', {
  method: 'GET', mode: 'navigate', url: scope + '?visual=202'
});
assert.equal(await offlineEntry.text(), index);
assert.equal(upgrade.dispatch('fetch', {method: 'GET', url: 'https://sheets.googleapis.com/'}), undefined);

for (const input of [{html: index.replace('app.js?v=206', 'app.js?v=205')}, {brokenAsset: true}]) {
  const failed = setup(input);
  await assert.rejects(failed.dispatch('install'));
  assert.deepEqual(failed.calls, []);
  assert.equal(failed.storage.has(oldCache), true);
}
console.log('PRINCIPAL_WORKER_UPDATE_OFFLINE=PASS');
