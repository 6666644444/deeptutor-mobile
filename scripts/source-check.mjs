import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export const roots = ['src', 'plugins', 'scripts', 'tests', 'docs', 'fixtures', '.github'];
export const files = ['AGENTS.md', 'README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'package.json', 'package-lock.json', 'app.config.js', 'tsconfig.json', 'tsconfig.tests.json', 'eslint.config.js', '.gitignore', '.env.example'];
export function publicFiles() {
  const found = files.filter(f => { try { return lstatSync(path.join(root, f)).isFile(); } catch { return false; } });
  const visit = dir => { for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isSymbolicLink()) throw Error(`Symlink forbidden: ${relative}`);
    if (entry.isDirectory()) visit(relative); else found.push(relative);
  } };
  for (const dir of roots) { try { lstatSync(path.join(root, dir)); } catch { continue; } visit(dir); }
  return found.sort();
}
// Personal deny terms belong in the caller's environment, never in this source.
// A source archive can be checked without Git; --history additionally checks
// every reachable commit and its author/committer metadata before publication.
const privateTerms = JSON.parse(process.env.SOURCE_PRIVATE_TERMS_JSON || '[]');
if (!Array.isArray(privateTerms) || privateTerms.some(value => typeof value !== 'string' || !value))
  throw Error('SOURCE_PRIVATE_TERMS_JSON must be a JSON array of nonempty strings.');
const forbidden = [/(?:\/Users\/|\/home\/)[^/\s]+\//, /[A-Z]:\\Users\\[^\\\s]+\\/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/];
const noticeFiles = new Set(['docs/third-party-license-texts.txt', 'docs/dependency-licenses.json', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'package-lock.json']);
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const publicEmail = value => /@(?:users\.noreply\.github\.com|[^@]+\.(?:invalid|test)|example\.(?:com|org|net))$/i.test(value);
export function assertPublicText(file, text) {
  if (/\.(?:png|jpe?g|pdf|docx|p12|keystore|jks|mobileprovision|ipa|apk|aab)$/i.test(file)) throw Error(`Private/binary file: ${file}`);
  if (text.includes('\0') || forbidden.some(pattern => pattern.test(text)) || privateTerms.some(term => text.toLowerCase().includes(term.toLowerCase())))
    throw Error(`Potential private material: ${file}`);
  if (!noticeFiles.has(file) && [...text.matchAll(emailPattern)].some(match => !publicEmail(match[0])))
    throw Error(`Non-example contact address: ${file}`);
}
for (const file of publicFiles()) assertPublicText(file, readFileSync(path.join(root, file), 'utf8'));
export function auditHistory() {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  if (path.resolve(git(['rev-parse', '--show-toplevel']).trim()) !== path.resolve(root)) throw Error('Run history checks in this repository.');
  if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') throw Error('History scan requires a full clone (git fetch --unshallow).');
  const commits = git(['rev-list', '--all']).trim().split('\n').filter(Boolean);
  const seen = new Set();
  for (const commit of commits) {
    const metadata = git(['show', '-s', '--format=%an%x00%ae%x00%cn%x00%ce%x00%B', commit]);
    assertPublicText('commit metadata', metadata.replaceAll('\0', '\n'));
    const fields = metadata.split('\0');
    if (!publicEmail(fields[1]) || !publicEmail(fields[3])) throw Error(`Non-public commit identity: ${commit}`);
    for (const entry of git(['ls-tree', '-rz', commit]).split('\0').filter(Boolean)) {
      const [info, file] = entry.split('\t'); const [mode, type, sha] = info.split(' ');
      if (type !== 'blob' || !['100644', '100755'].includes(mode)) throw Error(`Unsupported history entry: ${file}`);
      if (!files.includes(file) && !roots.some(dir => file.startsWith(dir + '/'))) throw Error(`Unlisted history file: ${file}`);
      const key = `${sha}:${file}`;
      if (!seen.has(key)) { assertPublicText(file, git(['cat-file', 'blob', sha])); seen.add(key); }
    }
  }
  return { commits: commits.length, entries: seen.size };
}
if (process.argv[1]?.endsWith('source-check.mjs')) {
  console.log(`Source privacy check: ${publicFiles().length} allowlisted text files passed.`);
  if (process.argv.includes('--history')) console.log('History privacy check:', auditHistory());
}
