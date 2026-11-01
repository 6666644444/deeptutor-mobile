#!/usr/bin/env python3
"""Local debug build only; never selects a device, signs or publishes a release."""
import os
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
if not os.environ.get('JAVA_HOME') or not os.environ.get('ANDROID_HOME'):
    raise SystemExit('Set JAVA_HOME (JDK 17) and ANDROID_HOME before building.')
env = dict(os.environ, EXPO_NO_TELEMETRY='1', NODE_ENV='development')
subprocess.run(['node', 'node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install'], cwd=root, env=env, check=True)
subprocess.run(['./gradlew', ':app:assembleDebug', '-PreactNativeArchitectures=arm64-v8a', '-PreactNativeDevServerPort=8086', '--console=plain'], cwd=root/'android', env=env, check=True)
print(root/'android/app/build/outputs/apk/debug/app-debug.apk')
