#!/usr/bin/env python3
"""Install Pods for the downloaded Xcode project without regenerating signing choices."""
import shutil
from dev_tools import ROOT, require_dependencies, run, xcode_environment

require_dependencies()
env = xcode_environment()
if not (ROOT / 'ios/Podfile').is_file():
    raise SystemExit('Use the iOS project download, or run npx expo prebuild --platform ios --no-install first.')
if not shutil.which('pod'):
    raise SystemExit('Install CocoaPods first.')
run(['pod', 'install', '--project-directory=ios'], env)
print('Open ios/*.xcworkspace in Xcode. Select your simulator, or configure your own signing team for a device.')
