# Docker Compose Profiles — Selective Service Activation

## Overview

By default every service in `compose.yaml` starts when you run `docker compose up`. Profiles let you assign services to named groups so they only start when explicitly activated. This is ideal for optional services like debug tools, test runners, or admin UIs that should not start in normal operation.

**What you'll learn:**
- `profiles:` key — assign a service to one or more profiles
- Default services vs profile-assigned services
- `docker compose --profile <name> up` — activate a profile
- `docker compose --profile <name> down` — stop profile services
- Profile services are not removed by `docker compose down` alone
- Real use case — on-demand debug container (`nicolaka/netshoot`)

---

## Project Structure

```
14-docker-compose-profiles/
├── src/
│   └── compose.yaml
└── README.md
```

---

## `profiles:` vs `docker compose start/stop`

A service can be started and stopped individually without profiles:
```bash
docker compose stop netshoot    # stop a running service
docker compose start netshoot   # start it again
```

So why use profiles at all? The difference is **lifecycle**, not just running state.
```
docker compose start/stop <service>     profiles
────────────────────────────────────    ────────────────────────────────────
Operates on already-created services    Controls whether a service is created
                                        at all

Service must exist first                Service does not exist until profile
(container already created by up)       is activated

Runtime state control                   Lifecycle control
— turns existing container on/off       — determines if container is ever made

Temporary — not in compose.yaml         Intentional — defined in compose.yaml

Anyone can start/stop anything          Only profile-assigned services need
at any time                             explicit activation to exist
```

**Concrete difference:**
```
Without profiles — netshoot always created on docker compose up:

  docker compose up -d            → netshoot created and running ❌
  docker compose stop netshoot    → stopped, but container still exists
  docker compose start netshoot   → back up again

  Problem: netshoot always gets created — consumes resources
           someone must remember to stop it every single time
           dependent on human discipline, not automation

With profiles — netshoot never created unless asked for:

  docker compose up -d                       → netshoot not created ✅
  docker compose --profile debug up -d       → netshoot created on demand
  docker compose --profile debug down        → cleanly removed

  Benefit: netshoot simply does not exist in normal operation
           no manual intervention required
           behaviour enforced by compose.yaml — not by human memory
```

The key distinction:
```
start/stop  →  container EXISTS — you are controlling its running state
profiles    →  container does NOT EXIST until explicitly requested
```
---

## The Use Case

When debugging network issues between containers, you need tools like `ping`, `nslookup`, `curl`, `dig`, `traceroute` inside the Docker network. Installing these in your production containers is bad practice — it bloats the image and increases attack surface.

**Solution:** Define a dedicated debug container (`netshoot`) assigned to a `debug` profile. It starts only when you need it, shares the same networks as your app, and gets removed when debugging is done.

```
Normal operation:                 Debugging:
─────────────────                 ──────────────────────────────
docker compose up -d              docker compose --profile debug up -d

 ✔ web (Nginx)    ← starts        ✔ web (Nginx)       ← starts
 ✔ db  (MySQL)    ← starts        ✔ db  (MySQL)        ← starts
   netshoot       ← skipped ✅      ✔ netshoot          ← starts on demand
```

---

## `compose.yaml`

**`src/compose.yaml`**

```yaml
name: profiledemo

services:

  web:
    image: nginx:1.29-alpine
    container_name: profiledemo-web
    restart: unless-stopped
    ports:
      - "8080:80"
    networks:
      - frontend

  db:
    image: mysql:8.4
    container_name: profiledemo-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: dbpassword11
      MYSQL_DATABASE: appdb
    networks:
      - backend

  # Debug container — only starts when --profile debug is used
  netshoot:
    image: nicolaka/netshoot
    container_name: profiledemo-netshoot
    profiles:
      - debug                   # ← assigned to 'debug' profile
    entrypoint: ["sleep", "infinity"]  # keep container running for manual use
    networks:
      - frontend                # ← on both networks — can reach web AND db
      - backend

networks:
  frontend:
    name: profiledemo-frontend
  backend:
    name: profiledemo-backend
```

---

## Compose File Explained

### `profiles:` Key

```yaml
netshoot:
  profiles:
    - debug             # service only starts when 'debug' profile is active
```

- A service with `profiles:` is **never started by default**
- A service **without** `profiles:` always starts — these are default services
- A service can belong to multiple profiles: `profiles: [debug, testing]`
- Profile names are arbitrary — use any descriptive name

### `entrypoint: ["sleep", "infinity"]`

Keeps the container running indefinitely so you can connect to it interactively. Without this, `nicolaka/netshoot` would exit immediately.

### Why `nicolaka/netshoot`?

`nicolaka/netshoot` is a purpose-built network troubleshooting image containing 70+ tools: `ping`, `nslookup`, `dig`, `curl`, `traceroute`, `tcpdump`, `netstat`, `iperf`, and more — all pre-installed and ready to use.

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 14-docker-compose-profiles/src
cd 14-docker-compose-profiles/src
```

Create `compose.yaml` as shown above.

---

### Step 2: Start Default Services (No Profile)

```bash
docker compose up -d
```
```
[+] Running 4/4
 ✔ Network profiledemo-frontend   Created
 ✔ Network profiledemo-backend    Created
 ✔ Container profiledemo-web      Started   ← default service, started ✅
 ✔ Container profiledemo-db       Started   ← default service, started ✅
```

`netshoot` is not listed — it was skipped because no profile was activated.

```bash
docker compose ps
```
```
NAME               IMAGE          STATUS
profiledemo-db     mysql:8.4      Up 10 seconds
profiledemo-web    nginx:alpine   Up 10 seconds
```

Only two containers — `netshoot` is not running ✅

---

### Step 3: Activate the Debug Profile

```bash
docker compose --profile debug up -d
```
```
[+] Running 1/1
 ✔ Container profiledemo-netshoot   Started   ← profile service now started ✅
```

Compose started only the missing service (`netshoot`). The already-running `web` and `db` were left untouched.

```bash
docker compose ps
```
```
NAME                    IMAGE                   STATUS
profiledemo-db          mysql:8.4               Up 2 minutes
profiledemo-web         nginx:alpine            Up 2 minutes
profiledemo-netshoot    nicolaka/netshoot       Up 5 seconds   ← now running ✅
```

---

### Step 4: Use the Debug Container

Connect to `netshoot` and run network diagnostics:

```bash
docker exec -it profiledemo-netshoot bash
```

```bash
# Test connectivity to web service (frontend network)
curl -s http://web | head -5
```
```html
<!DOCTYPE html>
<html>
...Nginx default page...
```

```bash
# DNS resolution — web resolves on frontend network
nslookup web
```
```
Name:   web
Address: 172.20.0.3   ← web container IP ✅
```

```bash
# DNS resolution — db resolves on backend network
nslookup db
```
```
Name:   db
Address: 172.21.0.2   ← db container IP ✅
```

```bash
# Test MySQL port is reachable
nc -zv db 3306
```
```
Connection to db 3306 port [tcp/mysql] succeeded! ✅
```

```bash
exit
```

The `netshoot` container has full visibility across both networks — exactly what you need for debugging without polluting your production containers with tools.

---

### Step 5: `docker compose down` Does Not Remove Profile Services

```bash
docker compose down
```
```
[+] Running 3/3
 ✔ Container profiledemo-web      Removed
 ✔ Container profiledemo-db       Removed
 ✔ Network profiledemo-frontend   Removed
 ✔ Network profiledemo-backend    Removed
```

```bash
docker ps -a | grep netshoot
```
```
profiledemo-netshoot   nicolaka/netshoot   Exited (137)   ← still exists! ✅
```

Profile services must be **explicitly stopped and removed** using the same profile flag:

```bash
docker compose --profile debug down
```
```
[+] Running 1/1
 ✔ Container profiledemo-netshoot   Removed   ← now removed ✅
```

---

### Step 6: Multiple Profiles

A service can belong to multiple profiles:

```yaml
netshoot:
  profiles:
    - debug
    - testing
```

You can also activate multiple profiles at once:

```bash
# Activate two profiles simultaneously
docker compose --profile debug --profile testing up -d
```

---

## `profiles:` — Rules Summary

```
Service with no profiles:       starts with docker compose up -d            ✅ always
Service with profiles:          skipped with docker compose up -d            ✅ by design
                                starts with --profile <name> up -d           ✅ on demand
                                not removed by docker compose down            ⚠️ must use --profile down
```

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| No `profiles:` | Service starts by default with `docker compose up` |
| With `profiles:` | Service is skipped unless its profile is explicitly activated |
| `--profile <name> up -d` | Activates a profile and starts its services |
| `--profile <name> down` | Stops and removes profile services — required, `down` alone won't remove them |
| Multiple profiles per service | `profiles: [debug, testing]` — service starts if any of its profiles is active |
| Multiple `--profile` flags | `--profile debug --profile testing` — activates both profiles at once |
| `nicolaka/netshoot` | Purpose-built debug image with 70+ network tools pre-installed |
| `entrypoint: sleep infinity` | Keeps a utility container running so you can exec into it manually |
| Profile use cases | Debug tools, test runners, DB admin UIs, migration containers, seed data loaders |
