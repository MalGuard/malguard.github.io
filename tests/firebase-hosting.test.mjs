import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, '.github/firebase/package.json'));
const { parse } = require('yaml');
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const workflow = (name) => parse(readFileSync(join(root, '.github/workflows', name), 'utf8'));
const guard = "github.repository == 'MalGuard/malguard.github.io' && github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch' && inputs.confirmation == 'malguard1/malguard'";

function validateConfig(config, rc) {
  assert.deepEqual(rc, { projects: { default: 'malguard1' } });
  assert.deepEqual(Object.keys(config), ['hosting']);
  assert.equal(config.hosting.site, 'malguard');
  assert.equal(config.hosting.public, '_site');
  // No new routing, backend deployment, or lifecycle shell commands.
  assert.deepEqual(Object.keys(config.hosting).sort(), ['headers', 'ignore', 'public', 'site']);
  assert.deepEqual(config.hosting.ignore, [
    'firebase.json', '**/node_modules/**', '**/.git/**', '**/.env*',
    '**/gha-creds-*.json', '**/firebase-debug*.log',
  ]);
  for (const rule of config.hosting.headers) {
    assert.deepEqual(rule.headers, [{ key: 'Cache-Control', value: 'no-cache' }]);
  }
}

function validateDeploy(wf) {
  assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
  assert.equal(wf.on.workflow_dispatch.inputs.confirmation.required, true);
  assert.equal(wf.on.workflow_dispatch.inputs.confirmation.type, 'string');
  assert.deepEqual(wf.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(wf.jobs), ['deploy']);
  const job = wf.jobs.deploy;
  assert.equal(job.if.replace(/\s+/g, ' ').trim(), guard);
  assert.equal(job.environment.name, 'firebase-production');
  assert.deepEqual(job.permissions, { contents: 'read', 'id-token': 'write' });
  const steps = job.steps;
  for (const step of steps.filter((step) => step.uses)) {
    assert.match(step.uses, /@[a-f0-9]{40}$/);
  }
  assert.equal(steps[0].with['persist-credentials'], false);
  const auth = steps.findIndex((step) => step.uses?.startsWith('google-github-actions/auth@'));
  assert.ok(auth > steps.findIndex((step) => step.run?.includes('node tests/firebase-hosting.test.mjs')));
  assert.equal(steps[auth].with.workload_identity_provider, '${{ vars.FIREBASE_WIF_PROVIDER }}');
  assert.equal(steps[auth].with.service_account, '${{ vars.FIREBASE_SERVICE_ACCOUNT }}');
  assert.equal(steps[auth].with.create_credentials_file, true);
  assert.equal(steps[auth].with.export_environment_variables, true);
  assert.equal(steps.at(-1).run, '.github/firebase/node_modules/.bin/firebase deploy --only hosting --project malguard1 --config firebase.json --non-interactive');
  const preflight = steps.find((step) => step.env?.HOSTING_ENABLED);
  assert.equal(preflight.env.HOSTING_ENABLED, '${{ vars.FIREBASE_HOSTING_ENABLED }}');
  assert.ok(preflight.run.includes('test "$HOSTING_ENABLED" = true'));
  assert.ok(preflight.run.includes('test "$SERVICE_ACCOUNT" = github-hosting@malguard1.iam.gserviceaccount.com'));
  assert.ok(!JSON.stringify(wf).includes('${{ secrets.'));
}

const routes = new Set(json('tests/unified-source-inventory.json').routes.map((route) => route.path));
const fixedFiles = new Set([
  'robots.txt', 'sitemap.xml', 'favicon.ico', 'favicon-96.png', 'favicon-192.png',
  '.well-known/security.txt',
]);
const publicDirs = new Set(['assets', 'release', 'data', 'ios-preview', 'research']);
function validatePublicPath(path) {
  const parts = path.split('/');
  assert.ok(!parts.some((part) => /^(?:\.env.*|gha-creds-.*\.json|firebase-debug.*\.log|node_modules|\.git|\.github|\.firebase)$/.test(part)), `Credential/development file: ${path}`);
  assert.ok(!/\.(?:exe|sealed)$/i.test(path), `Server payload or installer: ${path}`);
  assert.ok(routes.has(path) || fixedFiles.has(path) || publicDirs.has(parts[0]), `Unexpected public path: ${path}`);
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), `Symlink in public output: ${path}`);
    if (stat.isDirectory()) yield* files(path);
    else yield path;
  }
}

test('Firebase configuration targets only malguard1/malguard and preserves .html routing', () => {
  validateConfig(json('firebase.json'), json('.firebaserc'));
});

test('deployment cannot run on a PR, a push, another branch, or without explicit confirmation', () => {
  validateDeploy(workflow('firebase-hosting.yml'));
});

test('reject configuration changes that publish the repository or deploy another site/project', () => {
  for (const [key, value] of [['public', '.'], ['site', 'other-site'], ['rewrites', [{ source: '**', destination: '/index.html' }]]]) {
    const config = json('firebase.json');
    config.hosting[key] = value;
    assert.throws(() => validateConfig(config, json('.firebaserc')));
  }
  assert.throws(() => validateConfig(json('firebase.json'), { projects: { default: 'other-project' } }));
});

test('reject automatic deployment triggers and weakened deployment guards', () => {
  for (const trigger of ['push', 'pull_request', 'pull_request_target', 'workflow_run']) {
    const wf = workflow('firebase-hosting.yml');
    wf.on[trigger] = {};
    assert.throws(() => validateDeploy(wf));
  }
  const wf = workflow('firebase-hosting.yml');
  wf.jobs.deploy.if = "github.ref == 'refs/heads/main'";
  assert.throws(() => validateDeploy(wf));
});

test('PR validation has no cloud credentials, deployment commands, or environment access', () => {
  const wf = workflow('firebase-hosting-validation.yml');
  assert.deepEqual(wf.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(wf.on).sort(), ['pull_request', 'push']);
  for (const job of Object.values(wf.jobs)) {
    assert.equal(job.environment, undefined);
    assert.equal(job.permissions, undefined);
    for (const step of job.steps) {
      if (step.uses) {
        assert.match(step.uses, /^(actions\/checkout|actions\/setup-node)@[a-f0-9]{40}$/);
      }
      assert.ok(!/firebase (?:deploy|hosting:channel:deploy)|secrets\.|id-token|google-github-actions\/auth/.test(JSON.stringify(step)));
    }
  }
});

test('the built site contains all approved pages, with identical source bytes and no backend sources', () => {
  const out = join(root, '_site');
  const shipped = new Set();
  for (const file of files(out)) {
    const path = relative(out, file).split('\\').join('/');
    validatePublicPath(path);
    assert.deepEqual(readFileSync(file), readFileSync(join(root, path)), `Changed public bytes: ${path}`);
    shipped.add(path);
  }
  for (const path of [...routes, ...fixedFiles]) assert.ok(shipped.has(path), `Missing public route/asset: ${path}`);
  // The reviewed historical ciphertext stays unchanged. The active password
  // download API and sealed runtime pieces remain on the separate Vercel service.
  const historical = json('release/malguard-private-release.json');
  assert.ok(shipped.has(historical.url.slice(1)));
  assert.equal(json('release/malguard-current-release.json').serviceUrl, 'https://malguard-private-download.vercel.app/api/installer');
});

test('reject credentials or backend files even if inserted into otherwise public directories', () => {
  for (const path of [
    'api/game-scam-scan.js', 'private-download-service/api/installer.js',
    'tests/experience.mjs', '.github/workflows/static.yml',
    'assets/gha-creds-example.json', 'data/.env.production',
    'release/payload.sealed', 'release/installer.exe', 'firebase.json',
  ]) assert.throws(() => validatePublicPath(path), path);
  validatePublicPath('.well-known/security.txt');
});
