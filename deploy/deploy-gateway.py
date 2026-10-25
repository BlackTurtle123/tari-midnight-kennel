#!/usr/bin/env python3
"""Forced SSH command for the dedicated staging pipeline key. Runs as bram."""
import datetime, hashlib, json, os, pathlib, re, stat, subprocess, sys, tarfile, time, urllib.request
ROOT = pathlib.Path('/home/bram/tari-midnight-kennel')
RECOVERY = pathlib.Path('/home/bram/tari-midnight-kennel-recovery')
NAME = 'tari-midnight-kennel-staging'
os.umask(0o077)
def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)
def output(args):
    return subprocess.check_output(args, text=True).strip()
def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()
def snapshot(source):
    paths = [source] + sorted(source.rglob('*'))
    records = {}
    for path in paths:
        info = path.lstat()
        if not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
            raise RuntimeError('Unexpected file type in state directory')
        records[str(path.relative_to(source.parent))] = {
            'type': 'file' if path.is_file() else 'directory',
            'mode': stat.S_IMODE(info.st_mode), 'uid': info.st_uid, 'gid': info.st_gid,
            'mtime_ns': info.st_mtime_ns,
            'xattrs': {name: os.getxattr(path, name).hex() for name in os.listxattr(path)},
            'sha256': digest(path) if path.is_file() else None,
        }
    return records
def archive_verified(source, destination):
    before = snapshot(source)
    run(['tar', '--format=posix', '--acls', '--xattrs', '--numeric-owner', '-czpf', str(destination), '-C', str(source.parent), source.name])
    run(['tar', '--acls', '--xattrs', '-dzf', str(destination), '-C', str(source.parent)], stdout=subprocess.DEVNULL)
    with tarfile.open(destination) as tar:
        members = tar.getmembers()
        if {m.name.rstrip('/') for m in members} != set(before):
            raise RuntimeError('Recovery archive target count mismatch')
        for member in members:
            record = before[member.name.rstrip('/')]
            if (member.mode, member.uid, member.gid) != (record['mode'], record['uid'], record['gid']):
                raise RuntimeError('Recovery archive metadata mismatch')
            if member.isfile() or member.islnk():
                if hashlib.sha256(tar.extractfile(member).read()).hexdigest() != record['sha256']:
                    raise RuntimeError('Recovery archive content mismatch')
    if snapshot(source) != before: raise RuntimeError('State changed during recovery capture')
    return {'target_count': len(before), 'file_count': sum(r['type'] == 'file' for r in before.values()), 'sha256': digest(destination), 'records': before}
command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
match = re.fullmatch(r'deploy ([a-f0-9]{40}) ([a-f0-9]{64})', command)
if not match: raise SystemExit('Only a verified deployment is allowed')
commit, expected = match.groups()
if os.getuid() != 1001 or ROOT.is_symlink(): raise SystemExit('Unexpected deployment identity or target')
release = ROOT / 'releases' / commit
release.mkdir(parents=True, exist_ok=True, mode=0o700)
archive = release / ('payload-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.tar')
with archive.open('xb') as target:
    count = 0
    while chunk := sys.stdin.buffer.read(1024 * 1024):
        count += len(chunk)
        if count > 2_000_000_000: raise RuntimeError('Deployment artifact exceeds size limit')
        target.write(chunk)
if digest(archive) != expected: raise RuntimeError('Artifact integrity mismatch')
with tarfile.open(archive) as tar:
    members = tar.getmembers()
    if sorted(m.name for m in members) != ['compose.yaml', 'image.tar.gz'] or any(not m.isfile() for m in members): raise RuntimeError('Unexpected artifact members')
    for member in members:
        target = release / member.name
        contents = tar.extractfile(member).read()
        if target.exists():
            if target.read_bytes() != contents: raise RuntimeError('Refusing to replace existing release contents')
        else:
            with target.open('xb') as stream: stream.write(contents)
env = {**os.environ, 'KENNEL_VERSION': commit}
compose = ['docker', 'compose', '-p', 'tari-midnight-kennel', '-f', str(release / 'compose.yaml')]
config = json.loads(subprocess.check_output(compose + ['config', '--format', 'json'], env=env, text=True))
service = config['services']['kennel']
if list(config['services']) != ['kennel'] or service['container_name'] != NAME or service['image'] != 'tari-midnight-kennel:' + commit: raise RuntimeError('Unexpected deployment service')
if service['user'] != '1001:1001' or not service['read_only'] or service.get('privileged') or service.get('network_mode') == 'host': raise RuntimeError('Unsafe runtime configuration')
allowed_mounts = {(str(ROOT / 'data'), '/data'), (str(ROOT / 'secrets'), '/run/kennel-secrets')}
if {(m.get('source'), m['target']) for m in service.get('volumes', [])} != allowed_mounts: raise RuntimeError('Unexpected host mounts')
ports = service.get('ports', [])
if len(ports) != 1 or ports[0]['host_ip'] != '127.0.0.1' or str(ports[0]['published']) != '18787' or ports[0]['target'] != 8787: raise RuntimeError('Unexpected published ports')
recovery = RECOVERY / datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
recovery.mkdir(parents=True, mode=0o700)
existing = subprocess.run(['docker', 'inspect', NAME], capture_output=True)
manifest = {'environment': 'staging', 'host': '217.100.219.253', 'container': NAME, 'commit': commit, 'capture_time': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'existing_container_count': 0}
if existing.returncode == 0:
    previous = json.loads(existing.stdout)
    if len(previous) != 1: raise RuntimeError('Unexpected existing container selection')
    manifest['existing_container_count'] = 1
    manifest['previous_image'] = previous[0]['Config']['Image']
    saved = recovery / 'container-before.json'
    saved.write_bytes(existing.stdout)
    if saved.read_bytes() != existing.stdout: raise RuntimeError('Runtime before-image mismatch')
    current = json.loads(output(['docker', 'inspect', NAME]))
    if current[0]['Id'] != previous[0]['Id'] or current[0]['Config'] != previous[0]['Config'] or current[0]['HostConfig'] != previous[0]['HostConfig']:
        raise RuntimeError('Runtime selection changed after capture')
    # Runtime configuration is captured before stopping; stop only this PoC through CI.
    run(['docker', 'stop', '--time', '30', NAME], stdout=subprocess.DEVNULL)
for name in ['data', 'secrets']:
    manifest[name] = archive_verified(ROOT / name, recovery / (name + '.tar.gz'))
manifest['rollback'] = 'Keep all archives. Redeploy previous_image with its original release compose and current data. Restore data/secrets only after separately capturing and reconciling any later writes.'
(recovery / 'manifest.json').write_text(json.dumps(manifest, indent=2))
assert json.loads((recovery / 'manifest.json').read_text()) == manifest
run(['docker', 'load', '--input', str(release / 'image.tar.gz')], stdout=subprocess.DEVNULL)
run(compose + ['up', '-d', '--no-build', '--no-deps', 'kennel'], env=env)
healthy = False
for _ in range(60):
    try:
        with urllib.request.urlopen('http://127.0.0.1:18787/api/health', timeout=3) as response: health = json.load(response)
        if health.get('walletReady') and health.get('version') == commit: healthy = True; break
    except Exception: pass
    time.sleep(2)
if not healthy: raise RuntimeError('PoC did not become healthy; recovery retained at ' + str(recovery))
run(['sudo', '-n', '/usr/local/sbin/tari-midnight-kennel-nginx-reload'])
print(json.dumps({'deployed_commit': commit, 'url': 'https://staging.wavesducks.com/tari/', 'recovery': str(recovery), 'wallet_ready': True}))
