"""Shared release checks. Credentials stay outside the source and artifacts."""
import hashlib
import json
import os
from pathlib import Path
import re
import zipfile
from dev_tools import ROOT


def public_environment():
    env = {k: v for k, v in os.environ.items() if not k.startswith('EXPO_PUBLIC_')}
    env.update(NODE_ENV='production', EXPO_NO_DOTENV='1', EXPO_NO_TELEMETRY='1',
               EXPO_PUBLIC_DEFAULT_SERVER='')
    return env


def version():
    return json.loads((ROOT / 'package.json').read_text())['version']


def audit_archive(archive):
    terms = json.loads(os.environ.get('SOURCE_PRIVATE_TERMS_JSON', '[]'))
    if not isinstance(terms, list) or any(not isinstance(t, str) or not t for t in terms):
        raise ValueError('SOURCE_PRIVATE_TERMS_JSON must be a list of nonempty strings')
    # Hermes packs adjacent strings without separators (for example icon names
    # containing "flask-"). Source text is checked separately before bundling.
    patterns = [rb'-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----',
                rb'(?<![A-Za-z0-9_-])(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}',
                rb'(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}']
    with zipfile.ZipFile(archive) as bundle:
        for name in bundle.namelist():
            if '..' in Path(name).parts or name.startswith('/'):
                raise ValueError('Unsafe archive path')
            if re.search(r'\.(?:jks|keystore|p12|mobileprovision)$', name, re.I):
                raise ValueError('Signing material in archive: ' + name)
            data = bundle.read(name)
            if any(t.lower().encode() in data.lower() for t in terms) or any(re.search(p, data) for p in patterns):
                raise ValueError('Potential private material in archive entry: ' + name)
    return len(bundle.namelist())


def receipt(file, **metadata):
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    record = dict(file=file.name, sha256=digest, bytes=file.stat().st_size, version=version(), **metadata)
    file.with_suffix(file.suffix + '.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(record, ensure_ascii=False))
    return record
