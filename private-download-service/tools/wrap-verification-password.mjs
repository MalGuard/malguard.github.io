// Deliver passwords only to the reviewed workflow's ephemeral RSA recipient.
// Arguments contain private file paths, never password values.
import {readFileSync, writeFileSync} from 'node:fs';
import {createPublicKey, publicEncrypt, constants, createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {metadata} from '../installer-release.mjs';
import {downloadPassword} from '../lib/password-download.mjs';

const [directory, runId, sourceCommit, passwordFile, previousPasswordFile] = process.argv.slice(2);
if (!directory || !/^\d+$/.test(runId || '') || !/^[a-f0-9]{40}$/.test(sourceCommit || '') || !passwordFile) {
  throw new Error('Expected proof directory, reviewed run ID, source commit and private password file paths');
}
const recipient = JSON.parse(readFileSync(resolve(directory, 'recipient.json'), 'utf8'));
if (recipient.schema !== 1 || recipient.runId !== runId || recipient.sourceCommit !== sourceCommit ||
    recipient.build !== metadata.build || recipient.sha256 !== metadata.sha256 || recipient.sealedSha256 !== metadata.sealedSha256) {
  throw new Error('Ephemeral recipient does not match the reviewed release and workflow');
}
const key = createPublicKey(recipient.publicKey);
if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength !== 3072) throw new Error('Invalid recipient key');
const code = readFileSync(passwordFile, 'utf8').replace(/\r?\n$/, '');
if (!downloadPassword(code, metadata.passwordKdf)) throw new Error('Invalid password file');
const payload = {runId, sha256: metadata.sha256, sealedSha256: metadata.sealedSha256, code};
if (previousPasswordFile) {
  payload.previousCode = readFileSync(previousPasswordFile, 'utf8').replace(/\r?\n$/, '');
  if (!payload.previousCode || payload.previousCode.length > 80 || payload.previousCode === code) throw new Error('Invalid previous password file');
}
const raw = Buffer.from(JSON.stringify(payload));
if (raw.length > 318) throw new Error('Private verification payload exceeds recipient capacity');
const ciphertext = publicEncrypt({key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256'}, raw);
raw.fill(0);
writeFileSync(resolve(directory, 'wrapped-code.json'), JSON.stringify({schema: 1, runId,
  recipientSha256: createHash('sha256').update(recipient.publicKey).digest('hex'), ciphertext: ciphertext.toString('base64')}, null, 2) + '\n');
console.log('Passwords wrapped for the reviewed ephemeral recipient; no plaintext published');
