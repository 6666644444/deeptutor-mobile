import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from release_tools import audit_archive, public_environment, verify_android_runtime


class ReleaseChecks(unittest.TestCase):
    def archive(self, name, data):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        file = Path(temporary.name) / 'candidate.zip'
        with zipfile.ZipFile(file, 'w') as z:
            z.writestr(name, data)
        return file

    def test_public_environment_discards_injected_default_and_dotenv(self):
        with patch.dict(os.environ, {'EXPO_PUBLIC_DEFAULT_SERVER': 'https://private.example',
                                     'EXPO_PUBLIC_TOKEN': 'fixture', 'EXPO_NO_DOTENV': '0',
                                     'EXPO_UPDATES_FINGERPRINT_OVERRIDE': 'injected-runtime',
                                     'EXPO_UPDATES_WORKFLOW_OVERRIDE': 'generic'}):
            env = public_environment()
            self.assertEqual(env['EXPO_PUBLIC_DEFAULT_SERVER'], '')
            self.assertEqual(env['EXPO_NO_DOTENV'], '1')
            self.assertNotIn('EXPO_PUBLIC_TOKEN', env)
            self.assertNotIn('EXPO_UPDATES_FINGERPRINT_OVERRIDE', env)
            self.assertNotIn('EXPO_UPDATES_WORKFLOW_OVERRIDE', env)

    def test_runtime_gate_rejects_stale_or_missing_packaged_fingerprints(self):
        expected = 'a' * 40
        self.assertEqual(verify_android_runtime(self.archive('assets/fingerprint', expected), expected), expected)
        for name, value in [('assets/fingerprint', 'b' * 40),
                            ('assets/fingerprint', 'not-a-fingerprint'), ('assets/other', expected)]:
            with self.subTest(name=name, value=value), self.assertRaises(ValueError):
                verify_android_runtime(self.archive(name, value), expected)

    def test_release_recovers_transient_runtime_or_stops_before_export(self):
        script = Path(__file__).with_name('release-android.py')
        for recovery_succeeds in (True, False):
            with self.subTest(recovery_succeeds=recovery_succeeds), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                apk = root / 'android/app/build/outputs/apk/release/app-release.apk'
                apk.parent.mkdir(parents=True)
                (root / 'sdk/build-tools/36.1.0').mkdir(parents=True)
                signing = root / 'signing.properties'
                signing.write_text('test fixture only')
                signing.chmod(0o600)
                project = root / 'project'
                project.mkdir()
                output = root / 'export'

                def package(runtime):
                    with zipfile.ZipFile(apk, 'w') as bundle:
                        bundle.writestr('assets/fingerprint', runtime)

                package('a' * 40)
                def command(args, _env, capture=False, cwd=None):
                    args = [str(a) for a in args]
                    if args[0] == 'node' and args[1] == '-e':
                        return 'b' * 40
                    if ':app:createReleaseUpdatesResources' in args and recovery_succeeds:
                        package('b' * 40)
                    if 'verify' in args:
                        return 'Verified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: ' + 'c' * 64
                    if 'badging' in args:
                        return "package: name='org.deeptutormobile.client' versionCode='6'"
                    return ''

                # Keep signing material outside the simulated repository.
                (project / 'android').symlink_to(root / 'android', target_is_directory=True)
                env = {'ANDROID_HOME': str(root / 'sdk'), 'DTM_SIGNING_PROPERTIES': str(signing)}
                with patch.dict(os.environ, {}, clear=True), \
                     patch.multiple('dev_tools', ROOT=project, android_environment=lambda: (env.copy(), None),
                                    require_dependencies=lambda: None, require_java=lambda _env: None, run=command), \
                     patch.object(sys, 'argv', [str(script), '--output-dir', str(output)]):
                    if recovery_succeeds:
                        runpy.run_path(str(script), run_name='__main__')
                        exported = list(output.glob('*.apk'))
                        self.assertEqual(len(exported), 1)
                        verify_android_runtime(exported[0], 'b' * 40)
                    else:
                        with self.assertRaises(ValueError):
                            runpy.run_path(str(script), run_name='__main__')
                        self.assertFalse(output.exists())

    def test_archive_rejects_credentials_signing_and_unsafe_paths(self):
        for name, data in [('assets/key.txt', 'sk-' + 'x' * 32), ('release.jks', 'fixture'),
                           ('../outside.txt', 'fixture'), ('/absolute.txt', 'fixture')]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                audit_archive(self.archive(name, data))

    def test_custom_private_terms_are_checked_in_binary_strings(self):
        with patch.dict(os.environ, {'SOURCE_PRIVATE_TERMS_JSON': json.dumps(['private.example'])}):
            with self.assertRaises(ValueError):
                audit_archive(self.archive('assets/bundle', b'\0https://PRIVATE.EXAMPLE\0'))

    def test_hermes_icon_string_pool_is_not_a_model_key(self):
        with patch.dict(os.environ, {'SOURCE_PRIVATE_TERMS_JSON': '[]'}):
            self.assertEqual(audit_archive(self.archive('assets/bundle',
                             b'flashlight-outline' + b'flask-' + b'outlineflower-outline')), 1)


if __name__ == '__main__':
    unittest.main()
