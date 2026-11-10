#!/usr/bin/env python3
"""Build a standalone, signed, generic APK. Does not install or publish it."""
import argparse
import os
from pathlib import Path
import re
import shutil
from dev_tools import ROOT, android_environment, require_dependencies, require_java, run
from release_tools import android_runtime, audit_archive, public_environment, receipt, verify_android_runtime, version

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--arch', choices=['arm64-v8a', 'x86_64'], default='arm64-v8a')
args = parser.parse_args()
require_dependencies()
env, _ = android_environment()
env = public_environment(env)
require_java(env)
signing = Path(env.get('DTM_SIGNING_PROPERTIES', ''))
if not signing.is_file():
    parser.error('Set DTM_SIGNING_PROPERTIES to a protected properties file outside this repository.')
if signing.resolve().is_relative_to(ROOT):
    parser.error('Signing properties must stay outside the repository.')
if os.name != 'nt' and signing.stat().st_mode & 0o077:
    parser.error('Signing properties must be readable only by their owner (chmod 600).')
env['DTM_SIGNING_PROPERTIES'] = str(signing.resolve())
run(['node', 'scripts/source-check.mjs'], env)
run(['node', 'node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install'], env)
gradle_memory = env.get('DTM_GRADLE_JVM_ARGS')
gradle = 'gradlew.bat' if os.name == 'nt' else './gradlew'
gradle_options = [f'-PreactNativeArchitectures={args.arch}',
                  *([f'-Dorg.gradle.jvmargs={gradle_memory}'] if gradle_memory else []),
                  '--console=plain', '--quiet']
run([gradle, ':app:assembleRelease', *gradle_options], env, cwd=ROOT / 'android')
apk = ROOT / 'android/app/build/outputs/apk/release/app-release.apk'
# Kotlin compiler session files can exist while the initial build calculates
# its fingerprint, then disappear when Gradle exits. Reuse Expo's calculator
# after compilation; never inject or rewrite a runtime value in the package.
def completed_runtime():
    return run(['node', '-e',
                "require('expo/fingerprint').createFingerprintAsync(process.cwd(), "
                "{platforms:['android']}).then(x=>console.log(x.hash))"], env, True)


expected_runtime = completed_runtime()
if android_runtime(apk) != expected_runtime:
    print('Native fingerprint changed after compilation; regenerating update resources.')
    run([gradle, ':app:createReleaseUpdatesResources', '--rerun', *gradle_options], env, cwd=ROOT / 'android')
    run([gradle, ':app:assembleRelease', *gradle_options], env, cwd=ROOT / 'android')
    expected_runtime = completed_runtime()
verify_android_runtime(apk, expected_runtime)
build_tools = sorted((Path(env['ANDROID_HOME']) / 'build-tools').glob('*'),
                     key=lambda p: [int(n) for n in re.findall(r'\d+', p.name)])[-1]
cert = run([build_tools / ('apksigner.bat' if os.name == 'nt' else 'apksigner'),
            'verify', '--verbose', '--print-certs', apk], env, True)
if 'Android Debug' in cert or 'Verified using v2 scheme (APK Signature Scheme v2): true' not in cert:
    raise SystemExit('APK must verify with v2 signing and a non-debug certificate.')
certificate = re.search(r'Signer #1 certificate SHA-256 digest: ([a-f0-9]+)', cert).group(1)
expected = env.get('DTM_EXPECTED_CERT_SHA256')
if expected and certificate != expected.lower().replace(':', ''):
    raise SystemExit('APK certificate differs from the established release certificate.')
badging = run([build_tools / ('aapt2.exe' if os.name == 'nt' else 'aapt2'), 'dump', 'badging', apk], env, True)
if 'application-debuggable' in badging:
    raise SystemExit('Public APK must not be debuggable.')
audit_archive(apk)
output = args.output_dir.resolve()
output.mkdir(parents=True, exist_ok=True)
destination = output / f'deeptutor-mobile-{version()}-{args.arch}.apk'
if destination.exists():
    raise SystemExit('Output already exists; choose a new version or output directory.')
shutil.copy2(apk, destination)
receipt(destination, platform='android', architecture=args.arch, certificateSha256=certificate,
        standalone=True, defaultServer='', package=re.search(r"name='([^']+)'", badging).group(1),
        versionCode=int(re.search(r"versionCode='(\d+)'", badging).group(1)),
        runtimeVersion=expected_runtime, runtimeVerified=True)
