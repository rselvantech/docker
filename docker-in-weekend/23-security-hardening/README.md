# Container Security Hardening — Least Privilege in Practice

## Overview

Containers share the host kernel. A misconfigured container can be a direct path to compromising the host. This demo covers the core hardening controls every production Docker deployment should have — non-root user, read-only filesystem, capability restrictions, privilege escalation prevention, and PID limits. These are the same controls required by the **CIS Docker Benchmark**, used in security audits across enterprise environments, and directly map to **Kubernetes Security Contexts** — so these skills transfer immediately.

**What you'll learn:**
- Why root in a container is dangerous — the Linux capability model
- `USER` in Dockerfile — run as non-root, never as root
- `--read-only` filesystem — immutable containers prevent persistence
- `--tmpfs` — writable in-memory paths for runtime needs
- `--cap-drop ALL` + `--cap-add` — Linux capability least privilege
- `--security-opt no-new-privileges` — block privilege escalation
- `--pids-limit` — fork bomb protection
- `docker.sock` risks — why you never mount it in containers
- Hardened Compose service — all controls combined
- `docker inspect` — verify security settings are applied
- How these map to Kubernetes Security Contexts

**Corporate relevance:** These controls appear in every CIS Docker Benchmark audit, SOC 2 review, PCI DSS assessment, and Kubernetes security context configuration. Understanding them is the bridge between Docker and production-grade Kubernetes deployments.

---

## Project Structure

```
23-security-hardening/
├── src/
│   ├── compose.yaml          # insecure baseline vs hardened comparison
│   └── html/
│       └── index.html
└── README.md
```

**Applications:**
- `nginx:alpine` — Nginx web server for practical hardening demonstration
- `alpine` — minimal image for capability and user testing

---

## The Security Threat Model

```
Container isolation layers (outer = weakest, inner = strongest):
────────────────────────────────────────────────────────────────
Host kernel      shared between ALL containers — kernel exploit = host compromise
Namespaces       PID, network, mount, user namespace isolation
cgroups          resource limits
Capabilities     fine-grained root privileges — what this demo focuses on
Seccomp          syscall filtering (Docker default profile)
AppArmor/SELinux mandatory access control (distro-dependent)
Application      your code
```

---

## Concept 1 — Why Root in a Container is Dangerous

By default, containers run as **root (UID 0)** inside the container. This is mapped to root on the host unless user namespaces are configured.

```bash
# Prove it — default container runs as root
docker run --rm alpine id
```
```
uid=0(root) gid=0(root) groups=0(root)   ← running as root ❌
```

**What root in a container can do by default:**

```
✅ Read all files in mounted volumes
✅ Write anywhere in the container filesystem
✅ Modify /proc and /sys entries
✅ If --privileged, mount host filesystems
✅ If docker.sock is mounted, control the entire Docker daemon = host root
```

If an attacker exploits a vulnerability in your application, they land as root. Every barrier after that — capabilities, seccomp, read-only filesystem — is the difference between "they can read a secret" and "they can own the host."

---

## Concept 2 — Linux Capabilities

Linux kernel **capabilities** break down the binary root/non-root model into ~40 fine-grained privileges. Docker grants a default subset — already reduced from full root, but still more than most apps need.

**Default Docker capabilities (the ones granted by default):**

```
CHOWN              change file ownership
DAC_OVERRIDE       bypass file permission checks
FOWNER             bypass permission checks where file UID matches
FSETID             set setuid/setgid bits
KILL               send signals to processes
NET_BIND_SERVICE   bind to ports < 1024
NET_RAW            use raw sockets (used by ping)
SETGID             manipulate group IDs
SETUID             manipulate user IDs
SETPCAP            transfer capabilities
SYS_CHROOT         use chroot()
MKNOD              create special files
AUDIT_WRITE        write to audit log
```

Most applications need **none** of these. The principle of least privilege means: drop all, add back only what is actually required.

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 23-security-hardening/src/html
cd 23-security-hardening/src
```

**`src/html/index.html`**
```html
<!DOCTYPE html>
<html>
  <head><title>Hardened Container Demo</title></head>
  <body><h1>Security Hardening Demo</h1></body>
</html>
```

---

### Step 2: Prove the Default — Running as Root

```bash
# Nginx default — check who the process runs as
docker run -d --name insecure-nginx nginx:alpine
docker exec insecure-nginx id
```
```
uid=0(root) gid=0(root) groups=0(root)   ← root! ❌
```

```bash
# Root can write anywhere in the container filesystem
docker exec insecure-nginx touch /malware-could-be-written-here
echo $?
```
```
0   ← succeeded — root can write anywhere ❌
```

```bash
docker rm -f insecure-nginx
```

---

### Step 3: Non-Root USER — In Dockerfile and at Runtime

**Option A — In the Dockerfile (preferred, permanent):**

```dockerfile
FROM nginx:alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy custom HTML
COPY html/ /usr/share/nginx/html/

# Switch to non-root user
USER appuser
```

> `nginx:alpine` already runs the worker processes as `nginx` user — the master process still needs root to bind port 80 (requires `NET_BIND_SERVICE` capability). For production, use a rootless Nginx image or bind to a port > 1024.

**Option B — At runtime with `-u`:**

```bash
# Override user at runtime
docker run --rm -u 1000:1000 alpine id
```
```
uid=1000 gid=1000 groups=1000   ← non-root ✅
```

```bash
# Run as the nobody user (UID 65534 — exists in most images)
docker run --rm -u nobody alpine id
```
```
uid=65534(nobody) gid=65534(nobody)   ← non-root ✅
```

---

### Step 4: `--read-only` Filesystem

A read-only root filesystem is one of the most powerful hardening controls. If an attacker exploits your application, they cannot write malware, install backdoors, or modify binaries.

```bash
# Read-only filesystem — container cannot write anywhere
docker run --rm --read-only alpine sh -c 'echo test > /tmp/file'
```
```
/bin/sh: can't create /tmp/file: Read-only file system   ← blocked ✅
```

Most applications need some writable paths (temp files, logs, sockets). Use `--tmpfs` for these — writes go to RAM, never to disk, and disappear when the container stops:

```bash
# Read-only root filesystem with writable /tmp and /var/run in memory
docker run --rm \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --tmpfs /var/run:rw,noexec,nosuid,size=8m \
  alpine \
  sh -c 'echo "write to tmpfs" > /tmp/ok && cat /tmp/ok'
```
```
write to tmpfs   ← /tmp is writable via tmpfs ✅
```

**`tmpfs` mount options:**
```
rw        writable (required)
noexec    cannot execute binaries from this path — prevents backdoor execution
nosuid    setuid/setgid bits are ignored — prevents privilege escalation via files
size=64m  maximum size — prevents tmpfs from consuming all RAM
```

---

### Step 5: Linux Capabilities — Drop All, Add Back Minimum

```bash
# Default — NET_RAW capability allows ping (uses raw sockets)
docker run --rm alpine ping -c 1 8.8.8.8
```
```
PING 8.8.8.8 (8.8.8.8): 56 data bytes
64 bytes from 8.8.8.8: seq=0 ttl=119 time=12.3 ms   ← works with default caps
```

```bash
# Drop ALL capabilities — nothing works that requires privileges
docker run --rm --cap-drop ALL alpine ping -c 1 8.8.8.8
```
```
PING 8.8.8.8 (8.8.8.8): 56 data bytes
ping: permission denied (are you root?)   ← capability dropped, ping fails ✅
```

**What just happened:** `ping` requires `NET_RAW` capability to create raw sockets. Dropping all capabilities removed it — even though the process is still running as root inside the container, it has fewer privileges than a regular user.

```bash
# Drop ALL but add back ONLY NET_RAW — ping works but nothing else
docker run --rm \
  --cap-drop ALL \
  --cap-add NET_RAW \
  alpine \
  ping -c 1 8.8.8.8
```
```
64 bytes from 8.8.8.8   ← only NET_RAW granted, nothing more ✅
```

**OWASP recommendation:**

```bash
# Most secure pattern — always start here
--cap-drop ALL          # drop everything
--cap-add <only what app actually needs>

# Common additions per app type:
# Web server binding port 80:  --cap-add NET_BIND_SERVICE
# App that uses chown:         --cap-add CHOWN
# App using ping:              --cap-add NET_RAW
# Most REST APIs:              no caps needed at all
```

---

### Step 6: `--security-opt no-new-privileges`

Even with a non-root user and dropped capabilities, a `setuid` binary inside the container could be used to escalate privileges. `no-new-privileges` blocks this at the kernel level.

```bash
# Without protection — a setuid binary could gain root
docker run --rm alpine \
  sh -c 'ls -la /bin/su'
```
```
-rwsr-xr-x    1 root     root    /bin/su   ← setuid bit set, could be abused
```

```bash
# With no-new-privileges — setuid binaries cannot escalate
docker run --rm \
  --security-opt no-new-privileges \
  -u 1000 \
  alpine \
  su root
```
```
su: you must be root or setuid root to run su   ← blocked ✅
```

Always add `--security-opt no-new-privileges` to every production container. It costs nothing and closes a real attack vector.

---

### Step 7: The `docker.sock` Risk

`/var/run/docker.sock` is the Unix socket the Docker daemon listens on. Mounting it into a container gives that container **full control of the Docker daemon** — equivalent to unrestricted root access to the host.

```bash
# DO NOT DO THIS IN PRODUCTION — demonstration only
# This container can now control your entire Docker host:
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  alpine sh
```

Inside the container with the socket mounted:

```bash
# Install docker CLI inside the container
apk add docker-cli

# Now this container can do anything to the host:
docker ps              # list all containers on host
docker images          # list all images on host
docker run -v /:/host  # mount entire host filesystem!
```

**You have just given this container root access to your host.** If an attacker exploits the application running in this container, they own the host.

```
Never mount docker.sock in containers unless:
  - It is a CI/CD agent (Jenkins, GitLab Runner) that specifically needs it
  - The container is trusted, isolated, and the risk is accepted
  - You have no alternative (e.g., building images inside containers)

Alternatives:
  - Use Docker-in-Docker with explicit isolation
  - Use BuildKit with the docker-container driver (Demo 19)
  - Use Kaniko or Buildah for rootless container builds in CI
```

---

### Step 8: Hardened Compose — All Controls Combined

**`src/compose.yaml`**

```yaml
name: hardeneddemo

services:

  # ── INSECURE baseline (typical default deployment) ──────────────────────────
  insecure-web:
    image: nginx:alpine
    container_name: hardeneddemo-insecure
    ports:
      - "8080:80"
    # No user restriction  → runs as root
    # No read-only fs      → can write anywhere
    # No cap restrictions  → full default cap set
    # No no-new-privileges → setuid escalation possible
    # No resource limits   → noisy neighbour risk

  # ── HARDENED production-ready deployment ────────────────────────────────────
  secure-web:
    image: nginx:alpine
    container_name: hardeneddemo-secure
    ports:
      - "8443:8080"

    # 1. Non-root user
    user: "101:101"            # nginx user UID in nginx:alpine

    # 2. Read-only root filesystem
    read_only: true

    # 3. Writable tmpfs for runtime needs (nginx requires these paths)
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=32m
      - /var/run:rw,noexec,nosuid,size=8m
      - /var/cache/nginx:rw,noexec,nosuid,size=32m

    # 4. Capability least privilege
    cap_drop:
      - ALL                    # drop everything first
    cap_add:
      - NET_BIND_SERVICE       # add back only what nginx needs to bind port 80
      - CHOWN                  # nginx needs to chown some files on startup
      - SETUID                 # nginx needs to set UID for worker processes
      - SETGID                 # nginx needs to set GID for worker processes

    # 5. Block privilege escalation via setuid binaries
    security_opt:
      - no-new-privileges:true

    # 6. Resource limits — prevent noisy neighbour
    deploy:
      resources:
        limits:
          cpus: "0.50"
          memory: 64M
        reservations:
          cpus: "0.25"
          memory: 32M

    # 7. PID limit — fork bomb protection
    # pids_limit: 50           # uncomment in production

    restart: unless-stopped

    volumes:
      - ./html:/usr/share/nginx/html:ro   # mount html as read-only
```

```bash
docker compose up -d
```
```
[+] Running 3/3
 ✔ Network hardeneddemo_default     Created
 ✔ Container hardeneddemo-insecure  Started
 ✔ Container hardeneddemo-secure    Started
```

```bash
# Verify both are serving
curl http://localhost:8080    # insecure
curl http://localhost:8443    # hardened
```

---

### Step 9: Verify Hardening with `docker inspect`

```bash
# Compare security settings — insecure vs hardened

echo "=== INSECURE ==="
docker inspect hardeneddemo-insecure --format='
User:           {{.Config.User}}
ReadonlyRootfs: {{.HostConfig.ReadonlyRootfs}}
CapDrop:        {{.HostConfig.CapDrop}}
CapAdd:         {{.HostConfig.CapAdd}}
SecurityOpt:    {{.HostConfig.SecurityOpt}}'
```
```
User:
ReadonlyRootfs: false
CapDrop:        []
CapAdd:         []
SecurityOpt:    []
```

```bash
echo "=== HARDENED ==="
docker inspect hardeneddemo-secure --format='
User:           {{.Config.User}}
ReadonlyRootfs: {{.HostConfig.ReadonlyRootfs}}
CapDrop:        {{.HostConfig.CapDrop}}
CapAdd:         {{.HostConfig.CapAdd}}
SecurityOpt:    {{.HostConfig.SecurityOpt}}'
```
```
User:           101:101
ReadonlyRootfs: true
CapDrop:        [ALL]
CapAdd:         [NET_BIND_SERVICE CHOWN SETUID SETGID]
SecurityOpt:    [no-new-privileges:true]
```

---

### Step 10: Prove Hardening Works

```bash
# Try to write to the container filesystem — should fail
docker exec hardeneddemo-secure touch /malware
```
```
touch: /malware: Read-only file system   ← blocked by read-only ✅
```

```bash
# Try to write to tmpfs — should succeed (runtime need)
docker exec hardeneddemo-secure touch /tmp/ok
echo $?
```
```
0   ← tmpfs write works ✅
```

```bash
# Check process user inside hardened container
docker exec hardeneddemo-secure id
```
```
uid=101(nginx) gid=101(nginx)   ← non-root ✅
```

```bash
# Verify capabilities are restricted
docker exec hardeneddemo-secure cat /proc/self/status | grep CapEff
```
```
CapEff: 00000000a80435fb   ← reduced capability set, not full root ✅
```

```bash
docker compose down
```

---

## Security Layers Summary

```
Layer                  Control                   Flag / Config
──────────────────────────────────────────────────────────────────────────────
Identity               Non-root user             USER in Dockerfile / -u flag
Filesystem             Read-only root FS         --read-only / read_only: true
Filesystem             Writable runtime paths    --tmpfs / tmpfs: in compose
Capabilities           Drop all, add minimum     --cap-drop ALL --cap-add <n>
Privilege escalation   Block setuid escalation   --security-opt no-new-privileges
Process limit          Fork bomb protection      --pids-limit / pids_limit:
Resources              CPU/memory limits         --memory --cpus / deploy.resources
Socket                 Never mount docker.sock   — (omit entirely)
```

---

## Kubernetes Security Context — Direct Mapping

These Docker controls map directly to Kubernetes `securityContext` — the same concepts, different syntax:

```yaml
# Kubernetes equivalent of all the above Docker hardening
securityContext:
  runAsNonRoot: true              # equivalent to USER non-root
  runAsUser: 101                  # equivalent to -u 101
  readOnlyRootFilesystem: true    # equivalent to --read-only
  allowPrivilegeEscalation: false # equivalent to --security-opt no-new-privileges
  capabilities:
    drop: ["ALL"]                 # equivalent to --cap-drop ALL
    add: ["NET_BIND_SERVICE"]     # equivalent to --cap-add NET_BIND_SERVICE
  seccompProfile:
    type: RuntimeDefault          # equivalent to default Docker seccomp
```

**Learning these Docker controls is direct preparation for Kubernetes security context configuration.**

---

## CIS Docker Benchmark Checklist

The Center for Internet Security (CIS) Docker Benchmark is the industry standard security audit framework. These are the key items covered in this demo:

```
CIS 4.1   ✅  Ensure container images are not run as root
CIS 4.5   ✅  Ensure COPY is used instead of ADD (avoid remote URL risks)
CIS 5.1   ✅  Ensure AppArmor profile applied (Docker default profile active)
CIS 5.3   ✅  Restrict Linux Kernel Capabilities within containers
CIS 5.4   ✅  Do not use privileged containers
CIS 5.7   ✅  Do not map privileged ports within containers
CIS 5.8   ✅  Use only needed ports
CIS 5.10  ✅  Do not use host network namespace
CIS 5.12  ✅  Mount container's root filesystem as read-only
CIS 5.14  ✅  Bind incoming container traffic to a specific host interface
CIS 5.25  ✅  Restrict container from acquiring additional privileges
CIS 5.28  ✅  Use PIDs cgroup limit
```

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| Default = root | Containers run as root by default — always override this |
| `USER` in Dockerfile | Best place to set non-root — permanent, not forgettable |
| `-u` at runtime | Override user without rebuilding — useful for debugging |
| `--read-only` | Root filesystem immutable — attackers cannot persist |
| `--tmpfs` | Writable in-memory paths for runtime needs — never persisted |
| `--cap-drop ALL` | Start with zero capabilities — safer than the Docker default |
| `--cap-add <n>` | Add back only what the app actually needs |
| `no-new-privileges` | Block setuid/setgid escalation — always enable this |
| `docker.sock` | Never mount in production containers — equivalent to root on host |
| `docker inspect` | Verify security settings are actually applied |
| CIS Docker Benchmark | Industry standard audit checklist — all major cloud providers require it |
| K8s Security Context | Direct mapping — same concepts, same skills |