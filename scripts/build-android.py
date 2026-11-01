#!/usr/bin/env python3
"""Build a local Debug APK; install/launch only on an explicitly named device."""
import argparse
import os
from dev_tools import ROOT, android_environment, app_config, port, require_dependencies, require_java, require_metro, run

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--device', help='Exact adb serial; never auto-select a device')
parser.add_argument('--list-devices', action='store_true')
parser.add_argument('--launch-only', action='store_true', help='Install/launch the existing APK without rebuilding')
parser.add_argument('--port', type=port, default=8086)
parser.add_argument('--arch', choices=['arm64-v8a', 'x86_64'], default='arm64-v8a')
args = parser.parse_args()
env, adb = android_environment()
if args.list_devices:
    run([adb, 'devices', '-l'], env)
    raise SystemExit(0)
if args.launch_only and not args.device:
    parser.error('--launch-only requires --device')
require_dependencies()
arch = args.arch
if args.device:
    devices = dict(line.split()[:2] for line in run([adb, 'devices'], env, True).splitlines()[1:] if len(line.split()) >= 2)
    if devices.get(args.device) != 'device':
        raise SystemExit('The selected device is not online/authorized. Run --list-devices and start or authorize that device.')
    supported = run([adb, '-s', args.device, 'shell', 'getprop', 'ro.product.cpu.abilist'], env, True).split(',')
    arch = next((a for a in supported if a in ['arm64-v8a', 'x86_64']), '')
    if not arch:
        raise SystemExit('This preview supports arm64-v8a and x86_64 devices.')
    require_metro(args.port)
apk = ROOT / 'android/app/build/outputs/apk/debug/app-debug.apk'
if not args.launch_only:
    require_java(env)
    run(['node', 'node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install'], env)
    run(['gradlew.bat' if os.name == 'nt' else './gradlew', ':app:assembleDebug',
         f'-PreactNativeArchitectures={arch}', f'-PreactNativeDevServerPort={args.port}', '--console=plain'], env, cwd=ROOT / 'android')
if not apk.is_file():
    raise SystemExit('No Debug APK exists. Run again without --launch-only.')
print(apk)
if args.device:
    package = app_config(env)['android']['package']
    run([adb, '-s', args.device, 'install', '-r', apk], env)
    run([adb, '-s', args.device, 'reverse', f'tcp:{args.port}', f'tcp:{args.port}'], env)
    run([adb, '-s', args.device, 'shell', 'am', 'force-stop', package], env)
    run([adb, '-s', args.device, 'shell', 'am', 'start', '-n', package + '/.MainActivity'], env)
