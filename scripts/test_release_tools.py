import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from release_tools import audit_archive, public_environment


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
                                     'EXPO_PUBLIC_TOKEN': 'fixture', 'EXPO_NO_DOTENV': '0'}):
            env = public_environment()
            self.assertEqual(env['EXPO_PUBLIC_DEFAULT_SERVER'], '')
            self.assertEqual(env['EXPO_NO_DOTENV'], '1')
            self.assertNotIn('EXPO_PUBLIC_TOKEN', env)

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
