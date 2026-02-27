# Dockerfile COPY Instruction

## Overview

This demo covers the `COPY` instruction in Dockerfile — the recommended way to copy local files and directories into a Docker image. It also covers how `.dockerignore` works, when it matters, and how BuildKit affects build context transfer.

**What you'll learn:**
- Copy a single file, directory, and rename on copy
- How `.dockerignore` filters the build context before the build starts
- How `.dockerignore` protects secrets when using `COPY .`
- What happens when you try to `COPY` a dockerignored file

---

## How `.dockerignore` Works

Here is the correct mental model — in order:

```
1. Build context is created from your project directory
        │
        ▼
2. .dockerignore filters it — excluded files are removed from context
        │
        ▼
3. COPY/ADD pulls files from that filtered context
        │
        ▼
4. BuildKit optimizes how data is transferred internally
         (but does NOT remove the concept of a build context)
```

`.dockerignore` always controls what is in the build context — regardless of which builder is used and regardless of what `COPY` references.

**When does `.dockerignore` matter most?**

When using `COPY .` — which copies everything remaining in the build context into the image:

```dockerfile
# Copies everything that is left in the build context after .dockerignore filtering
COPY . /usr/share/nginx/html/
```

- **Without `.dockerignore`** — build context contains everything including `secrets/` and `debug.log`. `COPY .` copies all of it into the image — secrets leak ❌
- **With `.dockerignore`** — build context is already filtered before `COPY .` runs. `secrets/` and `debug.log` are already gone — `COPY .` copies only what remains ✅

**What happens if you `COPY` a dockerignored file?**

The file does not exist in the build context — the build fails:

```
ERROR: failed to solve: lstat secrets/api-key.txt: no such file or directory
```

---

## Project Structure

```
03-dockerfile-copy-instruction/
├── src/
│   ├── app-files/
│   │   ├── index.html        # Main web page
│   │   └── style.css         # Stylesheet
│   ├── config/
│   │   └── nginx.conf        # Custom Nginx config
│   ├── secrets/              # Excluded via .dockerignore
│   │   └── api-key.txt
│   ├── debug.log             # Excluded via .dockerignore (large file ~39KB)
│   ├── .dockerignore
│   └── Dockerfile
└── README.md
```

---

## Application Files

**`app-files/index.html`**
```html
<!DOCTYPE html>
<html>
<head><title>COPY Demo</title><link rel="stylesheet" href="style.css"></head>
<body><h1>Hello from Dockerfile COPY Demo!</h1></body>
</html>
```

**`app-files/style.css`**
```css
body { font-family: Arial, sans-serif; background: #f0f8ff; text-align: center; }
h1 { color: #2c3e50; margin-top: 50px; }
```

**`config/nginx.conf`**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
}
```

**`secrets/api-key.txt`** *(sensitive file — must never go into an image)*
```
API_KEY=super-secret-12345
```

**`debug.log`** *(runtime log — generate a large file to make size difference visible)*
```bash
# Generate ~39KB log file using built-in yes command
yes "$(date '+%Y-%m-%d %H:%M:%S') DEBUG: App started - Loading config - Connection timeout - Retrying request" | head -500 > debug.log
```
---

## .dockerignore

```
# Exclude sensitive files - never bake secrets into images
secrets/

# Exclude logs and temp files - not needed in the image
*.log
*.tmp
```
---

## Understand Build Context Output

When you run `docker build`, notice two `transferring context` lines in the output:

```bash
docker build -t copy-demo . 2>&1
```

```
=> [internal] load .dockerignore
=> => transferring context: 178B    ← .dockerignore file loaded first

=> [internal] load build context
=> => transferring context: 171B    ← only app-files/ and config/ transferred
```

- **First line** — Docker loads `.dockerignore` first to know what to exclude from the build context
- **Second line** — the filtered build context (after `.dockerignore` applied) is transferred to the daemon

---

## Lab Instructions

### Step 1: Create Project Files

Create all files as shown in the **Application Files** section above.

---

### Step 2: Verify structure and file sizes:
```
tree -sha
[4.0K]  .
├── [ 136]  .dockerignore
├── [ 463]  Dockerfile
├── [4.0K]  app-files
│   ├── [ 163]  index.html
│   └── [ 122]  style.css
├── [4.0K]  config
│   └── [  79]  nginx.conf
├── [ 47K]  debug.log
└── [4.0K]  secrets
    └── [  26]  api-key.txt

4 directories, 7 files
```

---


### Step 3: Demo — `COPY .` Without `.dockerignore` (Secrets Leak!)

This shows why `.dockerignore` is critical when using `COPY .`.

**3.1 Update Dockerfile to use `COPY .`:**
```dockerfile
# Use nginx:alpine-slim as base Docker Image
FROM nginx:alpine-slim

# OCI Labels
LABEL org.opencontainers.image.authors="your-name"
LABEL org.opencontainers.image.title="Demo: COPY Instruction"

# Copy everything into the image
COPY . /usr/share/nginx/html/
```

**3.2 Rename `.dockerignore` so it has no effect:**
```bash
cd 03-dockerfile-copy-instruction/src

mv .dockerignore .dockerignore.bak
```

**3.3 Build and check context size:**
```bash
docker build --no-cache -t copy-demo-unsafe . 2>&1 | grep "transferring context"
```
```
transferring context: 2B      ← no .dockerignore found
transferring context: 40kB    ← everything transferred including secrets/ and debug.log ❌
```

**3.4 Verify secrets leaked into the image:**
```bash
docker run --rm copy-demo-unsafe ls -lsh /usr/share/nginx/html/
```

```
# secrets/ and debug.log inside image! ❌

total 72K
   4.0K -rw-r--r--    1 root     root         497 Feb  4 20:18 50x.html
   4.0K -rw-r--r--    1 root     root         258 Feb 26 23:02 Dockerfile
   4.0K drwxr-xr-x    2 root     root        4.0K Feb 26 11:41 app-files
   4.0K drwxr-xr-x    2 root     root        4.0K Feb 26 10:57 config
  48.0K -rw-r--r--    1 root     root       46.9K Feb 26 22:36 debug.log
   4.0K -rw-r--r--    1 root     root         615 Feb  4 20:18 index.html
   4.0K drwxr-xr-x    2 root     root        4.0K Feb 26 10:58 secrets
```

---

### Step 4: Demo — `COPY .` With `.dockerignore` (Secrets Protected)

**4.1 Restore `.dockerignore` (keep `COPY .` in Dockerfile from Step 3):**
```bash
mv .dockerignore.bak .dockerignore
```

**4.2 Build and check context size:**
```bash
docker build --no-cache -t copy-demo-safe . 2>&1 | grep "transferring context"
```
```
transferring context: 178B    ← .dockerignore loaded
transferring context: 377B    ← only Dockerfile, app-files/, config/ transferred
                                 secrets/ and debug.log excluded ✅
```

**4.3 Verify secrets are NOT in the image:**
```bash
docker run --rm copy-demo-safe ls -lsh /usr/share/nginx/html/
```
```
# no secrets/, no debug.log ✅

total 20K
   4.0K -rw-r--r--    1 root     root         497 Feb  4 20:18 50x.html
   4.0K -rw-r--r--    1 root     root         258 Feb 26 23:02 Dockerfile
   4.0K drwxr-xr-x    2 root     root        4.0K Feb 26 11:41 app-files
   4.0K drwxr-xr-x    2 root     root        4.0K Feb 26 10:57 config
   4.0K -rw-r--r--    1 root     root         615 Feb  4 20:18 index.html
```

>**Note**: The build context dropped from `40kB` → `377B` and secrets are protected — `.dockerignore` worked.

---

### Step 5: Demo — Build Fails When COPYing a Dockerignored File

This proves that dockerignored files are completely absent from the build context.

**5.1 Add an explicit `COPY` for the ignored file (keep `COPY .` and `.dockerignore` active):**
```dockerfile
# Use nginx:alpine-slim as base Docker Image
FROM nginx:alpine-slim

# OCI Labels
LABEL org.opencontainers.image.authors="your-name"
LABEL org.opencontainers.image.title="Demo: COPY Instruction"

# Copy everything
COPY . /usr/share/nginx/html/

# Explicitly try to copy an ignored file — this will fail
COPY secrets/api-key.txt /app/api-key.txt
```

**5.2 Build:**
```bash
docker build -t copy-demo-fail .
```

**Expected error:**
```
=> [internal] load build context
=> => transferring context: 571B     ← secrets/ not in context

=> COPY secrets/api-key.txt /app/api-key.txt
ERROR: failed to solve: lstat secrets/api-key.txt: no such file or directory  ❌
```

The file does not exist from Docker's perspective — `.dockerignore` removed it from the build context before `COPY` even ran.

---

### Step 6: Build and Run Final Image

Revert `Dockerfile` with three different types of `COPY` lines:

```dockerfile
# Use nginx:alpine-slim as base Docker Image
FROM nginx:alpine-slim

# OCI Labels
LABEL org.opencontainers.image.authors="your-name"
LABEL org.opencontainers.image.title="Demo: COPY Instruction"

# Example 1: Copy a single file
COPY app-files/index.html /usr/share/nginx/html/index.html

# Example 2: Copy an entire directory
COPY app-files/ /usr/share/nginx/html/

# Example 3: Copy and rename at destination
COPY config/nginx.conf /etc/nginx/conf.d/default.conf
```

```bash
docker build -t copy-demo .
docker run -d -p 8080:80 --name copy-demo copy-demo
```

Open in browser: `http://localhost:8080`

---

### Step 7: Cleanup

```bash
docker stop copy-demo
docker rm copy-demo
docker rmi copy-demo copy-demo-safe copy-demo-unsafe copy-demo-fail
```

---

## Key Takeaways

| Feature | COPY Behavior |
|---|---|
| Single file | ✅ Copies to exact destination path |
| Directory | ✅ Copies all contents to destination |
| Rename on copy | ✅ Specify new filename in destination |
| URL support | ❌ Not supported — use ADD for URLs |
| Tar extraction | ❌ Not supported — use ADD for tar files |
| `.dockerignore` with specific `COPY` paths | ✅ Filters build context — excluded files cannot be copied |
| `.dockerignore` with `COPY .` | ✅ **Essential** — only protection against secrets and large files entering the image |
| `COPY` on dockerignored file | ❌ Build fails — file does not exist in build context |

> **Best Practice:** Use `COPY` with specific paths wherever possible. When you must use `COPY .`, always have a `.dockerignore` to protect secrets and exclude unnecessary files.