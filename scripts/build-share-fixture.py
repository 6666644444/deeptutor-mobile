#!/usr/bin/env python3
"""Build an independent Android file-sharing test sender; never installs it."""
import argparse
from pathlib import Path
import re
import shutil
import tempfile
import zipfile
from dev_tools import ROOT, android_environment, require_java, run


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    env, _ = android_environment()
    require_java(env)
    sdk, jdk = Path(env['ANDROID_HOME']), Path(env['JAVA_HOME'])
    order = lambda p: tuple(int(n) for n in re.findall(r'\d+', p.name))
    tools = sorted((sdk / 'build-tools').glob('*'), key=order)[-1]
    android_jar = sorted((sdk / 'platforms').glob('android-*/android.jar'),
                         key=lambda p: order(p.parent))[-1]
    source = ROOT / 'scripts/share-fixture'
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    destination = output / 'share-fixture.apk'
    if destination.exists():
        parser.error('Output already exists; use a fresh test output directory.')
    with tempfile.TemporaryDirectory(prefix='share-fixture-', dir=output) as work:
        work = Path(work)
        (work / 'classes').mkdir()
        (work / 'dex').mkdir()
        run([jdk / 'bin/javac', '-source', '8', '-target', '8', '-Xlint:-options',
             '-bootclasspath', android_jar, '-d', work / 'classes', *source.glob('*.java')], env)
        run([tools / 'd8', '--lib', android_jar, '--min-api', '26', '--output', work / 'dex',
             *work.glob('classes/**/*.class')], env)
        run([tools / 'aapt2', 'link', '--manifest', source / 'AndroidManifest.xml',
             '-I', android_jar, '-o', work / 'unsigned.apk'], env)
        with zipfile.ZipFile(work / 'unsigned.apk', 'a') as apk:
            apk.write(work / 'dex/classes.dex', 'classes.dex')
        run([tools / 'zipalign', '-f', '4', work / 'unsigned.apk', work / 'aligned.apk'], env)
        # Disposable test identity, unrelated to the app's release certificate.
        key = work / 'fixture-debug.jks'
        run([jdk / 'bin/keytool', '-genkeypair', '-keystore', key, '-storepass', 'android',
             '-keypass', 'android', '-alias', 'androiddebugkey', '-keyalg', 'RSA',
             '-keysize', '2048', '-validity', '30', '-dname', 'CN=Android Debug,O=Android,C=US'], env)
        run([tools / 'apksigner', 'sign', '--ks', key, '--ks-pass', 'pass:android',
             '--key-pass', 'pass:android', '--out', work / 'signed.apk', work / 'aligned.apk'], env)
        run([tools / 'apksigner', 'verify', '--verbose', work / 'signed.apk'], env)
        shutil.copy2(work / 'signed.apk', destination)
    print(destination)


if __name__ == '__main__':
    main()
