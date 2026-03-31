# Advanced Multi-Stage Builds — `--target`, Cache Mounts, Build Secrets, CI Cache

## Overview

Multi-stage builds are one of the most important Docker skills in a corporate environment. Every production Dockerfile in a professional project uses them. This demo goes beyond the basics — named stages, `--target` for partial builds, `RUN --mount=type=cache` to eliminate repeated package downloads, `RUN --mount=type=secret` to pass credentials without baking them into layers, and `--cache-from`/`--cache-to` for CI/CD pipeline cache reuse.

**What you'll learn:**
- Named stages and `--target` — build only up to a specific stage
- Parallel independent stages — BuildKit builds them concurrently
- `RUN --mount=type=cache` — persistent package cache that survives rebuilds
- `RUN --mount=type=secret` — credentials at build time, never in image layers
- Why `ARG`/`ENV` is wrong for build secrets — visible in `docker history`
- `--cache-from` / `--cache-to` — restore build cache in CI/CD pipelines
- Image size comparison with real numbers

**Corporate relevance:** Every company building Docker images in CI/CD (GitHub Actions, GitLab CI, Jenkins) uses these techniques. They are the difference between a 5-minute build and a 30-second build.

---

## Project Structure

```
20-advanced-multistage/
├── src/
│   ├── app/
│   │   ├── app.py              # Flask application
│   │   ├── requirements.txt    # Python dependencies
│   │   └── tests/
│   │       └── test_app.py     # Unit tests
│   ├── secret.txt              # simulated API key (gitignored)
│   ├── .dockerignore
│   └── Dockerfile
└── README.md
```

**Why Python Flask?**
- `requirements.txt` perfectly demonstrates `RUN --mount=type=cache` (pip cache)
- Clear separation between build deps and runtime deps — dramatic size difference
- Unit tests create a natural `test` stage for `--target` demo
- Universally understood in DevOps environments

---

## Application Files

**`src/app/app.py`**
```python
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        "message": "Advanced Multi-Stage Build Demo",
        "status": "running"
    })

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**`src/app/requirements.txt`**
```
flask==3.1.0
gunicorn==23.0.0
```

**`src/app/tests/test_app.py`**
```python
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_home(client):
    response = client.get('/')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'running'

def test_health(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert response.get_json()['status'] == 'healthy'
```

**`src/secret.txt`** — simulated API key (never commit this)
```
super-secret-api-key-12345
```

**`src/.dockerignore`**
```
__pycache__/
*.pyc
*.pyo
.pytest_cache/
secret.txt
.env
```

> `.dockerignore` keeps the build context small and prevents secrets from accidentally being sent to the builder.

---

## The Dockerfile — All Concepts Combined

**`src/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ── Stage 1: base ─────────────────────────────────────────────────────────────
# Shared base for all subsequent stages — install OS-level dependencies once
FROM python:3.13-slim AS base

WORKDIR /app

# System dependencies — installed once, cached as a layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*


# ── Stage 2: builder ──────────────────────────────────────────────────────────
# Install Python dependencies — uses cache mount to avoid re-downloading pip packages
FROM base AS builder

COPY app/requirements.txt .

# RUN --mount=type=cache persists the pip cache directory across builds
# pip downloads are NOT re-downloaded on subsequent builds if requirements.txt unchanged
# The cache directory is NEVER included in the image — zero size impact
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt


# ── Stage 3: test ─────────────────────────────────────────────────────────────
# Run tests — this stage is used with --target test in CI pipelines
# If tests fail, the build fails here — final image is never produced
FROM builder AS test

COPY app/ .

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install pytest==8.3.4

RUN PYTHONPATH=/install/lib/python3.13/site-packages \
    python -m pytest tests/ -v


# ── Stage 4: final ────────────────────────────────────────────────────────────
# Lean production image — only runtime dependencies, no test tools, no build tools
FROM base AS final

# Copy only the installed packages from builder — not the full builder stage
COPY --from=builder /install /usr/local

# Use build secret — available ONLY during this RUN instruction
# Never baked into any image layer
RUN --mount=type=secret,id=api_key \
    echo "Configuring with API key: $(cat /run/secrets/api_key | cut -c1-4)****" \
    # In a real app: configure a service, download licensed assets, etc.

COPY app/app.py .

# Run as non-root user for security
RUN useradd --no-create-home appuser
USER appuser

EXPOSE 5000

CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

---

## Concept 1 — Named Stages and `--target`

### Named Stages

Each `FROM ... AS <name>` creates a named stage. Stages can reference each other with `--from=<name>` in `COPY` instructions.

```
Stage 1: base     → shared OS setup
Stage 2: builder  → FROM base — installs Python packages
Stage 3: test     → FROM builder — runs pytest
Stage 4: final    → FROM base — lean production image
                    copies only /install from builder
```

```
base ──── builder ──── test
     \
      ──── final (copies from builder via --from=builder)
```

### `--target` — Build to a Specific Stage

Without `--target`, Docker builds all stages and produces the last one (`final`). With `--target`, it stops at the named stage.

```bash
# Build only up to the test stage — run tests in CI without producing final image
docker buildx build --target test --load -t myapp:test .

# Build the full final image for deployment
docker buildx build --target final --load -t myapp:latest .

# Build just the builder stage — useful for debugging dependency installs
docker buildx build --target builder --load -t myapp:builder .
```

**Corporate use case — CI/CD pipeline:**
```
Step 1: docker buildx build --target test .
        → runs all unit tests
        → if tests fail, pipeline stops here
        → no wasted time building final image when tests fail

Step 2: docker buildx build --target final --push -t myrepo/myapp:latest .
        → only runs if Step 1 passed
        → produces lean deployable image
```

---

## Concept 2 — Parallel Independent Stages (BuildKit)

BuildKit automatically detects which stages are independent and builds them concurrently. In the Dockerfile, `test` and `final` both depend on `builder` but not on each other — they can run in parallel:

```
Without BuildKit (legacy):        With BuildKit:
base → builder → test             base → builder → test ┐
              → final                              → final ┘ (parallel)
(sequential)                      (test and final build at the same time)
```

No changes to the Dockerfile are needed — BuildKit analyzes the dependency graph automatically. You see this in `--progress=plain` output when two `#N` steps run simultaneously.

---

## Concept 3 — `RUN --mount=type=cache`

### The Problem Without Cache Mounts

```
Build 1: requirements.txt unchanged → pip downloads flask, gunicorn → 8 seconds
Build 2: app.py changed             → pip downloads flask, gunicorn AGAIN → 8 seconds
Build 3: requirements.txt unchanged → pip downloads flask, gunicorn AGAIN → 8 seconds
```

Even with Docker layer caching, `pip install` re-downloads packages whenever anything before it in the Dockerfile changes. Cache mounts fix this.

### How Cache Mounts Work

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
```

```
First build:
  pip downloads packages → saves to /root/.cache/pip (cache mount)
  /root/.cache/pip is NOT included in the image layer

Second build (even after code changes):
  pip checks /root/.cache/pip → packages already there → installs from cache
  Download time: ~0 seconds ✅

The cache mount:
  - Persists across builds on the same machine
  - Is never written into any image layer
  - Does not bloat the image
  - Is separate from Docker layer cache
```

### Cache Mount ID

```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip,id=pip-cache \
    pip install -r requirements.txt
```

`id=pip-cache` gives the cache a name. Multiple Dockerfiles can share the same cache by using the same `id`. Without `id`, the cache is identified by the target path.

### Common Cache Mount Targets

```dockerfile
# Python / pip
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Node.js / npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# apt packages
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y curl
```

---

## Concept 4 — `RUN --mount=type=secret`

### Why `ARG` is Wrong for Build Secrets

```dockerfile
# ❌ NEVER do this — API key is baked into the image layer permanently
ARG API_KEY
RUN configure-service --key=$API_KEY
```

```bash
# The key is visible to anyone with access to the image
docker history myimage
```
```
IMAGE         CREATED BY
a1b2c3...     RUN configure-service --key=super-secret-api-key-12345   ← exposed! ❌
```

`docker history` shows every layer's command — ARG values are permanently recorded.

### How Build Secrets Work

```dockerfile
# ✅ Secret is available only during this RUN instruction
# Never appears in any layer, never in docker history
RUN --mount=type=secret,id=api_key \
    configure-service --key=$(cat /run/secrets/api_key)
```

The secret is mounted as a file at `/run/secrets/<id>` for the duration of the `RUN` instruction only. Once the instruction completes, the file is gone — not in the layer, not in the cache, not in `docker history`.

### Passing the Secret at Build Time

```bash
# Pass secret from a file
docker buildx build \
  --secret id=api_key,src=./secret.txt \
  --load \
  -t myapp:latest \
  .
```

```bash
# Pass secret from an environment variable
export MY_API_KEY="super-secret-api-key-12345"
docker buildx build \
  --secret id=api_key,env=MY_API_KEY \
  --load \
  -t myapp:latest \
  .
```

### Verify Secret is NOT in Image

```bash
# Build the image
docker buildx build \
  --secret id=api_key,src=./secret.txt \
  --load \
  -t myapp:latest \
  .

# Try to find the secret in docker history
docker history myapp:latest
```
```
IMAGE         CREATED BY                                       SIZE
a1b2c3...     CMD ["python", "-m", "gunicorn" ...]            0B
b2c3d4...     EXPOSE 5000                                     0B
c3d4e5...     USER appuser                                    0B
d4e5f6...     RUN |0 /bin/sh -c echo "Configuring..."        0B   ← no key value ✅
e5f6g7...     COPY app/app.py .                               2KB
```

The secret value never appears in `docker history` ✅

```bash
# Try to find the secret inside the running container
docker run --rm myapp:latest cat /run/secrets/api_key
```
```
cat: /run/secrets/api_key: No such file or directory   ← gone after build ✅
```

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 20-advanced-multistage/src/app/tests
cd 20-advanced-multistage/src
echo "super-secret-api-key-12345" > secret.txt
```

Create all files as shown above.

---

### Step 2: Build the Test Stage Only

```bash
docker buildx build --target test --load -t myapp:test .
```
```
[+] Building 18.3s (12/12) FINISHED
 => [internal] load build definition from Dockerfile           0.0s
 => [base 1/2] FROM python:3.13-slim                          4.1s
 => [base 2/2] RUN apt-get update...                          3.2s
 => [builder 1/2] COPY requirements.txt .                     0.0s
 => [builder 2/2] RUN pip install...                          6.8s  ← downloads packages
 => [test 1/2] COPY app/ .                                    0.1s
 => [test 2/2] RUN pip install pytest...                      2.1s
 => [test 3/3] RUN python -m pytest tests/ -v                 1.8s
```

```
tests/test_app.py::test_home PASSED
tests/test_app.py::test_health PASSED
2 passed in 0.12s
```

Build stopped at `test` stage — no `final` stage was built ✅

---

### Step 3: Build the Full Final Image

```bash
docker buildx build \
  --target final \
  --secret id=api_key,src=./secret.txt \
  --load \
  -t myapp:latest \
  .
```
```
[+] Building 4.2s (14/14) FINISHED
 => [base ...] CACHED                    ← reused from previous build ✅
 => [builder ...] CACHED                 ← reused from previous build ✅
 => [test ...] CACHED                    ← reused from previous build ✅
 => [final 1/4] COPY --from=builder...  0.1s
 => [final 2/4] RUN --mount=type=secret 0.2s
 => [final 3/4] COPY app/app.py .       0.0s
 => [final 4/4] RUN useradd appuser     0.3s
```

**Observations:**
- All earlier stages used `CACHED` — second build is much faster
- `[final 2/4]` ran the secret mount instruction — secret was available only here
- Total build time dropped from 18s to 4s — layer cache working ✅

---

### Step 4: Observe Cache Mount Speed Up

Change `app.py` (modify the message text) then rebuild:

```bash
docker buildx build \
  --secret id=api_key,src=./secret.txt \
  --load \
  -t myapp:latest \
  .
```
```
 => [builder 2/2] RUN pip install...   0.4s  ← was 6.8s first time — cache mount ✅
```

**pip took 0.4s instead of 6.8s** — packages served from cache mount, not re-downloaded, even though `app.py` changed and the layer cache was invalidated. This is the `RUN --mount=type=cache` effect.

---

### Step 5: Image Size Comparison

```bash
docker images | grep myapp
```
```
REPOSITORY   TAG       SIZE
myapp        test      312MB    ← includes test tools + all build deps
myapp        latest    87MB     ← lean final image ✅
```

**Why the difference:**
```
test image:  python:3.13-slim + apt packages + pip packages + pytest + test files
             = 312MB — fine for CI, never deployed

final image: python:3.13-slim + apt packages + only /install (flask + gunicorn)
             = 87MB — deployed to production
```

The `final` stage starts fresh `FROM base` — it only copies `/install` from `builder`. It has no pip cache, no test tools, no pytest, no test files, no build artifacts. **73% smaller than the test image.**

---

### Step 6: Verify Secret Not in History

```bash
docker history myapp:latest --no-trunc | grep secret
```
```
(no output)   ← secret value not in any layer ✅
```

```bash
docker history myapp:latest
```
```
IMAGE         CREATED BY                                               SIZE
abc123        CMD ["python", "-m", "gunicorn" ...]                    0B
def456        EXPOSE 5000                                              0B
ghi789        USER appuser                                             0B
jkl012        RUN /bin/sh -c echo "Configuring with API key: ****"    0B
mno345        COPY app/app.py .                                        2KB
...
```

The actual secret value `super-secret-api-key-12345` appears nowhere ✅

---

## Concept 5 — `--cache-from` and `--cache-to` (CI/CD)

### The CI/CD Cache Problem

```
Local development:  Layer cache persists on your machine → fast rebuilds ✅

CI/CD pipeline:     Each pipeline run starts on a fresh runner → no cache → slow ❌
                    GitHub Actions runner: cold start, no Docker cache
                    GitLab CI runner: ephemeral container, cache gone after job
                    Jenkins: fresh workspace per build
```

Without cache export, every CI build downloads all packages and rebuilds all layers from scratch — even if nothing changed.

### `--cache-to` — Export Cache After Build

```bash
# After building, export the cache to a local directory
docker buildx build \
  --cache-to type=local,dest=/tmp/buildcache,mode=max \
  -t myapp:latest \
  --load \
  .
```

```
type=local      → store cache on filesystem
dest=           → where to write cache files
mode=max        → cache ALL layers (not just final stage layers)
mode=min        → cache only final stage layers (smaller, less useful)
```

### `--cache-from` — Restore Cache Before Build

```bash
# On next build, restore from the exported cache
docker buildx build \
  --cache-from type=local,src=/tmp/buildcache \
  -t myapp:latest \
  --load \
  .
```

All layers that match the cached ones will say `CACHED` — same as local layer cache but now portable.

### Registry Cache — For CI/CD Teams

The most common approach in production CI/CD: store cache in a container registry. Every runner can pull it regardless of which machine runs the job.

```bash
# Export cache to registry after build
docker buildx build \
  --cache-to type=registry,ref=myrepo/myapp:buildcache,mode=max \
  --push \
  -t myrepo/myapp:latest \
  .

# Import cache from registry on next build
docker buildx build \
  --cache-from type=registry,ref=myrepo/myapp:buildcache \
  --push \
  -t myrepo/myapp:latest \
  .
```

**GitHub Actions example:**

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v4

- name: Build and push
  uses: docker/build-push-action@v7
  with:
    push: true
    tags: myrepo/myapp:latest
    cache-from: type=registry,ref=myrepo/myapp:buildcache
    cache-to: type=registry,ref=myrepo/myapp:buildcache,mode=max
```

### Cache Types Summary

```
type=local      → filesystem — good for single-machine CI (Jenkins on same host)
type=registry   → container registry — best for cloud CI (GitHub Actions, GitLab)
type=gha        → GitHub Actions cache service — native GitHub integration
type=s3         → AWS S3 bucket — for AWS CodeBuild or self-hosted on AWS
type=azblob     → Azure Blob Storage — for Azure DevOps
```

---

## `--ssh` Mount — Theory

For builds that need to clone private Git repositories or access private package registries via SSH, BuildKit provides `--mount=type=ssh`:

```dockerfile
RUN --mount=type=ssh \
    pip install git+ssh://git@github.com/company/private-package.git
```

```bash
# Pass SSH agent to build
docker buildx build --ssh default .
```

The SSH key is forwarded from your local SSH agent — it is never copied into the image. Similar concept to `--mount=type=secret` but specifically for SSH agent forwarding. Most teams use HTTPS tokens (via `--secret`) rather than SSH in CI/CD — but `--ssh` is useful for developer machines where SSH keys are already configured.

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| Named stages (`AS name`) | Gives stages readable names for `--target` and `COPY --from=` |
| `--target <stage>` | Build only up to this stage — CI runs tests without building final image |
| Parallel stages | BuildKit auto-detects independent stages and builds them concurrently |
| `RUN --mount=type=cache` | Persistent package cache — not in image, survives rebuilds, speeds up pip/npm/apt |
| `RUN --mount=type=secret` | Secret available only during `RUN` — never in any layer or `docker history` |
| `ARG` for secrets | Never do this — ARG values are permanently visible in `docker history` |
| `--secret id=,src=` | Pass secret from file at build time |
| `--secret id=,env=` | Pass secret from environment variable at build time |
| `/run/secrets/<id>` | Where the secret is mounted inside the build container |
| `--cache-to type=local` | Export build cache to filesystem after build |
| `--cache-from type=local` | Restore build cache from filesystem before build |
| `--cache-to type=registry` | Export cache to container registry — portable across CI runners |
| `mode=max` | Cache all layers — use this, not `mode=min` |
| `.dockerignore` | Keep context small and prevent accidental secret inclusion |
| Image size | Final image should contain only runtime deps — measure with `docker images` |