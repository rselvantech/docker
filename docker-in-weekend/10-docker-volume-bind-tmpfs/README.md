# Docker Storage — Volumes, Bind Mounts and TMPFS

## Overview

This demo covers Docker storage in a real-world Nginx production context across four scenarios — each demonstrating a distinct and important storage concept.

**Real-world use case:** Nginx as a production web server — a natural fit for all four storage scenarios:
1. **Named volume** — persist Nginx access/error logs across container replacements
2. **Bind mount** — live nginx.conf reload without rebuilding the image
3. **TMPFS** — high-speed in-memory cache for temporary Nginx files
4. **Non-empty directory behavior** — the critical difference between volume and bind mount when container already has files at the mount path

**What you'll learn:**
- Named volume persistence — data survives container stop, removal and replacement
- Bind mount for live config management — SRE/DevOps workflow
- TMPFS mount — ephemeral RAM-backed storage, never written to disk
- Volume preserves existing container data vs bind mount overwrites it — the most important production gotcha

---

## Docker Storage Types — Quick Reference

```
Named Volume                Bind Mount                  TMPFS
────────────────            ────────────────────        ──────────────────────
Managed by Docker           Host filesystem path        Host memory (RAM)
/var/lib/docker/volumes/    Any directory on host       No disk, no host path
Persists after container    Persists on host            Gone when container stops
Survives docker rm          Survives docker rm          Lost on container stop
Portable                    Host-path dependent         Linux only
Best for: databases, logs   Best for: config, dev code  Best for: cache, secrets
```

---

## Project Structure

```
10-docker-volume-bind-tmpfs/
├── src/
│   ├── static-content/          # files baked into image
│   │   ├── file1.html
│   │   ├── file2.html
│   │   └── file3.html
│   ├── html/
│   │   └── index.html           # main page
│   ├── nginx/
│   │   └── nginx.conf           # initial nginx config
│   ├── .dockerignore
│   └── Dockerfile
└── README.md
```

---

## Application Files

**`src/html/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head><title>Docker Storage Demo</title></head>
<body>
  <h1>Docker Storage Demo</h1>
  <p>This page demonstrates Docker storage scenarios with Nginx.</p>
</body>
</html>
```

**`src/static-content/file1.html`**
```html
<h1>File 1 — Baked into Docker image</h1>
```

**`src/static-content/file2.html`**
```html
<h1>File 2 — Baked into Docker image</h1>
```

**`src/static-content/file3.html`**
```html
<h1>File 3 — Baked into Docker image</h1>
```

**`src/nginx/nginx.conf`**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Access and error logs — will be stored in named volume
    access_log /var/log/nginx/access.log;
    error_log  /var/log/nginx/error.log;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

**`src/.dockerignore`**
```
*.log
*.tmp
```

---

## Dockerfile

```dockerfile
FROM nginx:alpine-slim

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: Docker Storage"
LABEL org.opencontainers.image.description="Nginx storage demo — volumes, bind mounts, tmpfs"

# Remove symlinks to /dev/stdout and /dev/stderr
# Create real log files so named volume has actual content to persist
# Without this, access.log and error.log are symlinks — cat hangs, volume has nothing to persist
RUN unlink /var/log/nginx/access.log && \
    unlink /var/log/nginx/error.log && \
    touch /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy html content
COPY html/ /usr/share/nginx/html/

# Copy static content — used for non-empty dir behavior demo
COPY static-content/ /usr/share/nginx/html/static/

EXPOSE 80
```

> **Why unlink the log symlinks?** The official `nginx:alpine-slim` image ships with
> `access.log` and `error.log` as symlinks pointing to `/dev/stdout` and `/dev/stderr`.
> This is by design for Docker log capture via `docker logs`. However for this demo we
> need real log files so the named volume has actual content to persist.
> See [Scenario 1 — Why We Override the Log Symlinks](#scenario-1--named-volume-persistent-nginx-logs) for full explanation.

---

## Build the Image

```bash
cd 10-docker-volume-bind-tmpfs/src

docker build -t nginx-storage:v1 .
```

Verify the image is created:
```bash
docker images | grep nginx-storage
```
```
nginx-storage   v1   abc123   1 minute ago   18.2MB
```

---

## Scenario 1 — Named Volume: Persistent Nginx Logs

**Real-world use case:** In production, when a container crashes or is replaced with a new version, all logs are lost if stored only in the container filesystem. Named volumes ensure logs persist across the entire container lifecycle.

```
Container filesystem (ephemeral)     Named Volume (persistent)
────────────────────────────────     ──────────────────────────
/var/log/nginx/access.log  ──────►  nginx-logs volume
/var/log/nginx/error.log   ──────►  (survives docker rm)
```

### Why We Override the Log Symlinks

In the official `nginx:alpine-slim` image, log files are **symlinks** pointing to Docker's standard streams:

```bash
# Default nginx image log files
/var/log/nginx/access.log -> /dev/stdout
/var/log/nginx/error.log  -> /dev/stderr
```

This is intentional — it routes all logs to `docker logs` so Docker can capture them centrally. However for this demo we need **real log files** so the named volume has actual content to persist.

`cat /dev/stdout` blocks forever waiting for input — which is why reading the log hangs without this fix.

| Without fix | With fix |
|---|---|
| `access.log → /dev/stdout` | `access.log` — real file |
| `cat` hangs — reads from stdout stream | `cat` works — reads file content |
| Volume has nothing real to persist | Volume persists actual log entries |
| Must use `docker logs` to see logs | `cat`, `tail -f`, `grep` all work |

> **Note:** After this change, logs are no longer forwarded to `docker logs`. Use
> `docker exec <container> cat /var/log/nginx/access.log` to view them directly,
> or `docker exec <container> tail -f /var/log/nginx/access.log` to follow live.

---

### Step 1: Create Named Volume and Run Container

```bash
# Do NOT pre-create the volume — let docker run create it

# Run container mounting the volume at nginx log directory
# --mount syntax (preferred)
docker run -d \
  --name nginx-logs-demo \
  -p 8080:80 \
  --mount type=volume,source=nginx-logs,target=/var/log/nginx \
  nginx-storage:v1

# -v syntax (alternative)
docker run -d \
  --name nginx-logs-demo \
  -p 8080:80 \
  -v nginx-logs:/var/log/nginx \
  nginx-storage:v1
```

### Step 2: Generate Some Log Entries

```bash
# Make a few requests to generate access logs
curl http://localhost:8080
curl http://localhost:8080/index.html
curl http://localhost:8080/nonexistent   # generates a 404 log entry
```

### Step 3: Verify Logs Are in the Volume

```bash
# View logs from inside the container
docker exec nginx-logs-demo cat /var/log/nginx/access.log
```
```
172.17.0.1 - - [01/Jan/2025:00:00:01 +0000] "GET / HTTP/1.1" 200 ...
172.17.0.1 - - [01/Jan/2025:00:00:02 +0000] "GET /index.html HTTP/1.1" 200 ...
172.17.0.1 - - [01/Jan/2025:00:00:03 +0000] "GET /nonexistent HTTP/1.1" 404 ...
```

### Step 4: Prove Logs Persist After Container Removal

```bash
# Remove the container completely
docker rm -f nginx-logs-demo

# Verify volume still exists
docker volume ls | grep nginx-logs
```
```
local     nginx-logs   ← volume still present after container removed ✅
```

```bash
# Create a NEW container mounting the same volume
docker run -d \
  --name nginx-logs-demo-v2 \
  -p 8080:80 \
  --mount type=volume,source=nginx-logs,target=/var/log/nginx \
  nginx-storage:v1

# Old logs are still there in the new container
docker exec nginx-logs-demo-v2 cat /var/log/nginx/access.log
```
```
172.17.0.1 - - [01/Jan/2025:00:00:01 +0000] "GET / HTTP/1.1" 200 ...   ← from old container ✅
172.17.0.1 - - [01/Jan/2025:00:00:02 +0000] "GET /index.html HTTP/1.1" 200 ...
```

Logs from the original container are available in the replacement container — this is exactly how production log persistence works.

### Step 5: Inspect the Volume

```bash
docker volume inspect nginx-logs
```
```json
[
  {
    "Name": "nginx-logs",
    "Driver": "local",
    "Mountpoint": "/var/lib/docker/volumes/nginx-logs/_data",
    "Labels": {},
    "Scope": "local"
  }
]
```

```bash
# Clean up
docker rm -f nginx-logs-demo-v2
```

---

## Scenario 2 — Bind Mount: Live Config Reload

**Real-world use case:** SREs and DevOps engineers often need to tweak Nginx config (add rate limiting, change caching headers, update upstream backends) without rebuilding the Docker image. Bind mounting the config file from host allows editing it on the host and reloading Nginx inside the container — no rebuild, no downtime.

```
Host filesystem                    Container filesystem
────────────────                   ────────────────────
./nginx/nginx.conf  ──bind──────►  /etc/nginx/conf.d/default.conf
(edit on host)                     (nginx reads this)
                                        │
                                        ▼
                                   nginx -s reload   ← picks up changes instantly
```

### Step 1: Run Container with Bind Mounted Config

```bash
# -v syntax
docker run -d \
  --name nginx-config-demo \
  -p 8080:80 \
  -v $(pwd)/nginx/nginx.conf:/etc/nginx/conf.d/default.conf \
  nginx-storage:v1

# --mount syntax (preferred — more explicit)
docker run -d \
  --name nginx-config-demo \
  -p 8080:80 \
  --mount type=bind,source=$(pwd)/nginx/nginx.conf,target=/etc/nginx/conf.d/default.conf \
  nginx-storage:v1
```

### Step 2: Verify Current Config is Active

```bash
curl -I http://localhost:8080
```
```
HTTP/1.1 200 OK
Server: nginx/...
```

### Step 3: Edit Config on Host — Add a Custom Header

Edit `nginx/nginx.conf` on your host — add `add_header` inside the `server` block:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    access_log /var/log/nginx/access.log;
    error_log  /var/log/nginx/error.log;

    # New line added
    add_header X-Demo-Header "live-reload-works";

    location / {
        try_files $uri $uri/ =404;
    }
}
```

### Step 4: Reload Nginx — No Rebuild, No Restart

```bash
# Validate config syntax first
docker exec nginx-config-demo nginx -t
```
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

```bash
# Reload nginx — picks up new config with zero downtime
docker exec nginx-config-demo nginx -s reload
```

### Step 5: Verify New Header is Active

```bash
curl -I http://localhost:8080
```
```
HTTP/1.1 200 OK
X-Demo-Header: live-reload-works   ← new header active without rebuild ✅
```

> **Key insight:** The config file on the host and inside the container are the **same file** — not a copy. Changes on the host are immediately visible inside the container. This is the bind mount difference from `COPY` in a Dockerfile.

```bash
# Clean up
docker rm -f nginx-config-demo
```

---

## Scenario 3 — TMPFS: High-Speed In-Memory Cache

**Real-world use case:** Nginx writes temporary files during request processing (client body temp, proxy temp, etc.). Storing these in TMPFS (RAM) instead of disk gives faster I/O and ensures sensitive temporary request data is never written to disk — important for compliance.

```
Without TMPFS:           With TMPFS:
──────────────           ────────────
/tmp/nginx/cache  ──►   disk I/O (slow)
                         data persists on disk (security risk)

/tmp/nginx/cache  ──►   RAM (fast)
                         data gone when container stops (secure) ✅
```

> **Important:** TMPFS is only available on Linux hosts. It will not work on Docker Desktop (Mac/Windows) as those use a Linux VM, so behavior may differ.

### Step 1: Run Container with TMPFS Mount

```bash
# --mount syntax (required for size/mode options)
docker run -d \
  --name nginx-tmpfs-demo \
  -p 8080:80 \
  --mount type=tmpfs,destination=/tmp/nginx-cache,tmpfs-size=100m \
  nginx-storage:v1

# --tmpfs syntax (simpler but no size/mode options)
docker run -d \
  --name nginx-tmpfs-demo \
  -p 8080:80 \
  --tmpfs /tmp/nginx-cache \
  nginx-storage:v1
```

### Step 2: Verify TMPFS Mount

```bash
docker inspect nginx-tmpfs-demo --format '{{json .Mounts}}' | python3 -m json.tool
```
```json
[
  {
    "Type": "tmpfs",
    "Source": "",
    "Destination": "/tmp/nginx-cache",
    "Mode": "",
    "RW": true
  }
]
```

Note: `Source` is empty — TMPFS has no source path on the host filesystem.

### Step 3: Write Files to TMPFS and Verify Ephemeral Behavior

```bash
# Write a file to the tmpfs mount
docker exec nginx-tmpfs-demo sh -c "echo 'cache data' > /tmp/nginx-cache/test.txt"

# Verify the file exists
docker exec nginx-tmpfs-demo cat /tmp/nginx-cache/test.txt
```
```
cache data   ✅
```

```bash
# Stop the container
docker stop nginx-tmpfs-demo

# Start it again
docker start nginx-tmpfs-demo

# File is gone — tmpfs data does not survive container stop
docker exec nginx-tmpfs-demo cat /tmp/nginx-cache/test.txt
```
```
cat: can't open '/tmp/nginx-cache/test.txt': No such file or directory   ✅ gone
```

> **TMPFS vs Volume vs Bind Mount on stop/start:**
> ```
> Named Volume  → data persists after stop and start ✅
> Bind Mount    → data persists (it's on host disk) ✅
> TMPFS         → data gone after container stop ❌ (by design)
> ```

```bash
# Clean up
docker rm -f nginx-tmpfs-demo
```

---

## Scenario 4 — Non-Empty Directory: Volume Preserves, Bind Mount Overwrites

**Real-world use case:** This is the most critical storage gotcha in production. When you mount storage at a path that already has files inside the container (non-empty directory), the behavior is completely different depending on the mount type.

The Docker image in this demo has static files baked into `/usr/share/nginx/html/static/`:
```
/usr/share/nginx/html/static/   ← inside Docker image
├── file1.html
├── file2.html
└── file3.html
```

The host has only one file:
```
./local-content/   ← on host machine
└── local.html
```

### Part A — Volume Mounts Preserve Existing Container Data

```bash
# Run with a NEW named volume at the path that already has files
docker run -d \
  --name nginx-volume-nonempty \
  -p 8080:80 \
  --mount type=volume,source=nginx-static-vol,target=/usr/share/nginx/html/static \
  nginx-storage:v1
```

```bash
# Check what files are in the mounted path
docker exec nginx-volume-nonempty ls /usr/share/nginx/html/static/
```
```
file1.html   file2.html   file3.html   ← ALL original files preserved ✅
```

**Why?** On first use of a new volume at a non-empty directory, Docker **copies the existing container files into the volume**. The volume now contains the original data.

```bash
# Prove it — inspect volume contents on host
docker volume inspect nginx-static-vol --format '{{.Mountpoint}}'
# Output: /var/lib/docker/volumes/nginx-static-vol/_data
sudo ls /var/lib/docker/volumes/nginx-static-vol/_data
```
```
file1.html   file2.html   file3.html   ← copied from container into volume ✅
```

```bash
# Access files via browser/curl
curl http://localhost:8080/static/file1.html   # ✅ works
```

```bash
# Clean up
docker rm -f nginx-volume-nonempty
```

### Part B — Bind Mount Overwrites Existing Container Data

First create the local content directory:
```bash
mkdir -p local-content
echo "<h1>Local File from Host</h1>" > local-content/local.html
```

```bash
# Run with bind mount at the SAME path that has files in the image
docker run -d \
  --name nginx-bind-nonempty \
  -p 8081:80 \
  --mount type=bind,source=$(pwd)/local-content,target=/usr/share/nginx/html/static \
  nginx-storage:v1
```

```bash
# Check what files are in the mounted path
docker exec nginx-bind-nonempty ls /usr/share/nginx/html/static/
```
```
local.html   ← ONLY host file visible — image files are gone ❌
```

**Why?** Bind mount **overlays** the container path with the host path. The original `file1.html`, `file2.html`, `file3.html` from the image are hidden (obscured) — not deleted, but inaccessible while the bind mount is active.

```bash
# Image files are obscured
curl http://localhost:8080/static/file1.html   # 404 ❌ hidden by bind mount
curl http://localhost:8081/static/local.html   # 200 ✅ host file visible
```

```bash
# Clean up
docker rm -f nginx-bind-nonempty
```

### Summary — Volume vs Bind Mount Behavior

#### Named Volume — All Scenarios
```
Scenario 1 — Volume does not exist (created implicitly by docker run):
Image has:   file1, file2, file3
Volume has:  does not exist
Result:      file1, file2, file3  ← Docker creates volume + copies image files ✅

Scenario 2 — Volume pre-created empty (docker volume create):
Image has:   file1, file2, file3
Volume has:  empty (manually pre-created)
Result:      empty  ← volume wins, image files NOT copied, NOT visible ❌

Scenario 3 — Volume has existing files from previous container:
Image has:   file1, file2, file3
Volume has:  old-file1, old-file2
Result:      old-file1, old-file2  ← volume wins, image files NOT visible ❌

Scenario 4 — Volume has overlapping filenames:
Image has:   file1 (v1 content), file2, file3
Volume has:  file1 (old content), old-file
Result:      file1 (old content), old-file  ← volume wins entirely ❌
             file2, file3 from image are NOT visible
```

> **Rule:** Docker copies image files into a volume **only when the volume does not exist and is created implicitly by `docker run`**. Any pre-existing volume — empty or not — always wins over image content.

---

#### Bind Mount — All Scenarios
```
Scenario 1 — Host directory has files:
Image has:   file1, file2, file3
Host has:    local1, local2
Result:      local1, local2  ← host wins, image files hidden ❌

Scenario 2 — Host directory is empty:
Image has:   file1, file2, file3
Host has:    empty directory
Result:      empty  ← host wins, image files hidden ❌

Scenario 3 — Host directory has overlapping filenames:
Image has:   file1 (v1 content), file2, file3
Host has:    file1 (different content), local1
Result:      file1 (host version), local1  ← host wins entirely ❌
             file2, file3 from image NOT visible

Scenario 4 — Host path does not exist:
Image has:   file1, file2, file3
Host has:    path does not exist

With -v flag:
Result:      Docker creates empty directory on host automatically
             empty directory mounted → image files hidden ❌

With --mount flag:
Result:      Docker fails immediately with error ❌
             "bind source path does not exist: /your/path"
             Container never starts — fail fast behavior ✅
```

> **Rule:** Bind mount always wins — unconditionally, regardless of host directory state.
> No copy-on-first-use behavior ever.

---

#### Complete Comparison Table

| State | Named Volume | Bind Mount `-v` | Bind Mount `--mount` |
|---|---|---|---|
| **Does not exist** | ✅ Creates + copies image files | ⚠️ Creates empty dir — image files hidden | ❌ Fails with error — fail fast |
| **Empty** | ❌ Mounts empty — image files hidden | ❌ Mounts empty — image files hidden | ❌ Mounts empty — image files hidden |
| **Has existing files** | ❌ Volume files win — image files hidden | ❌ Host files win — image files hidden | ❌ Host files win — image files hidden |
| **Overlapping filenames** | ❌ Volume version wins | ❌ Host version wins | ❌ Host version wins |

> **Why `--mount` is preferred over `-v`:**
> When the host path does not exist, `-v` silently creates an empty directory which hides
> your image files without any warning — a hard to debug surprise. `--mount` fails immediately
> with a clear error, helping you catch mistakes before the container ever starts.

> **Production warning:** Only one scenario ever exposes image files through a volume mount —
> a named volume that does not yet exist, created implicitly by `docker run`. In all other
> cases the mount always wins over image content.

---

## Final Cleanup

```bash
docker rm -f nginx-logs-demo nginx-logs-demo-v2 nginx-config-demo nginx-tmpfs-demo nginx-volume-nonempty nginx-bind-nonempty 2>/dev/null
docker volume rm nginx-logs nginx-static-vol 2>/dev/null
docker rmi nginx-storage:v1 2>/dev/null
```

---

## Key Takeaways

### Storage Type Comparison

| Scenario | Mount Type | Persists after stop? | Persists after rm? | Non-empty dir behavior |
|---|---|---|---|---|
| Log persistence | Named Volume | ✅ Yes | ✅ Yes | Copies image files into volume (first use only) |
| Live config reload | Bind Mount | ✅ Yes (on host) | ✅ Yes (on host) | Always overwrites image files |
| Temp cache | TMPFS | ❌ No | ❌ No | Overwrites image files |

---

### `-v` vs `--mount` Syntax

| | `-v` | `--mount` |
|---|---|---|
| **Syntax** | `-v source:target[:options]` | `--mount type=...,source=...,target=...` |
| **Readability** | Compact | Verbose and explicit |
| **Recommended** | Legacy / quick use | ✅ Preferred — official recommendation |
| **TMPFS options** | Not supported | `tmpfs-size`, `tmpfs-mode` |
| **Host path missing** | ⚠️ Silently creates empty dir | ❌ Fails immediately with clear error |

---

### Volume Copy-on-First-Use Rule

| Volume state | Docker behavior |
|---|---|
| Does not exist (implicit creation) | ✅ Creates volume + copies image files |
| Pre-created empty (`docker volume create`) | ❌ Mounts empty — image files NOT copied |
| Has existing files | ❌ Volume data wins — image files hidden |

> **Only one scenario copies image files into a volume — when `docker run` creates it implicitly. Any pre-existing volume always wins.**

---

### Official Nginx Image Log Symlinks

The official `nginx` image ships `access.log` and `error.log` as symlinks to `/dev/stdout` and `/dev/stderr`. When using a named volume for log persistence:
- Must `unlink` and recreate as real files in the Dockerfile
- Otherwise volume mounts empty symlinks — `cat` hangs, nothing to persist
- After unlinking, use `docker exec <container> tail -f /var/log/nginx/access.log` — logs no longer appear in `docker logs`

---

> **Best Practices:**
> - Use `--mount` over `-v` — explicit, fails fast, no silent surprises
> - Never pre-create a volume with `docker volume create` if you need image files seeded into it — let `docker run` create it implicitly
> - Always name your volumes — never rely on anonymous volumes in production
> - Use TMPFS for sensitive temporary data — never written to disk
> - Before using a bind mount, always verify what files exist at that path in the image
> - Use named volumes for databases and logs — bind mounts for config and dev code