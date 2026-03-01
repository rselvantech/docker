# Dockerfile USER + HEALTHCHECK + Port Mapping

## Overview

This demo covers three production-essential Docker concepts using a hardened Nginx container:

- **`USER`** — run the container as a non-root user for security
- **`HEALTHCHECK`** — tell Docker how to verify the container is still working
- **Port Mapping** — expose and publish container ports to the host

**Real-world use case:** A production-ready Nginx web server running as a non-root user on a non-privileged port, with a health check that monitors service availability — standard requirements in any enterprise or cloud deployment.

**What you'll learn:**
- Why containers must not run as root in production
- How to correctly configure Nginx as a non-root user on Alpine
- Health check statuses — `starting` → `healthy` → `unhealthy`
- How to simulate an unhealthy container and observe Docker's response
- `-p` vs `-P` port mapping and when to use each
- `EXPOSE` vs publishing — the difference

---

## Why Non-Root Matters

By default, Docker containers run as `root`. This is dangerous:

```
Default container (root):              Hardened container (non-root):
─────────────────────────              ──────────────────────────────
PID 1: root                            PID 1: nginxuser (UID 1001)
Full filesystem access                 Limited to owned directories only
Can install packages                   Cannot modify system files
Container escape = root on host        Container escape = unprivileged user
Fails PCI-DSS, HIPAA, CIS checks       Passes security compliance checks ✅
```

> **Rule:** Never run production containers as root. Always use the `USER` instruction.

---

## Why Non-Privileged Port (8080)

Linux restricts binding to ports below 1024 to root users only. Since we are running as a non-root user, Nginx must listen on port `8080` instead of `80`:

```
Port 80  → requires root → ❌ permission denied for non-root user
Port 8080 → no root required → ✅ non-root user can bind
```

This is standard practice — the container listens on `8080` internally, and port mapping handles the external port.

---

## Project Structure

```
09-dockerfile-user-healthcheck-ports/
├── src/
│   ├── html/
│   │   └── index.html
│   ├── nginx/
│   │   └── nginx.conf       # listens on 8080, custom pid path
│   ├── .dockerignore
│   ├── Dockerfile
│   └── Dockerfile.unhealthy
└── README.md
```

---

## Application Files

**`src/html/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>USER + HEALTHCHECK Demo</title>
</head>
<body>
  <h1>Nginx - Non-Root User + Health Check Demo</h1>
  <p>This container runs as a non-root user.</p>
  <p>Use <code>docker exec &lt;container&gt; whoami</code> to verify.</p>
</body>
</html>
```

**`src/nginx/nginx.conf`**
```nginx
# pid must be in a directory writable by non-root user
pid /tmp/nginx.pid;

events {}

http {
    server {
        # non-privileged port — required for non-root user
        listen 8080;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ =404;
        }
    }
}
```

### Nginx Configuration — Why These Settings Are Required for Non-Root

| Setting | Reason |
|---|---|
| `pid /tmp/nginx.pid` | Default `/var/run/nginx.pid` is not writable by non-root — moved to `/tmp` |
| `listen 8080` | Ports below 1024 require root — non-root user must use 8080+ |

**`.dockerignore`**
```
*.log
*.tmp
```

---

## Dockerfile

**create a file , Filename :** `src/Dockerfile`

```dockerfile
FROM nginx:alpine

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: USER + HEALTHCHECK + Ports"
LABEL org.opencontainers.image.description="Hardened Nginx with non-root user and health check"

# Install curl — required for HEALTHCHECK command
RUN apk add --no-cache curl

# Create non-root group and user
# -S = system account, -G = assign to group, no login shell, no home dir
RUN addgroup -g 1001 -S nginxgroup && \
    adduser -u 1001 -S -G nginxgroup nginxuser

# Give nginxuser ownership of all directories Nginx needs to write to
RUN chown -R nginxuser:nginxgroup \
      /var/cache/nginx \
      /var/log/nginx \
      /etc/nginx/conf.d \
      /usr/share/nginx/html

# Copy application files
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY html/ /usr/share/nginx/html/

# Switch to non-root user — all instructions after this run as nginxuser
USER nginxuser

# Document that container listens on 8080
# Required for -P (publish-all) to know which ports to map
EXPOSE 8080

# Health check — verify nginx is serving requests
# --interval=30s  : check every 30 seconds
# --timeout=5s    : fail if no response within 5 seconds
# --start-period=5s : wait 5s after container starts before first check
# --retries=3     : mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

## Dockerfile.unhealthy — wrong healthcheck path to simulate unhealthy status

**Create a file. Filename:** `src/Dockerfile.unhealthy`

```dockerfile
FROM nginx:alpine

LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: HEALTHCHECK - Unhealthy simulation"

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S nginxgroup && \
    adduser -u 1001 -S -G nginxgroup nginxuser

RUN chown -R nginxuser:nginxgroup \
      /var/cache/nginx \
      /var/log/nginx \
      /etc/nginx/conf.d \
      /usr/share/nginx/html

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY html/ /usr/share/nginx/html/

USER nginxuser

EXPOSE 8080

# ❌ Wrong port in health check — nginx runs on 8080 but curl checks 9999
# Container runs fine but health check always fails → unhealthy
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9999/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

---

## USER Instruction Explained

```dockerfile
USER nginxuser
```

| Aspect | Meaning |
|---|---|
| Sets default user | All `RUN`, `CMD`, `ENTRYPOINT` after this line run as `nginxuser` |
| Does NOT affect | Instructions before `USER` — those still run as root |
| Pattern | Install packages and set permissions as root, then switch to non-root |

```dockerfile
# ✅ Correct pattern
RUN apk add --no-cache curl          # runs as root — ok, needs root to install
RUN addgroup ... && adduser ...      # runs as root — ok, needs root to create users
RUN chown -R nginxuser ...           # runs as root — ok, needs root to chown
USER nginxuser                       # switch to non-root
CMD ["nginx", "-g", "daemon off;"]  # runs as nginxuser ✅
```

```dockerfile
# ❌ Wrong — switching too early
USER nginxuser
RUN apk add --no-cache curl          # fails — nginxuser cannot install packages
```

---

## HEALTHCHECK Instruction Explained

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1
```

| Option | Value | Meaning |
|---|---|---|
| `--interval` | `30s` | Time between health checks — default 30s |
| `--timeout` | `5s` | Max time allowed for check to complete — default 30s |
| `--start-period` | `5s` | Grace period after container starts — checks during this period count as retries only if they succeed |
| `--retries` | `3` | Consecutive failures before marking `unhealthy` — default 3 |
| `CMD` | `curl -f ...` | Command to run — exit `0` = healthy, non-zero = failure |

**Health check statuses:**
```
Container starts
      │
      ▼
  (starting)     ← status during start-period
      │
      ▼
  (healthy)      ← curl succeeded ✅
      │
      ▼ (if curl fails 3 times in a row)
  (unhealthy)    ← container is running but not serving requests ❌
```

**`HEALTHCHECK NONE`** — disables health check inherited from base image:
```dockerfile
# If base image has a health check you don't want to inherit
HEALTHCHECK NONE
```

---

## Port Mapping Explained

### `EXPOSE` vs Publishing

```
EXPOSE 8080         ← documentation only — tells Docker which port the container uses
                       does NOT make port accessible from host

-p 8080:8080        ← actually publishes — creates firewall rule, accessible from host
-P                  ← publishes ALL EXPOSEd ports to random high-numbered host ports
```

### `-p` — Manual Mapping
```bash
# Syntax: -p <host-port>:<container-port>
docker run -p 8080:8080 ...    # host 8080 → container 8080
docker run -p 9090:8080 ...    # host 9090 → container 8080 (different host port)
docker run -p 80:8080 ...      # host 80   → container 8080
```

### `-P` — Automatic Random Mapping
```bash
docker run -P ...
# Docker picks a random ephemeral host port (e.g. 32768) → container 8080
# Useful when you don't care about the host port
# Requires EXPOSE in Dockerfile to know which ports to map
```

### `docker port` — Inspect Mappings
```bash
docker port <container-name>
# 8080/tcp -> 0.0.0.0:32768
```

---

## Lab Instructions

### Step 1: Create Project Files

Create all files shown in **Application Files** and **Dockerfiles** listed above.

---

### Step 2: Build the Image

```bash
cd 09-dockerfile-user-healthcheck-ports/src

docker build -t nginx-hardened:v1 .
```

---

### Step 3: Verify USER — Before Running

```bash
# Check who the image will run as
docker inspect nginx-hardened:v1 --format '{{.Config.User}}'
```
```
nginxuser
```

---

### Step 4: Run with Manual Port Mapping (`-p`)

```bash
docker run -d -p 8080:8080 --name nginx-hardened nginx-hardened:v1
```

Access in browser: `http://localhost:8080`

---

### Step 5: Verify Non-Root User

```bash
# Check which user is running the nginx process
docker exec nginx-hardened whoami
```
```
nginxuser   ✅ not root
```

```bash
# Verify with process list
docker exec nginx-hardened ps aux
```
```
PID   USER     COMMAND
  1   nginxuser  nginx: master process nginx -g daemon off;
  ...
```

```bash
# Confirm UID
docker exec nginx-hardened id
```
```
uid=1001(nginxuser) gid=1001(nginxgroup) groups=1001(nginxgroup)
```

---

### Step 6: Watch Health Check Status

```bash
# Immediately after run — status will be "starting"
docker ps
```
```
CONTAINER ID   STATUS
abc123         Up 3 seconds (health: starting)
```

```bash
# After start-period (5s) + first successful check — status becomes "healthy"
docker ps
```
```
CONTAINER ID   STATUS
abc123         Up 35 seconds (healthy)
```

---

### Step 7: Inspect Health Check Details

```bash
docker inspect nginx-hardened --format '{{json .State.Health}}' | python3 -m json.tool
```
```json
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2025-01-01T00:00:30Z",
      "End": "2025-01-01T00:00:30Z",
      "ExitCode": 0,
      "Output": "..."
    }
  ]
}
```

The `Log` array shows the last 5 health check results — useful for debugging failures.

---

### Step 8: Simulate Unhealthy Container

Build a second image with a deliberately wrong health check port —
nginx runs fine on 8080 but health check checks 9999 which nothing listens on:
```bash
docker build -f Dockerfile.unhealthy -t nginx-hardened:unhealthy .
docker run -d -p 8082:8080 --name nginx-unhealthy nginx-hardened:unhealthy
```

Watch the status progress — use shorter interval (10s) to see it faster:
```bash
# First ~5 seconds — starting
docker ps
```
```
STATUS
Up 3 seconds (health: starting)
```
```bash
# After 3 consecutive failures (3 x 10s = ~30s) — unhealthy
docker ps
```
```
STATUS
Up 35 seconds (unhealthy)   ❌
```
```bash
# Inspect to see failure details
docker inspect nginx-unhealthy --format '{{json .State.Health}}' | python3 -m json.tool
```
```json
{
  "Status": "unhealthy",
  "FailingStreak": 3,
  "Log": [
    {
      "ExitCode": 7,
      "Output": "curl: (7) Failed to connect to localhost port 9999 after 0 ms: Connection refused"
    }
  ]
}
```
```bash
# But the container itself is perfectly fine — nginx is running
curl http://localhost:8082   # ✅ page loads fine
```

> **Note:** This proves the key point — **unhealthy means the health check failed, not that the container crashed**.
The application can be running fine while Docker considers the container unhealthy.

> **Note:** Docker marks the container `unhealthy` but does NOT automatically restart it. Orchestrators like Docker Swarm and Kubernetes use the health status to restart or replace unhealthy containers automatically.

---

### Step 9: Port Mapping — `-p` vs `-P`

Stop and remove the current container first:
```bash
docker stop nginx-hardened && docker rm nginx-hardened
```

**Manual mapping with `-p`:**
```bash
# Map host port 9090 to container port 8080
docker run -d -p 9090:8080 --name nginx-manual nginx-hardened:v1

docker port nginx-manual
```

**Expected Output**
```
8080/tcp -> 0.0.0.0:9090
```

**Automatic mapping with `-P`:**
```bash
docker stop nginx-manual && docker rm nginx-manual

# -P maps all EXPOSEd ports to random host ports
docker run -d -P --name nginx-auto nginx-hardened:v1

docker port nginx-auto
```

**Expected Output**
```
8080/tcp -> 0.0.0.0:32769   ← random port assigned by Docker
80/tcp -> 0.0.0.0:32768     ← random port assigned by Docker
```

**Why two random ports?**
```bash
Our Dockerfile:          EXPOSE 8080          ← we added this
nginx:alpine base:       EXPOSE 80            ← inherited from base image
                                   
-P publishes both:       80  → 32768
                         8080 → 32769
```

> **Key insight:** `-P` **publishes ALL exposed ports — including those inherited from base images.** Use `-p` when you need precise control over which ports are published.

```bash
# Access using the dynamically assigned port
docker ps   # check the port from PORTS column
curl http://localhost:32769
```

**Multiple `-p` flags — multiple port mappings:**
```bash
docker stop nginx-auto && docker rm nginx-auto

# Map same container port to multiple host ports
docker run -d \
  -p 8080:8080 \
  -p 8081:8080 \
  --name nginx-multi nginx-hardened:v1

# Both host ports reach the same container port
curl http://localhost:8080   # ✅
curl http://localhost:8081   # ✅
```

---

### Step 10: Cleanup

```bash
docker stop nginx-hardened nginx-unhealthy nginx-manual nginx-auto nginx-multi 2>/dev/null
docker rm nginx-hardened nginx-unhealthy nginx-manual nginx-auto nginx-multi 2>/dev/null
docker rmi nginx-hardened:v1 nginx-hardened:unhealthy
```

---

## Key Takeaways

| Concept | Best Practice |
|---|---|
| `USER` | Always switch to non-root before `CMD`/`ENTRYPOINT` |
| Install as root, run as non-root | Install packages and `chown` as root, then `USER` non-root |
| Non-privileged port | Use port 8080+ for non-root nginx — port 80 requires root |
| nginx PID file | Set `pid /tmp/nginx.pid` — non-root cannot write to `/var/run` |
| `HEALTHCHECK` | Always add to production Dockerfiles — enables orchestrator awareness |
| `--start-period` | Set to match your app startup time — prevents false unhealthy status |
| `EXPOSE` | Documents the port — required for `-P` to work |
| `-p` | Use when you need a specific host port |
| `-P` | Use in dev/test when any host port is fine |

> **Security checklist for production Nginx:**
> - ✅ Non-root user with UID > 1000
> - ✅ `chown` all nginx writable directories to non-root user
> - ✅ `pid /tmp/nginx.pid` in nginx.conf
> - ✅ Listen on port 8080 (not 80)
> - ✅ `HEALTHCHECK` defined
> - ✅ `curl` installed for health check command
