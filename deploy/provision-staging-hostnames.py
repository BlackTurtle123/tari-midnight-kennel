#!/usr/bin/env python3
"""Add the two game virtual hosts after a complete verified configuration capture."""
import argparse, datetime, hashlib, json, os, pathlib, shutil, stat, subprocess, tarfile

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=pathlib.Path, required=True)
parser.add_argument("--phase", choices=["http", "https"], required=True)
args = parser.parse_args()
if os.geteuid() != 0 or os.uname().nodename != "arkimals-c":
    raise SystemExit("Expected the staging administrator on arkimals-c")
os.umask(0o077)
config = pathlib.Path("/etc/nginx/sites-enabled/arkimals-games-staging.conf")
snippet = pathlib.Path("/etc/nginx/snippets/arkimals-staging-game-proxy.conf")
webroot = pathlib.Path("/var/www/arkimals-acme")
hook = pathlib.Path("/etc/letsencrypt/renewal-hooks/deploy/arkimals-staging-games")
full = (args.source / "staging-hostnames.conf").read_bytes()
proxy = (args.source / "staging-game-proxy.conf").read_bytes()
http = full.split(b"\nserver {\n    listen 443 ssl;", 1)[0] + b"\n"
if b"tari.staging.arkimals-game.com near.staging.arkimals-game.com" not in http:
    raise SystemExit("Unexpected hostname configuration")
if args.phase == "http" and any(p.exists() or p.is_symlink() for p in [config, snippet, webroot, hook]):
    raise SystemExit("A new target already exists; inspect before changing it")
if args.phase == "https" and (config.is_symlink() or config.read_bytes() != http or snippet.read_bytes() != proxy):
    raise SystemExit("Prepared HTTP configuration changed")

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def snapshot(root):
    result = {}
    for p in [root] + sorted(root.rglob("*")):
        s = p.lstat()
        kind = "link" if p.is_symlink() else "directory" if stat.S_ISDIR(s.st_mode) else "file" if stat.S_ISREG(s.st_mode) else None
        if not kind: raise RuntimeError("Unexpected configuration file type")
        result[str(p.relative_to("/"))] = {
            "kind": kind, "mode": stat.S_IMODE(s.st_mode), "uid": s.st_uid, "gid": s.st_gid,
            "mtime_ns": s.st_mtime_ns,
            "xattrs": {k: os.getxattr(p, k, follow_symlinks=False).hex() for k in os.listxattr(p, follow_symlinks=False)},
            "link": os.readlink(p) if kind == "link" else None,
            "sha256": sha(p) if kind == "file" else None,
        }
    return result

roots = [pathlib.Path("/etc/nginx"), pathlib.Path("/etc/letsencrypt")]
if webroot.exists(): roots.append(webroot)
before = {k: v for root in roots for k, v in snapshot(root).items()}
recovery = pathlib.Path("/var/backups/arkimals/dedicated-game-hosts") / datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
recovery.mkdir(parents=True, mode=0o700)
archive = recovery / "configuration-before.tar"
subprocess.run(["tar", "--acls", "--xattrs", "--numeric-owner", "-cpf", str(archive), "-C", "/", *[str(p)[1:] for p in roots]], check=True)
subprocess.run(["tar", "--acls", "--xattrs", "-df", str(archive), "-C", "/"], check=True)
with tarfile.open(archive) as saved:
    members = saved.getmembers()
    if {m.name.rstrip("/") for m in members} != set(before): raise RuntimeError("Recovery count mismatch")
    for m in members:
        record = before[m.name.rstrip("/")]
        if (m.mode, m.uid, m.gid) != (record["mode"], record["uid"], record["gid"]): raise RuntimeError("Recovery metadata mismatch")
        if record["kind"] == "file" and hashlib.sha256(saved.extractfile(m).read()).hexdigest() != record["sha256"]: raise RuntimeError("Recovery content mismatch")
        if record["kind"] == "link" and m.linkname != record["link"]: raise RuntimeError("Recovery link mismatch")
if {k: v for root in roots for k, v in snapshot(root).items()} != before: raise RuntimeError("Configuration drift during capture")
manifest = {"environment": "staging", "host": "217.100.219.253", "phase": args.phase,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "count": len(before),
    "selection": [str(p) for p in roots], "records": before, "archive_sha256": sha(archive),
    "absent_targets": [str(p) for p in [config, snippet, webroot, hook] if not p.exists()],
    "rollback": "Capture later changes first. Restore only affected Nginx/TLS paths from configuration-before.tar with numeric ownership, ACLs and xattrs; remove only the recorded newly-created host files when rolling back HTTP provisioning. Run nginx -t before reloading. Preserve issued certificates and application data until reviewed."}
(recovery / "manifest.json").write_text(json.dumps(manifest, indent=2))
assert json.loads((recovery / "manifest.json").read_text()) == manifest

def create(path, content, mode):
    with path.open("xb") as stream:
        stream.write(content); stream.flush(); os.fsync(stream.fileno())
    os.chmod(path, mode)

if args.phase == "http":
    webroot.mkdir(mode=0o755)
    create(config, http, 0o644)
    create(snippet, proxy, 0o644)
else:
    subprocess.run(["certbot", "certonly", "--non-interactive", "--webroot", "--webroot-path", str(webroot),
        "--cert-name", "arkimals-staging-games", "--keep-until-expiring",
        "-d", "tari.staging.arkimals-game.com", "-d", "near.staging.arkimals-game.com"], check=True)
    # Replace only the file created in phase one, preserving its metadata.
    temporary = config.with_name(".arkimals-games-staging.new")
    if temporary.exists(): raise RuntimeError("Unexpected temporary configuration")
    shutil.copy2(config, temporary)
    old = config.stat()
    temporary.write_bytes(full)
    shutil.copystat(config, temporary); os.chown(temporary, old.st_uid, old.st_gid)
    os.replace(temporary, config)
    create(hook, b"#!/bin/sh\nset -eu\n/usr/sbin/nginx -t\n/usr/bin/systemctl reload nginx\n", 0o755)
subprocess.run(["nginx", "-t"], check=True)
subprocess.run(["systemctl", "reload", "nginx"], check=True)
print(json.dumps({"phase": args.phase, "recovery": str(recovery), "verified_before_image_count": len(before)}))
