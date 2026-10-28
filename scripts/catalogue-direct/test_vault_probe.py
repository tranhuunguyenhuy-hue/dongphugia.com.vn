import base64
import io
import json
import os
import runpy
import unittest
import urllib.error
from unittest.mock import patch

ns = runpy.run_path(os.path.join(os.path.dirname(__file__), 'checkpoint-key.py'))

class Response(io.BytesIO):
    def __init__(self, data, scopes=''):
        super().__init__(json.dumps(data).encode())
        self.headers = {'X-OAuth-Scopes': scopes}

class VaultProbeTests(unittest.TestCase):
    def check(self, scopes='', private_count=1, failure=False):
        repo = 'tranhuunguyenhuy-hue/synthetic-vault'
        calls = []
        cipher = b'age-encrypted-public-probe-fixture'
        def open_request(request, timeout):
            calls.append((request.method,request.full_url))
            if failure:
                raise urllib.error.HTTPError(request.full_url,403,'sensitive body must not escape',{},None)
            if request.full_url.endswith('/git/blobs'):
                self.assertEqual(base64.b64decode(json.loads(request.data)['content']),cipher)
                return Response({'sha':'a'*40})
            if '/git/blobs/' in request.full_url:
                return Response({'content':base64.b64encode(cipher).decode()})
            if '/user/repos?' in request.full_url:
                return Response([{'full_name':repo}]*private_count)
            return Response({'private':True,'owner':{'login':'tranhuunguyenhuy-hue'}},scopes)
        with patch.dict(os.environ,{'DIRECT_VAULT_REPOSITORY':repo,'DIRECT_VAULT_TOKEN':'synthetic-fixture-only'}), patch('urllib.request.build_opener') as opener:
            opener.return_value.open.side_effect = open_request
            result = ns['check_vault'](cipher)
        return result,calls

    def test_read_write_without_refs(self):
        result,calls=self.check()
        self.assertEqual(result['vault_contents_read_write'],'PASS')
        self.assertFalse(result['existing_refs_modified'])
        self.assertEqual(sum(method=='POST' for method,url in calls),1)
        self.assertTrue(all('/git/refs' not in url for method,url in calls))

    def test_classic_scopes_rejected(self):
        with self.assertRaisesRegex(ns['VaultGate'],'VAULT_CLASSIC_OAUTH_SCOPES_REJECTED'):
            self.check(scopes='repo, workflow')

    def test_other_private_repository_scope_rejected(self):
        with self.assertRaisesRegex(ns['VaultGate'],'VAULT_PRIVATE_REPOSITORY_SCOPE_MISMATCH'):
            self.check(private_count=2)

    def test_http_error_sanitized(self):
        with self.assertRaises(ns['VaultGate']) as caught:
            self.check(failure=True)
        self.assertEqual(str(caught.exception),'VAULT_METADATA_HTTP_403')

if __name__=='__main__':
    unittest.main()
