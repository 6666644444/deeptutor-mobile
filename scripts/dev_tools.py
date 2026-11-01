"""Shared local development helpers. No global settings or signing identities."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def environment():
    return dict(os.environ, EXPO_NO_TELEMETRY='1', NODE_ENV='development')


def run(args, env, capture=False, cwd=ROOT):
    result = subprocess.run([str(x) for x in args], cwd=cwd, env=env,
                            text=True, check=True, capture_output=capture)
    return result.stdout.strip() if capture else None


def require_dependencies():
    if not shutil.which('node') or not (ROOT / 'node_modules/expo/bin/cli').is_file():
        raise SystemExit('Install Node.js 24 and run npm ci first.')


def app_config(env):
    return json.loads(run(['node', '-e', 'console.log(JSON.stringify(require("./app.config.js").expo))'], env, True))


def port(value):
    value = int(value)
    if not 1 <= value <= 65535:
        raise ValueError('Port must be between 1 and 65535.')
    return value


def require_metro(value):
    # Local development must not route through a machine's external HTTP proxy.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(f'http://127.0.0.1:{value}/status', timeout=3) as response:
            if response.read().decode().strip() == 'packager-status:running':
                return
    except OSError:
        pass
    raise SystemExit(f'Metro is not running on port {value}. In this project, start: npx expo start --lan --port {value}')


def xcode_environment():
    env = environment()
    if not env.get('DEVELOPER_DIR'):
        selected = subprocess.run(['xcode-select', '-p'], capture_output=True, text=True)
        candidate = Path(selected.stdout.strip())
        if not (candidate / 'usr/bin/xcodebuild').is_file():
            candidate = Path('/Applications/Xcode.app/Contents/Developer')
        if not (candidate / 'usr/bin/xcodebuild').is_file():
            raise SystemExit('Install Xcode, or set DEVELOPER_DIR to its Contents/Developer directory.')
        env['DEVELOPER_DIR'] = str(candidate)
    return env


def android_environment():
    env = environment()
    sdk = env.get('ANDROID_HOME') or env.get('ANDROID_SDK_ROOT')
    if not sdk:
        candidates = [Path.home() / 'Library/Android/sdk', Path.home() / 'Android/Sdk']
        if env.get('LOCALAPPDATA'):
            candidates.append(Path(env['LOCALAPPDATA']) / 'Android/Sdk')
        sdk = next((str(p) for p in candidates if p.is_dir()), '')
    adb = Path(sdk) / 'platform-tools' / ('adb.exe' if os.name == 'nt' else 'adb')
    if not sdk or not adb.is_file():
        raise SystemExit('Install Android SDK/platform-tools and set ANDROID_HOME.')
    env['ANDROID_HOME'] = env['ANDROID_SDK_ROOT'] = sdk
    return env, adb


def require_java(env):
    if not env.get('JAVA_HOME') and Path('/usr/libexec/java_home').is_file():
        for version in ('17', '21'):
            found = subprocess.run(['/usr/libexec/java_home', '-v', version], capture_output=True, text=True)
            if found.returncode == 0:
                env['JAVA_HOME'] = found.stdout.strip()
                break
    home = Path(env.get('JAVA_HOME', ''))
    java = home / 'bin' / ('java.exe' if os.name == 'nt' else 'java')
    javac = home / 'bin' / ('javac.exe' if os.name == 'nt' else 'javac')
    if not java.is_file() or not javac.is_file():
        raise SystemExit('Set JAVA_HOME to a JDK 17 or 21 installation (a JRE is insufficient).')
    env['PATH'] = str(home / 'bin') + os.pathsep + env.get('PATH', '')
