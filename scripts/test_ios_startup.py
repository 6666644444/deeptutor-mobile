from pathlib import Path
import plistlib
import tempfile
import unittest
from ios_startup import verify_app, verify_project


class SceneStartupChecks(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.app = self.root / 'ios' / 'Fixture'
        self.app.mkdir(parents=True)

    def write(self, scene=True, provider=True, legacy=False):
        info = {'DTSDKName': 'iphoneos27.0'}
        if scene:
            info['UIApplicationSceneManifest'] = {'UISceneConfigurations': {
                'UIWindowSceneSessionRoleApplication': [{'UISceneDelegateClassName': 'EXExpoAppSceneDelegate'}]}}
        (self.app / 'Info.plist').write_bytes(plistlib.dumps(info))
        (self.app / 'AppDelegate.swift').write_text(
            'class AppDelegate: ExpoAppDelegate' + (', ExpoReactNativeFactoryProvider' if provider else '') +
            ' { ' + ('factory.startReactNative(withModuleName: "main")' if legacy else '') + ' }')

    def test_rejects_previously_shipped_scene_less_app(self):
        self.write(scene=False, provider=False, legacy=True)
        with self.assertRaisesRegex(ValueError, 'Missing iOS scene delegate'):
            verify_app(self.app)

    def test_manifest_alone_does_not_make_generated_project_valid(self):
        self.write(provider=False)
        with self.assertRaisesRegex(ValueError, 'missing factory provider'):
            verify_project(self.root)

    def test_rejects_double_startup(self):
        self.write(legacy=True)
        with self.assertRaisesRegex(ValueError, 'Legacy AppDelegate startup'):
            verify_project(self.root)

    def test_accepts_scene_factory_project_and_built_app(self):
        self.write()
        verify_project(self.root)
        verify_app(self.app)


if __name__ == '__main__':
    unittest.main()
