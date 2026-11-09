"""Reject the legacy startup configuration that aborts with the iOS 27 SDK."""
import argparse
from pathlib import Path
import plistlib
import re


def verify_scene_manifest(info: dict):
    configurations = info.get('UIApplicationSceneManifest', {}).get('UISceneConfigurations', {})
    scenes = configurations.get('UIWindowSceneSessionRoleApplication', [])
    if not scenes or any(not scene.get('UISceneDelegateClassName') for scene in scenes):
        raise ValueError('Missing iOS scene delegate: enable ios.enableSceneSupport before building.')


def verify_project(project: Path):
    delegates = list((project / 'ios').glob('*/AppDelegate.swift'))
    if len(delegates) != 1:
        raise ValueError('Expected one generated application AppDelegate.swift.')
    delegate = delegates[0]
    verify_scene_manifest(plistlib.loads(delegate.with_name('Info.plist').read_bytes()))
    source = delegate.read_text()
    if not re.search(r'class\s+AppDelegate\s*:[^{]*\bExpoReactNativeFactoryProvider\b', source):
        raise ValueError('Scene delegate cannot start React Native: missing factory provider.')
    if re.search(r'\bfactory\.startReactNative\s*\(', source):
        raise ValueError('Legacy AppDelegate startup still present; regenerate with scene support.')


def verify_app(app: Path):
    verify_scene_manifest(plistlib.loads((app / 'Info.plist').read_bytes()))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--project', type=Path)
    target.add_argument('--app', type=Path)
    args = parser.parse_args()
    if args.project:
        verify_project(args.project)
    else:
        verify_app(args.app)
    print('iOS scene startup configuration verified.')
