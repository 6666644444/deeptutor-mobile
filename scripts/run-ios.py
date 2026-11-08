#!/usr/bin/env python3
"""Build and run a Debug or standalone Release app on an explicit simulator."""
import argparse
import json
from pathlib import Path
import shutil
from dev_tools import ROOT, app_config, port, require_dependencies, require_metro, run, xcode_environment

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--device', help='Exact iOS simulator UDID; never auto-select a device')
parser.add_argument('--list-devices', action='store_true')
parser.add_argument('--build-only', action='store_true')
parser.add_argument('--launch-only', action='store_true')
parser.add_argument('--port', type=port, default=8086)
parser.add_argument('--configuration', choices=['Debug', 'Release'], default='Debug')
parser.add_argument('--derived-data', type=Path, default=ROOT / 'artifacts/ios-simulator')
args = parser.parse_args()
env = xcode_environment()
devices = json.loads(run(['xcrun', 'simctl', 'list', 'devices', 'available', '-j'], env, True))['devices']
available = [d for runtime, group in devices.items() if '.iOS-' in runtime for d in group if d.get('isAvailable')]
if args.list_devices:
    for d in available:
        print(f"{d['udid']}  {d['name']}  {d['state']}")
    raise SystemExit(0)
if not args.device:
    parser.error('--device is required. Use --list-devices; create a separate simulator in Xcode if needed.')
device = next((d for d in available if d['udid'] == args.device), None)
if not device:
    parser.error('--device must identify an available simulator, not a physical phone')
if args.build_only and args.launch_only:
    parser.error('--build-only and --launch-only cannot be combined')
require_dependencies()
if not args.build_only and args.configuration == 'Debug':
    require_metro(args.port)
derived = args.derived_data.resolve()
if not args.launch_only:
    if not shutil.which('pod'):
        raise SystemExit('Install CocoaPods, then run this command again.')
    run(['node', 'node_modules/expo/bin/cli', 'prebuild', '--platform', 'ios', '--no-install'], env)
    run(['pod', 'install', '--project-directory=ios'], env)
workspaces = list((ROOT / 'ios').glob('*.xcworkspace'))
if len(workspaces) != 1:
    raise SystemExit('Expected one generated iOS workspace; run again without --launch-only.')
workspace = workspaces[0]
if not args.launch_only:
    # Xcode supplies simulator-specific entitlements. Disabling signing breaks
    # Keychain; manually adding device entitlements is not a valid substitute.
    run(['xcodebuild', '-workspace', workspace, '-scheme', workspace.stem,
         '-configuration', args.configuration, '-quiet', '-destination', f'platform=iOS Simulator,id={args.device}',
         '-derivedDataPath', derived, 'CODE_SIGN_IDENTITY=-', 'CODE_SIGNING_ALLOWED=YES',
         'DEVELOPMENT_TEAM=', 'PROVISIONING_PROFILE_SPECIFIER=', 'CODE_SIGN_STYLE=Manual', 'build'], env)
apps = list((derived / f'Build/Products/{args.configuration}-iphonesimulator').glob('*.app'))
if len(apps) != 1:
    raise SystemExit('Expected one simulator app; rebuild without --launch-only.')
print(apps[0])
if not args.build_only:
    if device['state'] != 'Booted':
        run(['xcrun', 'simctl', 'boot', args.device], env)
    run(['xcrun', 'simctl', 'bootstatus', args.device, '-b'], env)
    run(['xcrun', 'simctl', 'install', args.device, apps[0]], env)
    package = app_config(env)['ios']['bundleIdentifier']
    run(['xcrun', 'simctl', 'launch', '--terminate-running-process', args.device, package,
         *(['-RCT_jsLocation', f'127.0.0.1:{args.port}'] if args.configuration == 'Debug' else [])], env)
