# Dockerfile ADD Instruction

## Overview

This demo covers the `ADD` instruction in Dockerfile. While `ADD` works like `COPY` for local files, it has three extra capabilities that `COPY` does not:

1. **Auto-extract tar archives** into the image
2. **Fetch a file from a public HTTP/HTTPS URL** at build time
3. **Clone a Git repository** (or a specific subdirectory/branch/tag) at build time

> **Best Practice:** Use `COPY` for all local file copies. Use `ADD` only when you need one of the above three capabilities.

---

## ADD vs COPY — Key Difference

| Feature | COPY | ADD |
|---|---|---|
| Copy local files | ✅ | ✅ |
| Auto-extract tar archives | ❌ | ✅ |
| Fetch from HTTP/HTTPS URL | ❌ | ✅ |
| Clone from Git repository | ❌ | ✅ (requires BuildKit) |

---

## `.dockerignore` with ADD

`.dockerignore` works exactly the same way as with `COPY` — it filters the build context before `ADD` runs. Refer to [Demo 03 - Dockerfile COPY Instruction](../03-dockerfile-copy-instruction/README.md) for a detailed explanation and hands-on demo.

---

## Git URL Syntax

```
ADD <git-url>#<ref>:<subdirectory> <destination>

# Examples:
ADD https://github.com/user/repo.git /app                        # clone main branch
ADD https://github.com/user/repo.git#main /app                   # specific branch
ADD https://github.com/user/repo.git#v1.0.0 /app                 # specific tag
ADD https://github.com/user/repo.git#abc1234 /app                # specific commit
ADD https://github.com/user/repo.git#main:src/docs /app/docs     # specific subdirectory
```

> **Requires BuildKit** — enabled by default in Docker Desktop and Docker Engine v23.0+.

---

## Project Structure

```
04-dockerfile-add-instruction/
├── src/
│   ├── static-site.tar.gz    # Local tar archive — auto-extracted by ADD
│   ├── .dockerignore
│   └── Dockerfile
└── README.md
```

---

## Create `static-site.tar.gz`

```bash
mkdir static-site
cat > static-site/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>ADD Demo</title></head>
<body>
  <h1>Extracted from tar.gz using ADD!</h1>
  <p><a href="/bootstrap.min.css">Bootstrap CSS (fetched from CDN)</a></p>
  <p><a href="/nginx-license.txt">Nginx License (fetched from GitHub raw URL)</a></p>
</body>
</html>
EOF
echo 'body { font-family: Arial; background: #e8f5e9; text-align: center; }' > static-site/style.css
tar -czf static-site.tar.gz -C static-site .
rm -rf static-site
```

Verify archive contents:
```bash
tar -tzf static-site.tar.gz
```
```
./index.html
./style.css
```

---

**Create `static-site.tar.gz`:**
```bash
tar -czf static-site.tar.gz -C static-site .
```

**Command breakdown:**

| Flag | Meaning |
|---|---|
| `-c` | Create a new archive |
| `-z` | Compress using gzip (`.gz`) |
| `-f static-site.tar.gz` | Output filename |
| `-C static-site` | Change into `static-site/` directory before archiving (same as `cd static-site`) |
| `.` | Archive everything in the current directory (i.e. contents of `static-site/`) |

**Why `-C static-site .` and not `static-site/`?**
```bash
# With -C static-site .  — archives the CONTENTS of the folder
tar -czf static-site.tar.gz -C static-site .

# Inside the tar:
./index.html
./style.css

# When ADD extracts to /usr/share/nginx/html/:
/usr/share/nginx/html/index.html   ✅
/usr/share/nginx/html/style.css    ✅
```
```bash
# Without -C — archives the FOLDER ITSELF
tar -czf static-site.tar.gz static-site/

# Inside the tar:
static-site/index.html
static-site/style.css

# When ADD extracts to /usr/share/nginx/html/:
/usr/share/nginx/html/static-site/index.html   ❌ extra folder level!
/usr/share/nginx/html/static-site/style.css    ❌ extra folder level!
```

> `-C` means `Change directory`, it tells tar to **change into** the specified directory first before archiving — so the folder name itself is never included in the archive, only its contents.

So:
```bash
tar -czf static-site.tar.gz -C static-site .
```
Is equivalent to:
```bash
cd static-site
tar -czf ../static-site.tar.gz .
cd ..
```

---

## .dockerignore

```
# Exclude logs and temp files
*.log
*.tmp
```

---

## Dockerfile

```dockerfile
# Use nginx:alpine-slim as base Docker Image
FROM nginx:alpine-slim

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: ADD Instruction"

# Example 1: Auto-extract a local tar archive
# Real use case: deploy a pre-packaged release artifact directly
# ADD automatically extracts .tar.gz into the destination — no manual tar command needed
ADD static-site.tar.gz /usr/share/nginx/html/

# Example 2: Fetch a file from a public HTTPS URL
# Real use case: pull a CSS framework from CDN at build time
ADD https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css \
    /usr/share/nginx/html/bootstrap.min.css

# Example 3: Fetch a raw file from GitHub
# Real use case: pull a config, script or asset directly from a GitHub repo
ADD https://raw.githubusercontent.com/nginxinc/docker-nginx/master/LICENSE \
    /usr/share/nginx/html/nginx-license.txt

# Example 4: Clone a specific subdirectory from a GitHub repo at a specific tag
# Real use case: pull only the docs folder from an open source project at a specific release
# Requires BuildKit (enabled by default in Docker Desktop and Docker Engine v23.0+)
ADD https://github.com/moby/buildkit.git#v0.13.0:docs /usr/share/nginx/html/buildkit-docs
```

> **Note:** Examples 2, 3, and 4 require internet access during `docker build`.

---

## Lab Instructions

### Step 1: Create Project Files

Create `static-site.tar.gz`, `.dockerignore`, and `Dockerfile` as shown above.

---

### Step 2: Build the Image

```bash
cd 04-dockerfile-add-instruction/src

docker build -t add-demo .
```

During build you will see Docker fetching from URLs and cloning from GitHub:
```
=> ADD https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css
=> ADD https://raw.githubusercontent.com/nginxinc/docker-nginx/master/LICENSE
=> ADD https://github.com/moby/buildkit.git#v0.13.0:docs
```

---

### Step 3: Run the Container

```bash
docker run -d -p 8080:80 --name add-demo add-demo
```

---

### Step 4: Verify Tar Auto-Extraction (Example 1)

```bash
docker exec add-demo ls -l /usr/share/nginx/html/
```

Expected — tar contents extracted, no `.tar.gz` file present:
```
bootstrap.min.css  buildkit-docs  index.html  nginx-license.txt  style.css  ✅
```

The `.tar.gz` is not there — `ADD` extracted its contents directly. If you had used `COPY static-site.tar.gz`, the tar file would have been copied as-is without extraction.

**Confirm this difference:**
```bash
# Replace ADD with COPY in Dockerfile for the tar line, rebuild and check:
docker build --no-cache -t copy-tar-demo .
docker run --rm copy-tar-demo ls /usr/share/nginx/html/
```
```
static-site.tar.gz   ← copied as-is, NOT extracted ❌
```

---

### Step 5: Verify URL Fetch (Example 2)

```bash
# Check Bootstrap CSS was fetched from CDN
docker exec add-demo wc -c /usr/share/nginx/html/bootstrap.min.css
```
```
159959 /usr/share/nginx/html/bootstrap.min.css   ← fetched from CDN at build time ✅
```

---

### Step 6: Verify GitHub Raw URL Fetch (Example 3)

```bash
docker exec add-demo head -5 /usr/share/nginx/html/nginx-license.txt
```

You should see the first few lines of the nginx LICENSE file fetched directly from GitHub raw URL ✅

---

### Step 7: Verify Git Repo Subdirectory Clone (Example 4)

```bash
# List files cloned from the buildkit docs subdirectory at tag v0.13.0
docker exec add-demo ls - /usr/share/nginx/html/buildkit-docs/
```

You should see the markdown docs files from the BuildKit repository at that specific tag ✅

**Key differences between Example 3 and Example 4:**

| | Example 3 (raw URL) | Example 4 (Git URL) |
|---|---|---|
| What is fetched | A single file | Entire directory from a repo |
| Format | `https://raw.githubusercontent.com/...` | `https://github.com/repo.git#ref:subdir` |
| Use case | Single config/asset file | Entire set of files from a repo/branch/tag |
| Requires BuildKit | No | Yes |

---

### Step 8: Test in Browser

Open: `http://localhost:8080` — page from extracted tar with links to fetched resources.

---

### Step 9: Cleanup

```bash
docker stop add-demo
docker rm add-demo
docker rmi add-demo copy-tar-demo
```

---

## Key Takeaways

| Feature | ADD Behavior |
|---|---|
| Local tar archive (`ADD file.tar.gz /dest/`) | ✅ Auto-extracted into destination |
| `COPY` with tar archive | ❌ Copied as-is — not extracted |
| Public HTTPS URL | ✅ File fetched from URL at build time |
| GitHub raw URL | ✅ Single file fetched directly from GitHub at build time |
| Git repo clone (`ADD repo.git#ref:subdir /dest/`) | ✅ Entire repo or subdirectory cloned at specific branch/tag/commit |
| Git URL requires BuildKit | ✅ Default in Docker Desktop and Docker Engine v23.0+ |
| `.dockerignore` | ✅ Filters build context before ADD runs — same as COPY |
| URL authentication | ❌ Not supported — use `RUN curl` or `RUN wget` for authenticated URLs |
| Security with URLs | ⚠️ Always use trusted URLs — content is fetched at build time and baked into the image |