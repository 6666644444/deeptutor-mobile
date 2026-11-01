import { publicFiles } from './source-check.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/source-manifest.txt', publicFiles().join('\n') + '\n');
// Python tarfile avoids macOS AppleDouble/xattrs; normalize ownership and time.
const result = spawnSync('python3', ['-c', `
import gzip, tarfile
from pathlib import Path
def clean(info):
    info.uid = info.gid = info.mtime = 0
    info.uname = info.gname = ''
    info.pax_headers = {}
    return info
with open('artifacts/deeptutor-mobile-0.1.0-source.tar.gz', 'wb') as output:
    with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for name in Path('artifacts/source-manifest.txt').read_text().splitlines():
                archive.add(name, arcname=name, recursive=False, filter=clean)
`], { stdio: 'inherit' });
if (result.status) process.exit(result.status);
console.log('artifacts/deeptutor-mobile-0.1.0-source.tar.gz');
