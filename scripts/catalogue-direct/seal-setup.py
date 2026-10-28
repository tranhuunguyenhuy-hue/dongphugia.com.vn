"""Protected-runner pipe transport; output only pinned Environment sealed values."""
import base64
import json
import sys
from nacl.public import PublicKey, SealedBox

def main():
    values=json.load(sys.stdin)
    names={'DIRECT_SOURCE_DATABASE_URL','DIRECT_TARGET_READ_DATABASE_URL','DIRECT_TARGET_IMPORT_DATABASE_URL'}
    assert isinstance(values,dict) and set(values).issubset(names) and len(values) in (1,2)
    box=SealedBox(PublicKey(base64.b64decode('x0l57JCVOgPjnBI6xNZSk2QC+njh3+ttEZI9tvExkAE=')))
    print(json.dumps({'key_id':'3380204578043523366','connections':[
        {'name':name,'encrypted_value':base64.b64encode(box.encrypt(value.encode())).decode()}
        for name,value in values.items()]}))

if __name__=='__main__':
    try:
        main()
    except Exception:
        print('DIRECT_SETUP_SEAL_FAILED',file=sys.stderr)
        raise SystemExit(1)
