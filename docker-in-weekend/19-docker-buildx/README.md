# Docker BuildKit and Buildx — Advanced Build Engine

## Overview

Every `docker build` you have run so far used BuildKit under the hood — it has been the default build engine since Docker Engine 23.0. `docker buildx` is the CLI that exposes the full power of BuildKit: multiple builders, parallel builds, multi-platform images, cache export, and build secrets. This demo covers the architecture, all builder management commands, and how to create and use a `docker-container` builder.

**What you'll learn:**
- BuildKit architecture — client (`buildx`) vs server (BuildKit daemon)
- Why `docker buildx build` vs `docker build`
- Four builder drivers — `docker`, `docker-container`, `kubernetes`, `remote`
- Docker Build Cloud — theory
- Builder management commands — `ls`, `create`, `inspect`, `use`, `stop`, `rm`, `du`, `prune`
- `--load` and `--push` output flags
- `--progress=plain` — verbose build output
- Multi-platform — concept and command (section only)

---

## Project Structure

```
19-docker-buildx/
├── src/
│   ├── html/
│   │   └── index.html
│   ├── nginx.conf
│   └── Dockerfile
└── README.md
```

Same simple Nginx static site from Demo 13 — no app complexity, focus stays on builder management.

---

## Application Files

**`src/html/index.html`**
```html
<!DOCTYPE html>
<html>
  <head><title>Buildx Demo</title></head>
  <body>
    <h1>Built with Docker Buildx</h1>
  </body>
</html>
```

**`src/nginx.conf`**
```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
```

**`src/Dockerfile`**
```dockerfile
# syntax=docker/dockerfile:1
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 80
```

> **`# syntax=docker/dockerfile:1`** — The first line pins the Dockerfile frontend to the latest stable Dockerfile syntax. This is a BuildKit feature — it tells BuildKit to use the specified frontend image to parse the Dockerfile, enabling the latest Dockerfile features even on older Docker Engine versions. Always include this line.

---

## BuildKit Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Your Terminal                                           │
│                                                          │
│  docker buildx build -t myapp .                         │
│         │                                                │
│         ▼                                                │
│  ┌─────────────┐                                        │
│  │  buildx CLI │  ← client — parses your command,       │
│  │  (client)   │    sends build request to backend      │
│  └──────┬──────┘                                        │
│         │                                                │
└─────────┼───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│  BuildKit Backend (server)                               │
│                                                          │
│  ┌──────────────────┐   ┌──────────────────────────┐   │
│  │  docker driver   │   │  docker-container driver  │   │
│  │  (built into     │   │  (separate BuildKit        │   │
│  │   Docker daemon) │   │   container)               │   │
│  └──────────────────┘   └──────────────────────────┘   │
│                                                          │
│  ┌──────────────────┐   ┌──────────────────────────┐   │
│  │  kubernetes      │   │  Docker Build Cloud        │   │
│  │  driver          │   │  (remote, paid)            │   │
│  │  (K8s pods)      │   │                            │   │
│  └──────────────────┘   └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**`buildx` is the client.** It sends build instructions to a BuildKit backend. The backend (driver) does the actual work — executing Dockerfile steps, managing layers, handling cache.

### `docker build` vs `docker buildx build`

```
docker build .              → legacy syntax, uses BuildKit internally (since v23.0)
                              limited flags, default docker driver only

docker buildx build .       → full BuildKit CLI, all flags available
                              works with any driver (docker, docker-container, etc.)
                              supports --platform, --cache-from/to, --secret, --push
```

In modern Docker both commands use BuildKit. Use `docker buildx build` when you need advanced features — otherwise `docker build` is fine for simple builds.

---

## Builder Drivers

A driver defines **where and how** the BuildKit backend runs. Choosing the right driver determines what features are available.

### Driver Comparison

| Feature | `docker` | `docker-container` | `kubernetes` | `remote` |
|---|---|---|---|---|
| Default driver | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Multi-platform builds | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| Cache export (`--cache-to`) | ⚠️ Limited | ✅ Full | ✅ Full | ✅ Full |
| Build secrets | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| `--load` auto behavior | ✅ Auto | ❌ Manual required | ❌ Manual required | ❌ Manual required |
| Runs as | Docker daemon | Docker container | K8s pod | External daemon |
| Configuration | ❌ Not configurable | ✅ Configurable | ✅ Configurable | ✅ Configurable |

### `docker` Driver (Default)

Built into the Docker daemon. No setup needed — this is what runs when you type `docker build`.

```
Advantages:
  Zero setup — always available
  --load is automatic — built images appear in docker images immediately

Limitations:
  No multi-platform builds
  Limited cache export options
  Not configurable — BuildKit version fixed by Docker Engine
```

### `docker-container` Driver

Creates a dedicated BuildKit container via Docker. Full feature support.

```
Advantages:
  Full BuildKit feature set
  Multi-platform builds via QEMU emulation
  Full cache export — registry, local, gha
  Configurable — choose BuildKit version, set resource limits

Limitation:
  --load is NOT automatic — must explicitly use --load to get image into local store
  Slightly slower first build (pulls moby/buildkit image)
```

### `kubernetes` Driver — Theory

Runs BuildKit as pods inside a Kubernetes cluster. Used for CI/CD in Kubernetes environments where builds should run inside the cluster with access to cluster resources and registry credentials.

```bash
# Create a kubernetes builder (requires kubectl context configured)
docker buildx create \
  --driver kubernetes \
  --name kube-builder \
  --use
```

### `remote` Driver — Theory

Connects to an externally managed BuildKit daemon over a socket or TCP. Used for shared build infrastructure where a central BuildKit instance serves multiple developers or CI systems.

### Docker Build Cloud — Theory

A hosted, managed BuildKit service from Docker. Builders run in Docker's cloud infrastructure instead of your local machine.

```
Benefits:
  Up to 39x faster than local builds (Docker's claim)
  Shared build cache across team — everyone benefits from each other's builds
  Multi-platform without local QEMU setup
  No local resource usage

Limitation:
  Paid subscription required — not available on free plan
  Requires Docker Business or Team plan

Command syntax (theory):
  docker buildx create --driver cloud <ORG>/<BUILDER_NAME>
  docker buildx build --builder cloud-<ORG>-<BUILDER_NAME> --push -t myimage .
```

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 19-docker-buildx/src/html
cd 19-docker-buildx/src
```

Create all files as shown above.

---

### Step 2: Check Buildx Version

```bash
docker buildx version
```
```
github.com/docker/buildx v0.19.3 9e1b5e6
```

Confirms buildx is installed and shows the version.

---

### Step 3: List Available Builders

```bash
docker buildx ls
```
```
NAME/NODE          DRIVER/ENDPOINT   STATUS    BUILDKIT   PLATFORMS
default *          docker                                  
  default          default           running   v0.18.2    linux/amd64, linux/amd64/v2, ...
desktop-linux      docker                                  
  desktop-linux    desktop-linux     running   v0.18.2    linux/amd64, linux/amd64/v2, ...
```

**Reading this output:**
- `*` beside a builder name — this is the **active builder** used for all builds
- `DRIVER` — which driver this builder uses (`docker` in both cases here)
- `STATUS` — `running` means the builder is ready
- `BUILDKIT` — the BuildKit version this builder is running
- `PLATFORMS` — architectures this builder can produce images for
- `default` and `desktop-linux` are created automatically by Docker Desktop — you cannot delete them

---

### Step 4: Inspect a Builder

```bash
docker buildx inspect default
```
```
Name:          default
Driver:        docker
Last Activity: 2024-01-15 10:30:00 +0000 UTC

Nodes:
Name:      default
Endpoint:  default
Status:    running
BuildKit:  v0.18.2
Platforms: linux/amd64, linux/amd64/v2, linux/amd64/v3, linux/arm64,
           linux/riscv64, linux/ppc64le, linux/s390x, linux/386,
           linux/arm/v7, linux/arm/v6
```

**What this shows:**
- `Driver: docker` — using the Docker daemon's built-in BuildKit
- `Nodes` — a builder can have multiple nodes (machines). Default has one — your local machine
- `Platforms` — every platform this builder can produce images for
- `Endpoint: default` — connected to the local Docker daemon socket

---

### Step 5: Check Build Cache Usage

```bash
docker buildx du
```
```
ID                                        RECLAIMABLE   SIZE        LAST ACCESSED
sha256:a1b2c3...                          true          45.2MB      2 hours ago
sha256:d4e5f6...                          true          12.8MB      1 day ago
Total:                                    58.0MB
```

Shows how much disk space the build cache is using. `RECLAIMABLE` means the layer can be removed by `prune` if space is needed.

---

### Step 6: Build with Default Builder (docker driver)

```bash
docker buildx build -t buildx-demo:latest --load .
```
```
[+] Building 2.3s (8/8) FINISHED                          docker:default
 => [internal] load build definition from Dockerfile      0.0s
 => [internal] load metadata for docker.io/library/nginx  1.1s
 => [1/3] FROM nginx:alpine                               0.0s
 => [2/3] COPY nginx.conf /etc/nginx/conf.d/default.conf  0.0s
 => [3/3] COPY html/ /usr/share/nginx/html/               0.0s
 => exporting to image                                    0.1s
 => => naming to docker.io/library/buildx-demo:latest     0.0s
```

**Observations:**
- `docker:default` in the header — confirms which builder was used
- `--load` flag — loads the built image into the local Docker image store
- With `docker` driver, `--load` is actually redundant (it's the default behavior) but explicit is clearer

```bash
# Verify image exists in local store
docker images buildx-demo
```
```
REPOSITORY     TAG       IMAGE ID       CREATED          SIZE
buildx-demo    latest    a1b2c3d4e5f6   10 seconds ago   43MB
```

---

### Step 7: Create a `docker-container` Builder

The `docker-container` driver unlocks the full BuildKit feature set. This is the builder you use for multi-platform images, full cache export, and advanced scenarios.

```bash
docker buildx create \
  --name mybuilder \
  --driver docker-container \
  --bootstrap \
  --use
```

**Flag explanation:**
```
--name mybuilder        name for the new builder
--driver docker-container  use the docker-container driver
--bootstrap             start the builder immediately (pulls moby/buildkit image,
                        creates container) — without this it starts lazily on first build
--use                   make this the active builder immediately
```

```
[+] Building 4.2s (1/1) FINISHED
 => [internal] booting buildkit                           4.2s
 => => pulling image moby/buildkit:buildx-stable-1        3.8s
 => => creating container buildx_buildkit_mybuilder0      0.4s
```

**What happened:** BuildKit pulled `moby/buildkit:buildx-stable-1` and created a Docker container called `buildx_buildkit_mybuilder0`. This container IS the build server — your builds now run inside it.

---

### Step 8: Verify the New Builder

```bash
docker buildx ls
```
```
NAME/NODE          DRIVER/ENDPOINT      STATUS    BUILDKIT    PLATFORMS
mybuilder *        docker-container                           
  mybuilder0       desktop-linux        running   v0.18.2    linux/amd64, linux/amd64/v2, ...
default            docker                                     
  default          default              running   v0.18.2    linux/amd64, ...
desktop-linux      docker                                     
  desktop-linux    desktop-linux        running   v0.18.2    linux/amd64, ...
```

`mybuilder *` — star confirms it is now the active builder.

```bash
# Verify the BuildKit container is running
docker ps | grep buildkit
```
```
buildx_buildkit_mybuilder0   moby/buildkit:buildx-stable-1   "buildkitd"   running
```

The BuildKit daemon runs as a Docker container. When you build, `buildx` sends instructions to this container.

```bash
docker buildx inspect mybuilder
```
```
Name:          mybuilder
Driver:        docker-container
Last Activity: 2024-01-15 10:45:00 +0000 UTC

Nodes:
Name:      mybuilder0
Endpoint:  desktop-linux
Status:    running
BuildKit:  v0.18.2
Platforms: linux/amd64, linux/amd64/v2, linux/arm64, linux/riscv64,
           linux/ppc64le, linux/s390x, linux/386, linux/mips64le,
           linux/mips64, linux/arm/v7, linux/arm/v6
```

Note the expanded platform list compared to the `docker` driver — `docker-container` supports more platforms via QEMU emulation.

---

### Step 9: Build with `docker-container` Builder

```bash
docker buildx build -t buildx-demo:v2 --load .
```
```
[+] Building 3.1s (8/8) FINISHED                    docker-container:mybuilder
 => [internal] load build definition from Dockerfile                      0.1s
 => [internal] load metadata for docker.io/library/nginx:alpine           1.2s
 => [1/3] FROM nginx:alpine                                               0.0s
 => [2/3] COPY nginx.conf /etc/nginx/conf.d/default.conf                  0.1s
 => [3/3] COPY html/ /usr/share/nginx/html/                               0.1s
 => exporting to image                                                    0.3s
 => => exporting layers                                                   0.1s
 => => writing image sha256:...                                           0.0s
 => => naming to docker.io/library/buildx-demo:v2                        0.0s
 => => loading to client                                                  0.1s  ← explicit load step
```

**Key difference from docker driver:**
- `docker-container:mybuilder` in the header — confirms this builder was used
- An explicit `loading to client` step appears — with `docker-container` driver, `--load` is not automatic. Without `--load`, the image would exist only in the builder's cache, not in your local `docker images`.

---

### Step 10: Build with Verbose Output

```bash
docker buildx build -t buildx-demo:v3 --load --progress=plain .
```
```
#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 180B done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/nginx:alpine
#2 ...
#2 DONE 1.1s

#3 [internal] load .dockerignore
#3 transferring context: 2B done
#3 DONE 0.0s

#4 [1/3] FROM nginx:alpine@sha256:abc123...
#4 CACHED
#4 DONE 0.0s

#5 [2/3] COPY nginx.conf /etc/nginx/conf.d/default.conf
#5 DONE 0.1s

#6 [3/3] COPY html/ /usr/share/nginx/html/
#6 DONE 0.1s

#7 exporting to image
#7 exporting layers done
#7 writing image sha256:... done
#7 naming to docker.io/library/buildx-demo:v3 done
#7 loading to client done
#7 DONE 0.3s
```

`--progress=plain` shows every build step with its step number (`#1`, `#2`...), timing, and `CACHED` vs executed status. Use this when debugging build issues — the default compressed output hides detail.

---

### Step 11: Build for a Specific Builder Without Switching Default

You can target a specific builder without changing the active builder:

```bash
docker buildx build -t buildx-demo:v4 --load --builder default .
```

`--builder default` overrides the active builder for this single command. Useful in CI scripts where you want explicit control without relying on the active builder setting.

---

### Step 12: Multi-Platform — Concept and Example

Multi-platform builds produce a single image that runs on multiple CPU architectures. This requires the `docker-container` driver (already active as `mybuilder`).

```bash
# Build for both AMD64 (standard servers) and ARM64 (AWS Graviton, Apple Silicon)
# Note: --push required for multi-platform — local store cannot hold manifest lists
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag yourdockerhubuser/buildx-demo:multi \
  --push \
  .
```

**Why `--push` is required for multi-platform:**
The default Docker image store cannot hold a multi-platform manifest list (multiple images under one tag). The image must go to a registry which supports manifests. Without a Docker Hub account, you can also use `--output type=oci,dest=./image.tar` to save locally.

**Where multi-platform matters in corporate environments:**
```
Dev machines (Apple M-chip)  →  linux/arm64
Production servers (Intel/AMD) →  linux/amd64
AWS Graviton instances        →  linux/arm64
CI/CD (GitHub Actions)        →  linux/amd64 (default runner)
```

Without multi-platform images, ARM developers must build for AMD64 explicitly or risk running emulated containers. A multi-platform image resolves this — Docker pulls the correct variant automatically based on the host architecture.

---

### Step 13: Switch Active Builder

```bash
# Switch to the docker driver builder
docker buildx use default

# Verify
docker buildx ls
```
```
NAME/NODE     DRIVER/ENDPOINT   STATUS
default *     docker            running    ← star moved to default
mybuilder     docker-container  running
```

```bash
# Switch back to mybuilder
docker buildx use mybuilder
```

---

### Step 14: Stop and Remove a Builder

```bash
# Stop the builder (stops the container but preserves state)
docker buildx stop mybuilder

# Verify it is stopped
docker buildx ls
```
```
NAME/NODE     DRIVER/ENDPOINT   STATUS
mybuilder *   docker-container  stopped   ← container stopped
```

```bash
# Remove the builder entirely
docker buildx rm mybuilder
```
```
mybuilder removed
```

**What `rm` does:**
- Removes the builder configuration
- Removes the BuildKit container (`buildx_buildkit_mybuilder0`)
- Removes local build cache for this builder
- If removed builder was active, Docker automatically falls back to `default`

```bash
# Confirm removed
docker buildx ls
```
```
NAME/NODE       DRIVER/ENDPOINT   STATUS
default *       docker            running   ← automatically became active
desktop-linux   docker            running
```

---

### Step 15: Prune Build Cache

```bash
# Check current cache size
docker buildx du
```
```
Total:   58.0MB
```

```bash
# Remove only dangling (unreferenced) cache
docker buildx prune
```
```
Are you sure you want to continue? [y/N] y
Total:  12.4MB freed
```

```bash
# Remove all build cache (including referenced layers)
docker buildx prune --all
```
```
Are you sure you want to continue? [y/N] y
Total:  58.0MB freed
```

```bash
# Remove without confirmation prompt (for scripts)
docker buildx prune --force
```

---

## Buildx Command Reference

| Command | What it does |
|---|---|
| `docker buildx version` | Show buildx version |
| `docker buildx ls` | List all builders — star shows active |
| `docker buildx create --name <n> --driver <d> --bootstrap --use` | Create and activate a new builder |
| `docker buildx inspect <name>` | Show detailed builder info — driver, platforms, status |
| `docker buildx inspect --bootstrap <name>` | Inspect and start builder if stopped |
| `docker buildx use <name>` | Set active builder |
| `docker buildx stop <name>` | Stop builder (preserves state) |
| `docker buildx rm <name>` | Remove builder and its cache |
| `docker buildx du` | Show build cache disk usage |
| `docker buildx prune` | Remove dangling build cache |
| `docker buildx prune --all` | Remove all build cache |
| `docker buildx build --load` | Build and load into local image store |
| `docker buildx build --push` | Build and push to registry |
| `docker buildx build --progress=plain` | Verbose step-by-step build output |
| `docker buildx build --platform linux/amd64,linux/arm64` | Multi-platform build |
| `docker buildx build --builder <name>` | Use specific builder without changing active |

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| `# syntax=docker/dockerfile:1` | First line of every Dockerfile — pins to latest stable Dockerfile syntax |
| BuildKit | Default build engine since Docker Engine 23.0 — always active |
| `buildx` | CLI client that exposes full BuildKit features |
| `docker` driver | Default, zero config, no multi-platform, `--load` automatic |
| `docker-container` driver | Full features, multi-platform, `--load` must be explicit |
| `--bootstrap` | Starts the builder immediately on create — without it, starts lazily on first build |
| `--use` | Makes the new builder active immediately |
| `--load` | Loads built image into local `docker images` — required for `docker-container` driver |
| `--push` | Pushes built image to registry — required for multi-platform |
| `--progress=plain` | Full verbose output — use for debugging build issues |
| `docker buildx du` | Check build cache disk usage |
| `docker buildx prune` | Clean build cache — run periodically to free disk space |
| Multi-platform | Requires `docker-container` driver + `--push` or OCI output |
| Build Cloud | Hosted BuildKit — faster builds, shared cache — paid subscription required |