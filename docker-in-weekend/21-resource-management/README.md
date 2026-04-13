# Docker Resource Management — Limits, Monitoring, and System Cleanup

## Overview

By default, Docker containers have no resource limits — a single runaway container can consume all available CPU and memory on the host, starving every other service and potentially crashing the entire system. This is called the **Noisy Neighbour problem**. In 2024 a Docker memory leak bug caused the OOM Killer to terminate 68 containers on a single host in one incident. This demo covers how to prevent this using resource limits, how to monitor containers in real time with `docker stats`, how to update limits on running containers without downtime, and how to keep your Docker host healthy with system cleanup commands.

**What you'll learn:**
- `docker stats` — real-time resource monitoring
- `--memory` / `-m` — hard memory limit (OOM kill on breach)
- `--memory-reservation` — soft memory limit
- `--cpus` — CPU core limit
- `--cpu-shares` — relative CPU priority
- `--pids-limit` — process count limit (fork bomb protection)
- OOM kill — what it is, how to observe it, exit code 137
- `docker update` — change limits on a running container
- Resource limits in Compose (`deploy.resources`)
- `docker system df` — disk usage overview
- `docker system prune` — clean up unused resources
- `docker container prune`, `docker image prune`, `docker volume prune`

---

## Project Structure

```
21-resource-management/
├── src/
│   └── compose.yaml
└── README.md
```

**Applications:**
- `nginx:alpine` — well-behaved web server, baseline for comparison
- `alexeiled/stress-ng` — purpose-built Linux stress testing tool. Used by SREs and DevOps engineers for chaos testing, capacity planning, and resource validation. Makes CPU throttling and OOM kills happen on demand — no custom code needed.

---

## Why Resource Limits Matter in Production

```
Without limits:                        With limits:
────────────────────────────────────   ────────────────────────────────────
Container A (memory leak):             Container A (memory leak):
  RAM usage: 0 → 2GB → 8GB → host      RAM usage: hits 512MB → OOM kill
  crashes                               Container A dies alone ✅

Container B (nginx):                   Container B (nginx):
  Also killed by OOM Killer ❌           Still running, unaffected ✅

Host:                                  Host:
  System outage ❌                       Stable ✅
```

---

## How Docker Resource Limits Work — cgroups

Docker uses **Linux Control Groups (cgroups)** to enforce resource constraints. When you set `--memory=512m`, Docker writes the limit into the container's cgroup file:

```
/sys/fs/cgroup/system.slice/docker-<id>.scope/memory.max  ← 536870912 (512MB in bytes)
```

The Linux kernel reads this file and enforces the limit. When a container exceeds its memory limit, the kernel's **OOM Killer** sends `SIGKILL` (signal 9) to the container's PID 1. The container exits with **code 137** (128 + 9). This is visible in `docker inspect` as `OOMKilled: true`.

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 21-resource-management/src
cd 21-resource-management/src
```

---

### Step 2: `docker stats` — Real-Time Monitoring

Start a basic Nginx container first:

```bash
docker run -d --name web nginx:alpine
```

```bash
# Live monitoring — updates every second
docker stats
```
```
CONTAINER ID   NAME    CPU %   MEM USAGE / LIMIT     MEM %   NET I/O       BLOCK I/O
a1b2c3d4e5f6   web     0.00%   3.47MiB / 7.67GiB     0.04%   1.2kB / 0B    0B / 0B
```

**Reading `docker stats` output:**

```
CONTAINER ID   shortened container ID
NAME           container name
CPU %          percentage of host CPU being used
MEM USAGE      current memory used / limit (no limit = host total)
MEM %          percentage of limit used
NET I/O        network bytes received / sent
BLOCK I/O      disk bytes read / written
```

> **MEM LIMIT shows host total RAM** — this is the problem. No limit means the container can use everything.

```bash
# Snapshot — non-streaming, one-time output (good for scripts)
docker stats --no-stream
```
```
CONTAINER ID   NAME    CPU %   MEM USAGE / LIMIT     MEM %
a1b2c3d4e5f6   web     0.00%   3.47MiB / 7.67GiB     0.04%
```

```bash
# Monitor specific container only
docker stats web

# Custom format — show only what you need
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

```bash
docker stop web && docker rm web
```

---

### Step 3: Memory Limits — Hard Limit (`--memory`)

```bash
# Run Nginx with 128MB hard memory limit
docker run -d \
  --name web-limited \
  --memory=128m \
  nginx:alpine
```

```bash
# Verify limit is applied
docker stats --no-stream web-limited
```
```
NAME          MEM USAGE / LIMIT     MEM %
web-limited   3.47MiB / 128MiB      2.71%   ← limit now shows 128MB ✅
```

**`MEM LIMIT` now shows `128MiB`** — not the full host RAM. The container cannot use more.

```bash
# Also verify with docker inspect
docker inspect web-limited --format='Memory: {{.HostConfig.Memory}}'
```
```
Memory: 134217728   ← 128 * 1024 * 1024 bytes = 128MB ✅
```

```bash
docker rm -f web-limited
```

---

### Step 4: Trigger an OOM Kill — See it Happen

This is where `stress-ng` is perfect — you can force an OOM kill on demand.

```bash
# Start a container with only 100MB memory limit
# Then immediately stress it with 200MB — more than the limit
docker run -d \
  --name stress-oom \
  --memory=100m \
  alexeiled/stress-ng \
  --vm 1 --vm-bytes 200M --timeout 30s
```

**Flag explanation for stress-ng:**
```
--vm 1          start 1 virtual memory worker
--vm-bytes 200M attempt to allocate 200MB of memory
--timeout 30s   run for 30 seconds then exit cleanly
```

Watch it get killed:

```bash
# Follow the container — it will die quickly
docker logs -f stress-oom
```
```
stress-ng: info:  [1] dispatching hogs: 1 vm
(container exits suddenly — killed by OOM Killer)
```

```bash
# Check exit status
docker inspect stress-oom --format='ExitCode: {{.State.ExitCode}}'
```
```
ExitCode: 137   ← 128 + SIGKILL(9) = 137, OOM kill confirmed ✅
```

```bash
# Confirm OOMKilled flag
docker inspect stress-oom --format='OOMKilled: {{.State.OOMKilled}}'
```
```
OOMKilled: true   ← definitive proof ✅
```

**Exit code 137 + OOMKilled: true = container was killed by Linux OOM Killer due to exceeding its memory limit.**

```bash
docker rm stress-oom
```

---

### Step 5: Soft Memory Limit — `--memory-reservation`

A soft limit (reservation) does not kill the container — it is a hint to the kernel during memory pressure.

```bash
docker run -d \
  --name web-soft \
  --memory=512m \
  --memory-reservation=256m \
  nginx:alpine
```

```
--memory=512m            hard limit — container killed if it exceeds this
--memory-reservation=256m soft limit — when host is under memory pressure,
                           kernel tries to keep this container below 256MB
                           but allows up to 512MB if host has spare capacity
```

```bash
docker inspect web-soft --format='
Memory:             {{.HostConfig.Memory}}
MemoryReservation:  {{.HostConfig.MemoryReservation}}'
```
```
Memory:             536870912   ← 512MB hard limit
MemoryReservation:  268435456   ← 256MB soft limit
```

```bash
docker rm -f web-soft
```

---

### Step 6: CPU Limits — `--cpus`

```bash
# Limit to 0.5 CPU cores (50% of one core)
docker run -d \
  --name web-cpu \
  --cpus=0.5 \
  nginx:alpine
```

```bash
# Start CPU stress — 2 workers at 100% CPU
docker run -d \
  --name stress-cpu \
  --cpus=0.5 \
  alexeiled/stress-ng \
  --cpu 2 --timeout 60s
```

```bash
# Watch CPU usage — should stay at ~50% despite 2 workers running
docker stats stress-cpu --no-stream
```
```
NAME         CPU %    MEM USAGE / LIMIT
stress-cpu   49.8%    4.2MiB / 7.67GiB   ← capped at ~50% ✅
```

Without `--cpus=0.5` the same container would show near 200% (2 cores fully used). The limit contains it.

```bash
# --cpu-shares: relative priority when CPU is contested (default 1024)
# This container gets 2x the CPU time of a default container
docker run -d \
  --name high-priority \
  --cpu-shares=2048 \
  nginx:alpine
```

**`--cpus` vs `--cpu-shares`:**
```
--cpus          hard limit — container never uses more than this
                enforced even when host CPU is idle
--cpu-shares    relative priority — only matters when CPU is contested
                containers can burst above their share when host has spare CPU
```

```bash
docker rm -f web-cpu stress-cpu high-priority
```

---

### Step 7: PID Limit — Fork Bomb Protection

A fork bomb is a process that spawns copies of itself infinitely, exhausting the process table and crashing the system. `--pids-limit` is the defence.

```bash
# Limit container to maximum 20 processes
docker run -d \
  --name web-pids \
  --pids-limit=20 \
  nginx:alpine
```

```bash
# Try to launch more than 20 processes inside the container
docker exec web-pids sh -c 'for i in $(seq 1 30); do sleep 100 & done'
```
```
sh: fork: Resource temporarily unavailable   ← blocked at PID limit ✅
```

Without `--pids-limit`, a fork bomb inside a container could crash the host.

```bash
docker rm -f web-pids
```

---

### Step 8: `docker update` — Change Limits on a Running Container

A critical operational skill — update resource limits **without stopping the container**. No downtime, no restart.

```bash
# Start with a low memory limit
docker run -d \
  --name live-web \
  --memory=64m \
  nginx:alpine

# Check current limit
docker stats --no-stream live-web
```
```
NAME       MEM USAGE / LIMIT
live-web   3.47MiB / 64MiB   ← only 64MB
```

```bash
# Increase memory without restarting
docker update --memory=256m --memory-swap=256m live-web
```
```
live-web
```

```bash
# Verify new limit applied
docker stats --no-stream live-web
```
```
NAME       MEM USAGE / LIMIT
live-web   3.47MiB / 256MiB   ← updated to 256MB, no restart ✅
```

**`docker update` is your production incident tool** — when a container hits OOM and you need to increase the limit immediately without taking it offline.

> **`--memory-swap`**: Always set equal to `--memory` when updating. `--memory-swap` is total memory + swap. Setting `--memory=256m` without updating `--memory-swap` may leave the old swap value inconsistent.

```bash
# Update CPU limit too
docker update --cpus=1.0 live-web

docker rm -f live-web
```

---

### Step 9: Resource Limits in Compose

**`src/compose.yaml`**

```yaml
name: resourcedemo

services:

  web:
    image: nginx:alpine
    container_name: resourcedemo-web
    ports:
      - "8080:80"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.50"         # hard CPU limit — max 0.5 core
          memory: 128M         # hard memory limit — OOM kill at 128MB
        reservations:
          cpus: "0.25"         # soft CPU — guaranteed minimum
          memory: 64M          # soft memory — guaranteed minimum

  stress:
    image: alexeiled/stress-ng
    container_name: resourcedemo-stress
    command: --cpu 1 --vm 1 --vm-bytes 64M --timeout 120s
    restart: "no"              # run once and exit
    deploy:
      resources:
        limits:
          cpus: "0.50"
          memory: 128M
```

```bash
docker compose up -d
```
```
[+] Running 3/3
 ✔ Network resourcedemo_default   Created
 ✔ Container resourcedemo-web     Started
 ✔ Container resourcedemo-stress  Started
```

```bash
# Watch both containers — stress-ng stays within its limits
docker stats
```
```
NAME                  CPU %    MEM USAGE / LIMIT
resourcedemo-stress   49.8%    66MiB / 128MiB     ← CPU and RAM both limited ✅
resourcedemo-web      0.00%    3.47MiB / 128MiB   ← web server unaffected ✅
```

```bash
docker compose down
```

---

### Step 10: `docker system df` — Disk Usage

Docker accumulates disk usage over time from images, containers, volumes, and build cache. This command shows exactly where space is being used.

```bash
docker system df
```
```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          12        3         2.41GB    1.87GB (77%)
Containers      2         2         0B        0B
Local Volumes   4         2         512MB     256MB (50%)
Build Cache     28        0         842MB     842MB
```

**Column explanation:**
```
TYPE            what kind of resource
TOTAL           total objects of this type
ACTIVE          objects currently in use by running containers
SIZE            total disk space used
RECLAIMABLE     space that can be freed — inactive objects not in use
```

```bash
# Verbose — break down per image and container
docker system df -v
```

---

### Step 11: Cleanup Commands

**Remove stopped containers:**

```bash
docker container prune
```
```
WARNING! This will remove all stopped containers.
Are you sure you want to continue? [y/N] y
Deleted Containers:
a1b2c3d4e5f6
Total reclaimed space: 0B
```

**Remove unused images (dangling = untagged intermediate layers):**

```bash
# Remove only dangling images (untagged)
docker image prune

# Remove ALL unused images — not just dangling
docker image prune --all
```

**Remove unused volumes:**

```bash
docker volume prune
```
> ⚠️ Only removes volumes not attached to any container. Will not delete volumes used by running or stopped containers.

**Remove unused networks:**

```bash
docker network prune
```

**`docker system prune` — Remove everything unused in one command:**

```bash
docker system prune
```
```
WARNING! This will remove:
  - all stopped containers
  - all networks not used by at least one container
  - all dangling images
  - all dangling build cache

Are you sure you want to continue? [y/N] y
...
Total reclaimed space: 1.87GB
```

```bash
# Also remove unused volumes and ALL unused images (not just dangling)
docker system prune --volumes --all
```

> ⚠️ `--all` removes images not referenced by any container — including base images you might want to keep cached. Use with care on developer machines.

---

## Resource Limits — Quick Reference

| Flag | Type | Effect |
|---|---|---|
| `--memory=512m` | Hard limit | OOM kill if exceeded — exit code 137 |
| `--memory-reservation=256m` | Soft limit | Kernel tries to stay below this under pressure |
| `--memory-swap=512m` | Total memory+swap | Set equal to `--memory` to disable swap |
| `--cpus=0.5` | Hard limit | Never exceeds 50% of one core |
| `--cpu-shares=2048` | Soft priority | 2x CPU time vs default when contested |
| `--pids-limit=50` | Hard limit | Fork bomb protection |

## Key Takeaways

| Concept | Key Point |
|---|---|
| No default limits | Containers can consume all host resources without limits — always set them in production |
| `docker stats` | Real-time CPU, memory, network, I/O per container — first tool to open during incidents |
| `--no-stream` | One-time snapshot — use in scripts and CI |
| Exit code 137 | Container killed by OOM Killer — memory limit exceeded |
| `OOMKilled: true` | Confirmed in `docker inspect` — definitive evidence of OOM kill |
| `--memory-reservation` | Soft limit — does not kill, protects against memory pressure |
| `docker update` | Change resource limits live without restarting the container |
| `deploy.resources` | Compose syntax for resource limits — use in all production Compose files |
| `docker system df` | Shows disk usage breakdown — run regularly to spot buildup |
| `docker system prune` | Removes all unused resources — safest regular cleanup command |
| cgroups | Linux kernel feature that enforces all Docker resource limits |