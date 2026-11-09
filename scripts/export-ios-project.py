#!/usr/bin/env python3
"""Export a portable generated Xcode project with public sources; no Apple signing."""
import argparse
import json
from pathlib import Path
import shutil
import tempfile
import zipfile
from dev_tools import ROOT, require_dependencies, run
from release_tools import audit_archive, public_environment, receipt, version
from ios_startup import verify_project

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, required=True)
args = parser.parse_args()
require_dependencies()
env = public_environment()
# A fresh generation never inherits a local developer team, node executable,
# private .env file, Pods, simulator build, signing profile, or user workspace.
files = json.loads(run(['node', '--input-type=module', '-e',
                       'import {publicFiles} from "./scripts/source-check.mjs"; console.log(JSON.stringify(publicFiles()))'], env, True))
output = args.output_dir.resolve()
output.mkdir(parents=True, exist_ok=True)
destination = output / f'deeptutor-mobile-{version()}-ios-project.zip'
if destination.exists():
    raise SystemExit('Output already exists; choose a new version or output directory.')
with tempfile.TemporaryDirectory(prefix='dtm-ios-project-') as temporary:
    project = Path(temporary) / 'deeptutor-mobile'
    for name in files:
        target = project / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    (project / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
    run(['node', ROOT / 'node_modules/expo/bin/cli', 'prebuild', '--platform', 'ios', '--no-install'], env, cwd=project)
    verify_project(project)
    (project / 'node_modules').unlink()
    # CocoaPods creates the Pods entry when the recipient runs prepare:ios.
    native = next((project / 'ios').glob('*.xcodeproj'))
    workspace = native.with_suffix('.xcworkspace')
    workspace.mkdir(exist_ok=True)
    (workspace / 'contents.xcworkspacedata').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<Workspace version="1.0">\n'
        f'  <FileRef location="group:{native.name}"/>\n</Workspace>\n')
    (project / 'ios/.xcode.env.local').unlink(missing_ok=True)
    (project / 'START-HERE.md').write_text(
        '# iOS 工程\n\n这是客户端工程，不是可直接安装的 IPA。\n\n'
        '在 Mac 安装 Xcode、Node.js 24 和 CocoaPods 后，在解压目录运行：\n\n'
        '```sh\nnpm ci\nnpm run prepare:ios\nopen ios/*.xcworkspace\n```\n\n'
        '模拟器可直接选择设备运行。真机请为主 App 与 LearningShareExtension 选择自己的 Apple 团队，'
        '配置唯一 Bundle ID 和两者共同的 App Group；详见 docs/build.md。\n\n'
        '用 Xcode Release 配置打包，JavaScript 会随 App 打包，无需 Metro。首次打开填写你自己的 DeepTutor 地址。\n', encoding='utf-8')
    for file in (project / 'ios').rglob('*'):
        if file.is_file() and file.suffix in ('.pbxproj', '.plist', '.xcconfig', '.xcworkspacedata'):
            content = file.read_text()
            if str(ROOT) in content or str(project) in content:
                raise SystemExit('Nonportable generated project: ' + file.name)
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(project.rglob('*')):
            if file.is_symlink():
                raise SystemExit('Unexpected symlink in portable project')
            if file.is_file():
                archive.write(file, 'deeptutor-mobile/' + file.relative_to(project).as_posix())
try:
    count = audit_archive(destination)
except Exception:
    destination.unlink(missing_ok=True)
    raise
receipt(destination, platform='ios', format='xcode-project', files=count, signed=False, defaultServer='')
