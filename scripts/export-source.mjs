import { publicFiles } from './source-check.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } });
const output = path.resolve(values['output-dir'] || path.join(root, 'artifacts'));
mkdirSync(output, { recursive: true });
const manifest = path.join(output, 'source-manifest.txt');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const archive = path.join(output, `deeptutor-mobile-${version}-source.tar.gz`);
writeFileSync(manifest, publicFiles().join('\n') + '\n');
// Python tarfile avoids macOS AppleDouble/xattrs; normalize ownership and time.
const result = spawnSync('python3', ['-c', `
import gzip, tarfile, sys
from pathlib import Path
def clean(info):
    info.uid = info.gid = info.mtime = 0
    info.uname = info.gname = ''
    info.pax_headers = {}
    return info
with open(sys.argv[1], 'wb') as output:
    with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for name in Path(sys.argv[2]).read_text().splitlines():
                archive.add(name, arcname=name, recursive=False, filter=clean)
`, archive, manifest], { cwd: root, stdio: 'inherit' });
if (result.status) process.exit(result.status);
writeFileSync(archive + '.sha256', createHash('sha256').update(readFileSync(archive)).digest('hex') + '  ' + path.basename(archive) + '\n');
console.log(archive);
