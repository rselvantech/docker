# Dockerfile CMD and ENTRYPOINT Instructions

## Overview

This demo covers two Dockerfile instructions that control what runs when a container starts:

- **`CMD`** — sets the default command or arguments for the container, easily overridable
- **`ENTRYPOINT`** — sets the fixed main executable for the container, rarely changed

**Real-world use case:** Build a **network diagnostic tool container** that always runs `curl` as its main executable. Users pass URLs and flags directly to `docker run` — just like running a native CLI tool.

```bash
# Container behaves like a curl command
docker run curl-tool https://example.com
docker run curl-tool -I https://example.com
docker run curl-tool --help
```

---

## Key Concepts

### CMD
- Sets the **default command** to run when container starts
- Fully overridable by passing arguments to `docker run`
- Only the **last CMD** in a Dockerfile takes effect

```dockerfile
CMD ["nginx", "-g", "daemon off;"]   # default command
```

```bash
docker run my-image                  # runs: nginx -g daemon off;
docker run my-image /bin/sh          # runs: /bin/sh  (CMD overridden)
```

### ENTRYPOINT
- Sets the **fixed main executable** — always runs
- Makes the container behave like a standalone executable
- Arguments passed to `docker run` are **appended** to ENTRYPOINT
- Override only with `--entrypoint` flag

```dockerfile
ENTRYPOINT ["curl"]
```

```bash
docker run curl-tool https://example.com    # runs: curl https://example.com
docker run curl-tool -I https://example.com # runs: curl -I https://example.com
```

### CMD + ENTRYPOINT Together
When used together, `ENTRYPOINT` is the executable and `CMD` provides the **default arguments**:

```dockerfile
ENTRYPOINT ["curl"]
CMD ["--help"]        # default args — shown if no args passed to docker run
```

```bash
docker run curl-tool                        # runs: curl --help   (CMD used)
docker run curl-tool https://example.com    # runs: curl https://example.com  (CMD replaced)
```

### Shell Form vs Exec Form

| | Shell Form | Exec Form |
|---|---|---|
| **Syntax** | `CMD nginx -g daemon` | `CMD ["nginx", "-g", "daemon"]` |
| **Runs via** | `/bin/sh -c` | Directly — no shell |
| **Signal handling** | ❌ Poor — shell intercepts signals | ✅ Good — process receives signals directly |
| **Recommended** | Simple one-liners | Always preferred for CMD and ENTRYPOINT |

> **Always use Exec form** `["executable", "param"]` for `CMD` and `ENTRYPOINT` — it ensures proper signal 
> handling (e.g. `SIGTERM` on `docker stop`).Shell form runs via `/bin/sh -c` which means the shell becomes
> PID 1 instead of your process — this can cause signal handling issues in production.

---

## Project Structure

```
06-dockerfile-cmd-entrypoint/
├── src/
│   ├── entrypoint.sh       # Wrapper script — real-world ENTRYPOINT pattern
│   ├── .dockerignore
│   └── Dockerfile
└── README.md
```

---

## Application Files

**`src/entrypoint.sh`** — wrapper script that adds default headers to every curl call:
```bash
#!/bin/sh
# Real-world pattern: wrapper script as ENTRYPOINT
# Adds default behaviour before passing all args to curl
echo "==> Running curl diagnostic tool"
echo "==> Target: $@"
echo "---"
exec curl "$@"
```

**`src/.dockerignore`**
```
*.log
*.tmp
```

---

## Dockerfile

**create a file , Filename :** `src/Dockerfile`

```dockerfile
# Use alpine as base — lightweight, has curl available
FROM alpine:latest

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: CMD + ENTRYPOINT"
LABEL org.opencontainers.image.description="Network diagnostic curl tool container"

# Install curl
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy entrypoint wrapper script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# ENTRYPOINT — fixed executable, always runs
# Using exec form for proper signal handling
ENTRYPOINT ["/app/entrypoint.sh"]

# CMD — default arguments passed to ENTRYPOINT if no args given at docker run
CMD ["--help"]
```

---

## Lab Instructions

### Step 1: Create Project Files

Create `entrypoint.sh`, `.dockerignore`, and `Dockerfile` as shown above.

Make `entrypoint.sh` executable:
```bash
cd 06-dockerfile-cmd-entrypoint/src

chmod +x entrypoint.sh
```

---

### Step 2: Build the Image

```bash
docker build -t curl-tool .
```

---

### Step 3: CMD Default — No Arguments

When no arguments are passed, `CMD ["--help"]` is used:

```bash
docker run --rm curl-tool
```
```
==> Running curl diagnostic tool
==> Target: --help
---
Usage: curl [options...] <url>
...curl help output...
```

---

### Step 4: Override CMD — Pass a URL

Arguments passed to `docker run` replace `CMD` and are appended to `ENTRYPOINT`:

```bash
docker run --rm curl-tool https://httpbin.org/get
```
```
==> Running curl diagnostic tool
==> Target: https://httpbin.org/get
---
{
  "headers": { ... },
  "url": "https://httpbin.org/get"
}
```

---

### Step 5: Pass Multiple Flags

Any curl flags work — they are all passed through to the ENTRYPOINT:

```bash
# Fetch only headers
docker run --rm curl-tool -I https://httpbin.org/get

# Silent mode with output file
docker run --rm curl-tool -s -o /dev/null -w "%{http_code}" https://httpbin.org/get

# Follow redirects
docker run --rm curl-tool -L https://github.com
```

This is the power of `ENTRYPOINT` — the container **behaves like a native CLI tool**.

---

### Step 6: Override ENTRYPOINT

Use `--entrypoint` to completely replace the ENTRYPOINT:

```bash
# Override to get a shell inside the container
docker run --rm --entrypoint /bin/sh curl-tool

# Override to run a different command
docker run --rm --entrypoint wget curl-tool https://httpbin.org/get
```

---

### Step 7: CMD Only (No ENTRYPOINT) Demo

To clearly show CMD behaviour on its own, temporarily use this Dockerfile:

```dockerfile
FROM alpine:latest
RUN apk add --no-cache curl
CMD ["curl", "--help"]
```

```bash
docker build -t cmd-only-demo .

# Uses default CMD
docker run --rm cmd-only-demo

# CMD fully replaced — curl never runs
docker run --rm cmd-only-demo echo "hello"
```
```
hello    ← curl completely replaced by echo ✅
```

With `ENTRYPOINT`, you cannot accidentally replace the main executable this way — `echo hello` would be passed as arguments TO curl, not replace it.

---

### Step 8: ENTRYPOINT Only (No CMD) Demo

```dockerfile
FROM alpine:latest
RUN apk add --no-cache curl
ENTRYPOINT ["curl"]
```

```bash
docker build -t entrypoint-only-demo .

# No args — curl runs with no URL, shows error
docker run --rm entrypoint-only-demo

# Pass URL — works perfectly
docker run --rm entrypoint-only-demo https://httpbin.org/get
```

---

### Step 9: Cleanup

```bash
docker rmi curl-tool cmd-only-demo entrypoint-only-demo
```

---

## CMD vs ENTRYPOINT — Decision Guide

| Scenario | Use |
|---|---|
| Container runs a single fixed tool (curl, ping, ffmpeg) | `ENTRYPOINT` |
| Container has a default command but user might change it | `CMD` |
| Fixed tool with sensible default args | `ENTRYPOINT` + `CMD` together |
| General purpose container (nginx, python) | `CMD` only |
| Wrapper script with setup before main process | `ENTRYPOINT` script + `CMD` args |

## Key Takeaways

| | `CMD` | `ENTRYPOINT` |
|---|---|---|
| **Purpose** | Default command or args | Fixed main executable |
| **Override** | Pass args to `docker run` | `--entrypoint` flag only |
| **When used together** | Provides default args to ENTRYPOINT | The executable |
| **Form** | Always use exec form `["cmd"]` | Always use exec form `["cmd"]` |
| **Signal handling** | Exec form required for proper signals | Exec form required for proper signals |

> **Best Practices:**
> - Always use **exec form** `["executable", "arg"]` — never shell form for production
> - Use `ENTRYPOINT` for containers that act as executables or tools
> - Use `CMD` for containers where the default command might need to change
> - Combine both: `ENTRYPOINT` for the fixed process, `CMD` for overridable defaults
> - Use a wrapper shell script as `ENTRYPOINT` for complex startup logic