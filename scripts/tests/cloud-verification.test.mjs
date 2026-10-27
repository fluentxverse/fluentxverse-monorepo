import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { quote } from '../lib/cloud-ssh.mjs';
import { imageContentIdentity, screeningStatusProbe } from '../lib/cloud-verification.mjs';

test('SSH quoting preserves spaces, apostrophes, dollar signs and multiline code', () => {
  for (const input of ["a'b", '$secret', 'a b', 'line1\nline2', screeningStatusProbe])
    assert.equal(execFileSync('sh', ['-c', 'printf %s ' + quote(input)], { encoding: 'utf8' }), input);
});

test('image identity ignores store-specific IDs and object ordering but checks actual contents', () => {
  const a = { Id: 'classic', Os: 'linux', Architecture: 'amd64', RootFS: { Layers: ['layer1', 'layer2'] }, Config: { Env: ['KEY=value'], Cmd: ['app'], Labels: { a: '1', b: '2' } } };
  const b = { ...a, Id: 'containerd', Config: { Labels: { b: '2', a: '1' }, Cmd: ['app'], Env: ['KEY=value'] } };
  assert.equal(imageContentIdentity(a), imageContentIdentity(b));
  for (const changed of [{ ...b, Architecture: 'arm64' }, { ...b, RootFS: { Layers: ['layer2', 'layer1'] } },
    { ...b, Config: { ...b.Config, Cmd: ['other'] } }, { ...b, Config: { ...b.Config, Env: ['KEY=changed'] } }])
    assert.notEqual(imageContentIdentity(a), imageContentIdentity(changed));
});

test('remote screening probe handles trailing slashes and never prints credentials or private fields', async () => {
  for (const base of ['http://gmr-engine:8090', 'http://gmr-engine:8090/']) {
    const logs = [];
    await runInNewContext('(async()=>{' + screeningStatusProbe + '})()', {
      URL, AbortSignal, process: { env: { GMR_SCREENING_ENGINE_API_BASE: base, GMR_SCREENING_ENGINE_API_KEY: 'synthetic-test-key' } },
      fetch: async (url, options) => {
        assert.equal(url.toString(), 'http://gmr-engine:8090/v1/screening/prover');
        assert.equal(options.headers['X-GMR-Engine-Key'], 'synthetic-test-key');
        return { status: 200, json: async () => ({ ready: true, state: 'ready', privateField: 'must-not-print' }) };
      }, console: { log: value => logs.push(value) },
    });
    assert.deepEqual(JSON.parse(logs[0]), { http: 200, ready: true, state: 'ready' });
    assert(!logs[0].includes('synthetic-test-key') && !logs[0].includes('must-not-print'));
  }
});
