#!/usr/bin/env python3
"""One-time host provisioning. Run with approved sudo access; does not start services."""
import argparse, datetime, hashlib, json, os, pathlib, pwd, re, secrets, shutil, stat, subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=pathlib.Path,required=True)
parser.add_argument('--public-key',type=pathlib.Path,required=True)
args=parser.parse_args()
if os.geteuid()!=0: raise SystemExit('Approved staging administrator access is required')
if os.uname().nodename!='arkimals-c': raise SystemExit('Unexpected staging host')
user=pwd.getpwnam('bram')
if user.pw_uid!=1001 or user.pw_gid!=1001: raise SystemExit('Unexpected deployment identity')
root=pathlib.Path('/home/bram/tari-midnight-kennel')
nginx=pathlib.Path('/etc/nginx/sites-enabled/wavesducks-staging.conf')
auth=pathlib.Path('/home/bram/.ssh/authorized_keys')
helper=pathlib.Path('/usr/local/sbin/tari-midnight-kennel-nginx-reload')
sudoers=pathlib.Path('/etc/sudoers.d/tari-midnight-kennel')
for target in [root,helper,sudoers]:
 if target.exists() or target.is_symlink(): raise SystemExit('Target already exists; inspect and capture before updating: '+str(target))
for target in [nginx,auth]:
 if target.is_symlink() or not target.is_file(): raise SystemExit('Unexpected existing target: '+str(target))
public=args.public_key.read_text().strip().split()
if len(public)<2 or public[0]!='ssh-ed25519' or not re.fullmatch(r'[A-Za-z0-9+/]+=*',public[1]):raise SystemExit('Expected an Ed25519 deployment public key')
route=(args.source/'nginx-location.conf').read_text()
original=nginx.read_text()
marker='    include /etc/nginx/snippets/cloudflare-real-ip-staging.conf;'
if original.count(marker)!=1 or 'location ^~ /tari/' in original:raise SystemExit('Unexpected staging proxy layout')
updated=original.replace(marker,marker+'\n'+route,1)
os.umask(0o077)
recovery=pathlib.Path('/var/backups/arkimals/tari-midnight-kennel-bootstrap')/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
recovery.mkdir(parents=True,mode=0o700)
def signature(path):
 s=path.stat()
 return {'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'mtime_ns':s.st_mtime_ns,'xattrs':{key:os.getxattr(path,key).hex() for key in os.listxattr(path)}}
before=[signature(p) for p in [nginx,auth]]
archive=recovery/'before.tar'
subprocess.run(['tar','--acls','--xattrs','--numeric-owner','-cpf',str(archive),'-C','/',str(nginx)[1:],str(auth)[1:]],check=True)
subprocess.run(['tar','--acls','--xattrs','-df',str(archive),'-C','/'],check=True)
if [signature(p) for p in [nginx,auth]]!=before:raise SystemExit('Target drift during capture')
manifest={'environment':'staging','host':'217.100.219.253','captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'targets':before,'target_count':2,'absent_targets':[str(p) for p in [root,helper,sudoers]],'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'rollback':'Capture any later state first. Restore the two original files from before.tar with numeric ownership/ACLs/xattrs, validate nginx and reload via the pipeline; retain wallet/data and newly provisioned files until reviewed.'}
(recovery/'manifest.json').write_text(json.dumps(manifest,indent=2))
assert json.loads((recovery/'manifest.json').read_text())==manifest
for target in [root,root/'data',root/'secrets',root/'releases']:
 target.mkdir(mode=0o700);os.chown(target,user.pw_uid,user.pw_gid)
def new_file(path,contents,mode=0o600,owner=(1001,1001)):
 with path.open('x') as f:f.write(contents)
 os.chmod(path,mode);os.chown(path,*owner)
new_file(root/'secrets/session-key',secrets.token_hex(48)+'\n')
new_file(root/'secrets/wallet.toml','[ootle_wallet_daemon]\noverride_keyring_password = '+json.dumps(list(secrets.token_bytes(32)))+'\n')
new_file(root/'deploy-gateway.py',(args.source/'deploy-gateway.py').read_text(),0o750)
new_file(helper,'#!/bin/sh\nset -eu\n/usr/sbin/nginx -t\n/usr/bin/systemctl reload nginx\n',0o755,(0,0))
new_file(sudoers,'bram ALL=(root) NOPASSWD: /usr/local/sbin/tari-midnight-kennel-nginx-reload\n',0o440,(0,0))
subprocess.run(['visudo','-cf',str(sudoers)],check=True)
def replace_preserving(path,contents):
 temporary=path.with_name('.'+path.name+'.kennel-new')
 if temporary.exists():raise RuntimeError('Unexpected replacement file')
 shutil.copy2(path,temporary)
 old=path.stat()
 temporary.write_text(contents)
 shutil.copystat(path,temporary);os.chown(temporary,old.st_uid,old.st_gid)
 os.replace(temporary,path)
expected_auth=auth.read_text().rstrip()+'\nrestrict,command="'+str(root/'deploy-gateway.py')+'" '+public[0]+' '+public[1]+' midnight-kennel-staging-ci\n'
replace_preserving(auth,expected_auth)
replace_preserving(nginx,updated)
try:subprocess.run(['/usr/sbin/nginx','-t'],check=True)
except Exception:
 replace_preserving(nginx,original)
 raise
for target,old in zip([nginx,auth],before):
 current=signature(target)
 assert all(current[key]==old[key] for key in ['mode','uid','gid','xattrs'])
print(json.dumps({'provisioned':str(root),'before_image':str(recovery),'pipeline_user':'bram','services_started':False,'next':'Enable and run the repository staging pipeline; it activates the route after container health passes.'}))
