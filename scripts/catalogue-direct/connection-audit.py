"""Seal only exact-project existing admin connection candidates; never print URLs."""
import base64
import json
import os
import pathlib
import re
import subprocess
import urllib.parse

SOURCE='tygjmrhandbffjllxveu'
TARGET='bonxyxluzlxfkdetryoo'
ENV_KEY='x0l57JCVOgPjnBI6xNZSk2QC+njh3+ttEZI9tvExkAE='
ENV_KEY_ID='3380204578043523366'

def matches(value, project):
    try:
        url=urllib.parse.urlsplit(value)
        user=urllib.parse.unquote(url.username or '')
        host=url.hostname or ''
        return (url.scheme in ('postgresql','postgres') and url.path=='/postgres'
            and not url.query and not url.fragment
            and bool(url.password) and (url.port or 5432) in (5432,6543)
            and (host=='db.'+project+'.supabase.co' or
                (re.fullmatch(r'aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com',host)
                 and user.endswith('.'+project))))
    except Exception:
        return False

def main():
    assert os.environ.get('GITHUB_ACTIONS')=='true'
    assert os.environ.get('GITHUB_REF')=='refs/heads/main'
    assert os.environ.get('GITHUB_ACTOR')=='tranhuunguyenhuy-hue'
    assert os.environ.get('GITHUB_RUN_ATTEMPT')=='1'
    assert os.environ['APPROVED_SHA']==os.environ['GITHUB_SHA']
    # Prevent repurposing this transport to exfiltrate existing setup credentials.
    assert os.environ['ENV_PUBLIC_KEY']==ENV_KEY
    assert os.environ['ENV_KEY_ID']==ENV_KEY_ID
    assert len(pathlib.Path('/proc/swaps').read_text().strip().splitlines())==1
    assert subprocess.run(['findmnt','-no','FSTYPE','-T','/dev/shm'],capture_output=True,check=True).stdout.strip()==b'tmpfs'
    from nacl.public import PublicKey, SealedBox
    box=SealedBox(PublicKey(base64.b64decode(ENV_KEY,validate=True)))
    sealed=[]
    for name,project,candidates in [
        ('DIRECT_SOURCE_SETUP_DATABASE_URL',SOURCE,['LEGACY_DIRECT_URL','LEGACY_DATABASE_URL','LEGACY_RUNTIME_URL']),
        ('DIRECT_TARGET_SETUP_DATABASE_URL',TARGET,['LEGACY_REHOME_URL']),
    ]:
        selected=next((os.environ.get(candidate,'') for candidate in candidates if matches(os.environ.get(candidate,''),project)),None)
        if selected:
            sealed.append({'name':name,'project':project,'encrypted_value':base64.b64encode(box.encrypt(selected.encode())).decode()})
    os.umask(0o077)
    pathlib.Path(os.environ['SEALED_OUTPUT']).write_text(json.dumps({'key_id':os.environ['ENV_KEY_ID'],'source_sha':os.environ['GITHUB_SHA'],'connections':sealed}))
    print(json.dumps({'status':'PASS','scope':'URI_PROJECT_BINDING_ONLY_NOT_DB_AUTH','sealed_connection_names':[x['name'] for x in sealed],
        'source_candidate_available':any(x['project']==SOURCE for x in sealed),'target_candidate_available':any(x['project']==TARGET for x in sealed),
        'database_queries':False,'historical_environment_modified':False}))

if __name__=='__main__':
    try:
        main()
    except Exception:
        print('DIRECT_CONNECTION_AUDIT status=STOP reason=PROTECTED_OPERATION_FAILED')
        raise SystemExit(1)
