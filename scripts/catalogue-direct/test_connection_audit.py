"""Project-bound setup transport: no actual credentials or DB connections."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('audit', pathlib.Path(__file__).with_name('connection-audit.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class ProjectBinding(unittest.TestCase):
    def test_direct_project(self):
        self.assertTrue(audit.matches(f'postgresql://postgres:example@db.{audit.SOURCE}.supabase.co:5432/postgres', audit.SOURCE))
        self.assertFalse(audit.matches(f'postgresql://postgres:example@db.{audit.TARGET}.supabase.co:5432/postgres', audit.SOURCE))

    def test_pooler_project(self):
        value = f'postgresql://postgres.{audit.TARGET}:example@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
        self.assertTrue(audit.matches(value, audit.TARGET))
        self.assertFalse(audit.matches(value, audit.SOURCE))
        self.assertFalse(audit.matches(value.replace('.pooler.supabase.com', '.pooler.supabase.com.evil.test'), audit.TARGET))

    def test_invalid_and_missing_password(self):
        for value in ['', 'postgresql://[', f'postgresql://postgres@db.{audit.SOURCE}.supabase.co/postgres',
                      f'https://postgres:example@db.{audit.SOURCE}.supabase.co/postgres',
                      f'postgresql://postgres:example@db.{audit.SOURCE}.supabase.co:bad/postgres']:
            self.assertFalse(audit.matches(value, audit.SOURCE))

    def test_query_overrides_and_fragments_rejected(self):
        value = f'postgresql://postgres:example@db.{audit.SOURCE}.supabase.co/postgres'
        for suffix in ['?host=other.test', '?user=postgres.other', '?service=other',
                       '?options=-csearch_path=other', '?sslmode=disable', '#other']:
            self.assertFalse(audit.matches(value + suffix, audit.SOURCE))


if __name__ == '__main__':
    unittest.main()
