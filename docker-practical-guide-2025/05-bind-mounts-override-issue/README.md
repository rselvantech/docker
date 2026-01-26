# Docker Bind Mounts and Volume Override Lab

## Lab Overview

This hands-on lab builds upon [03-data-volume-feedback-app](../03-data-volume-feedback-app/) and [04-docker-volumes-feedback-app](../04-docker-volumes-feedback-app/) to introduce bind mounts for development workflows. You'll discover the bind mount override problem, understand Docker's volume precedence rules, and learn how anonymous volumes can protect critical directories from being overridden.

**What you'll do:**
- Use bind mounts to map host directories to containers
- Encounter the "module not found" error when bind mounts override container files
- Understand Docker volume precedence and layering
- Use anonymous volumes to prevent specific directory overrides
- Test live HTML updates with bind mounts
- Discover why server code changes don't auto-reload (setting up for project 06)

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE

**Knowledge Requirements:**
- **REQUIRED:** Completion of [03-data-volume-feedback-app](../03-data-volume-feedback-app/) and [04-docker-volumes-feedback-app](../04-docker-volumes-feedback-app/)
- Understanding of named volumes
- Basic understanding of file systems and directory mounting

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand bind mounts and their use in development
2. ✅ Identify the bind mount override problem
3. ✅ Explain why node_modules disappears with bind mounts
4. ✅ Apply anonymous volumes to protect directories
5. ✅ Understand Docker's volume precedence rules
6. ✅ Recognize static file changes vs application code changes
7. ✅ Identify when nodemon/hot reload is needed

## Demo Application

### Same Feedback Application with Bind Mounts

This lab reuses the exact same feedback application from demos 03 and 04.

**For application details, refer to:**
- [03-data-volume-feedback-app README](../03-data-volume-feedback-app/README.md)

**Application Structure:**
```
05-bind-mounts-override-issue/
└── src/
    ├── server.js              # Same as demo 03
    ├── package.json           # Same as demo 03
    ├── Dockerfile             # Same as demo 03
    ├── pages/                 # Same as demo 03
    ├── styles/                # Same as demo 03
    ├── feedback/              # Backed by named volume
    ├── temp/                  # In container layer
    └── node_modules/          # THE PROBLEM - gets overridden!
```

**What's different:**
- Using bind mounts to map host source code to container
- Discovering volume override issues
- Learning volume precedence rules

## Understanding Bind Mounts

### What is a Bind Mount?

A bind mount maps a specific host directory/file directly to a container path.

**Syntax:**
```bash
docker run -v /host/path:/container/path image
# or
docker run -v $(pwd):/app image
```

**Key characteristics:**
- Direct mapping between host and container filesystems
- Changes on host immediately visible in container
- Changes in container immediately visible on host
- Two-way synchronization
- Host path must be absolute (or use `$(pwd)`)

### Bind Mount vs Volume

| Feature | Bind Mount | Named Volume |
|---------|-----------|--------------|
| **Location** | Anywhere on host | Docker-managed area |
| **Specify by** | Full host path | Volume name |
| **Use case** | Development, config files | Production data |
| **Performance** | Can be slower on Win/Mac | Optimized |
| **Control** | Full host control | Docker-managed |

### Why Use Bind Mounts in Development?

**Problem with normal development:**
1. Make code change in your editor
2. Rebuild Docker image (`docker build`)
3. Remove old container (`docker rm`)
4. Run new container (`docker run`)
5. Test changes
6. Repeat for every single change 😩

**Solution with bind mounts:**
1. Start container with bind mount once
2. Make code changes in your editor
3. Changes immediately available in container ✅
4. Much faster development cycle!

## Understanding the Override Problem

### Docker Volume Precedence Rules

When multiple volumes/mounts target overlapping paths, Docker follows these rules:

**Precedence (Highest to Lowest):**
1. **More specific path wins** - `/app/node_modules` beats `/app`
2. **Later mount wins** - If same specificity, last `-v` flag wins
3. **Anonymous volumes** can protect subdirectories

### The Override Scenario

**Container filesystem after `docker build`:**
```
/app/
├── server.js
├── package.json
├── pages/
├── styles/
├── feedback/
├── temp/
└── node_modules/          ← Installed during build
    ├── express/
    ├── body-parser/
    └── ...
```

**When you bind mount `$(pwd):/app`:**
```
Host directory ($(pwd)):        Container /app/ (after bind mount):
├── server.js                   ├── server.js         ← From host
├── package.json                ├── package.json      ← From host
├── pages/                      ├── pages/            ← From host
├── styles/                     ├── styles/           ← From host
├── feedback/                   ├── feedback/         ← From host
├── temp/                       ├── temp/             ← From host
├── Dockerfile                  ├── Dockerfile        ← From host
└── (no node_modules)           └── node_modules/     ← GONE! 💥
```

**Result:** The entire `/app` directory in container is replaced by your host directory, which doesn't have `node_modules/`!

## Lab Instructions

### Step 1: Setup - Copy Demo 03 Files

```bash
# Create project structure
mkdir -p 05-bind-mounts-override-issue/src
cd 05-bind-mounts-override-issue/src

# Copy all files from demo 03
cp -r ../../03-data-volume-feedback-app/src/* .
```

Refer to [03-data-volume-feedback-app](../03-data-volume-feedback-app/README.md) for complete file contents.

### Step 2: Build the Image

```bash
docker build -t feedback-app:bindmount .
```

### Step 3: Run WITHOUT Bind Mount (Baseline)

First, verify the app works normally:

```bash
docker run -d -p 8080:80 --name feedback-baseline \
  -v feedback-data:/app/feedback \
  feedback-app:bindmount
```

**Test:**
```
http://localhost:8080
```

✅ Works perfectly - submit some feedback to verify.

**Cleanup:**
```bash
docker stop feedback-baseline
docker rm feedback-baseline
```

### Step 4: Run WITH Bind Mount (Problem Occurs)

**4.1 Run with bind mount:**

```bash
docker run -d -p 8080:80 --name feedback-bindmount \
  -v feedback-data:/app/feedback \
  -v $(pwd):/app \
  feedback-app:bindmount
```

**Command breakdown:**
- `-v feedback-data:/app/feedback` - Named volume for persistent data
- `-v $(pwd):/app` - Bind mount entire host directory to `/app`

**4.2 Check container logs:**

```bash
docker logs feedback-bindmount
```

**Expected error:**
```
Error: Cannot find module 'express'
Require stack:
- /app/server.js
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:...)
    at Function.Module._load (internal/modules/cjs/loader.js:...)
    ...
```

**4.3 Try to access the app:**
```
http://localhost:8080
```

❌ **Connection refused or no response** - Container crashed due to `node_modules/` is missing in container**

**4.4 Check host directory:**

```bash
ls -la
```

You don't have `node_modules/` in your host directory either!

### Step 5: Understanding Why This Happens

**What happened step-by-step:**

1. **During `docker build`:**
   ```dockerfile
   WORKDIR /app
   COPY package.json .
   RUN npm install        # Creates /app/node_modules in IMAGE
   COPY . .
   ```
   - Image contains `/app/node_modules/` with all dependencies

2. **During `docker run` with `-v $(pwd):/app`:**
   - Docker mounts your host directory to `/app`
   - **Your host directory completely replaces** `/app` in container
   - `/app/node_modules/` from image is hidden/overridden
   - Container now sees host directory (which has no `node_modules/`)

3. **When Node.js starts:**
   - `require('express')` tries to load from `/app/node_modules/express`
   - Directory doesn't exist (it's on host, and host doesn't have it)
   - **Error: Cannot find module 'express'**

**Visual representation:**

```
Container /app before bind mount:
/app/
├── node_modules/  ← From IMAGE (has dependencies)
├── server.js
└── package.json

Container /app after bind mount $(pwd):/app:
/app/  ← COMPLETELY REPLACED by host directory
├── server.js      ← From HOST
├── package.json   ← From HOST
└── (node_modules is GONE - hidden by mount)
```

### Step 6: Solution - Anonymous Volume for node_modules

**6.1 Stop and remove failed container:**

```bash
docker stop feedback-bindmount
docker rm feedback-bindmount
```

**6.2 Run with anonymous volume protection:**

```bash
docker run -d -p 8080:80 --name feedback-protected \
  -v feedback-data:/app/feedback \
  -v /app/node_modules \
  -v $(pwd):/app \
  feedback-app:bindmount
```

**Command breakdown:**
- `-v feedback-data:/app/feedback` - Named volume for feedback data
- `-v /app/node_modules` - Anonymous volume to PROTECT node_modules
- `-v $(pwd):/app` - Bind mount source code

**Key insight:** Anonymous volume `-v /app/node_modules` is MORE SPECIFIC than `-v $(pwd):/app`, so it wins!

**6.3 Check logs:**

```bash
docker logs feedback-protected
```

No errors! Container started successfully.

**6.4 Access the app:**
```
http://localhost:8080
```

✅ **Works!** Submit feedback to verify.

**6.5 Verify node_modules exists:**

```bash
docker exec feedback-protected ls -la /app
docker exec feedback-protected ls -la /app/node_modules
```

**Output:**
```
/app:
node_modules/    ← Protected by anonymous volume!
server.js        ← From host bind mount
package.json     ← From host bind mount
pages/           ← From host bind mount
...

/app/node_modules:
express/
body-parser/
...
```

### Step 7: Understanding Volume Precedence

**How Docker resolved the conflict:**

```
Mount configuration:
1. -v feedback-data:/app/feedback     (most specific: /app/feedback)
2. -v /app/node_modules               (more specific: /app/node_modules)
3. -v $(pwd):/app                     (least specific: /app)

Result in container:
/app/                          ← From bind mount (host)
├── feedback/                  ← From named volume (feedback-data)
├── node_modules/              ← From anonymous volume (container's original)
├── server.js                  ← From bind mount (host)
├── package.json               ← From bind mount (host)
├── pages/                     ← From bind mount (host)
├── styles/                    ← From bind mount (host)
└── temp/                      ← From bind mount (host)
```

**Precedence rule applied:**
- `/app/feedback` wins over `/app` (more specific path)
- `/app/node_modules` wins over `/app` (more specific path)
- `/app` provides everything else

**Why this works:**
1. Bind mount `/app` tries to override everything
2. But anonymous volume `/app/node_modules` is more specific
3. Docker prioritizes more specific paths
4. Result: `node_modules` protected, rest comes from host

### Step 8: Test Live HTML Changes

Now let's see the benefit of bind mounts!

**8.1 Open `pages/feedback.html` in your editor**

**8.2 Make a visible change:**

```html
<h2>Your Feedback</h2>
<!-- Change to: -->
<h2>📝 Share Your Awesome Feedback!</h2>
```

**8.3 Save the file**

**8.4 Refresh browser (no rebuild, no restart!):**
```
http://localhost:8080
```

✅ **Change immediately visible!** The new heading appears instantly.

**8.5 Try CSS changes - Open `styles/styles.css`:**

```css
header {
  width: 100%;
  height: 5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #350035;
  /* Add: */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**8.6 Refresh browser:**

✅ **New gradient background appears!** No Docker rebuild needed.

**Why this works:**
- HTML and CSS are static files
- Nginx serves them directly from filesystem
- Bind mount makes host files instantly available
- No application restart needed

### Step 9: Test Server Code Changes (Limitation)

**9.1 Open `server.js` in your editor**

**9.2 Add console.log at the start of the file:**

```javascript
const fs = require('fs').promises;
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');

console.log('🚀 Server starting with LIVE RELOAD!');  // ← ADD THIS

const app = express();
// ... rest of the code
```

**9.3 Save the file**

**9.4 Check container logs:**

```bash
docker logs feedback-protected
```

❌ **Your new console.log does NOT appear!** 

**9.5 Try accessing the app:**
```
http://localhost:8080
```

App still works with OLD code.

### Step 10: Understanding the Limitation

**Why HTML/CSS changes work but server.js doesn't:**

**Static Files (HTML/CSS):**
```
Browser requests page
    ↓
Nginx/Express reads file from disk
    ↓
File is from bind mount (host)
    ↓
✅ Latest content served
```

**Server Code (server.js):**
```
Container starts
    ↓
Node.js loads server.js into memory
    ↓
Node.js process keeps running
    ↓
You change server.js on host
    ↓
Bind mount updates file on disk
    ↓
❌ Node.js process still uses OLD code in memory
    ↓
Need to restart Node.js process!
```

**The Problem:**
- Node.js is a **runtime process**, not a file server
- Code is loaded into memory at startup
- Changes to files don't affect running process
- Need to restart the process to load new code

**This is NOT a Docker problem - it's how Node.js works!**

Even without Docker:
```bash
node server.js        # Starts server
# Edit server.js
# Changes NOT applied - need Ctrl+C and restart!
```

**Solutions:**
1. Manual restart: `docker restart feedback-protected` (tedious)
2. **Use nodemon for hot reload** ← Next lab (06)!

### Step 11: Verify Volume Precedence with Inspection

**11.1 Inspect container mounts:**

```bash
docker inspect feedback-protected -f '{{ json .Mounts }}' | jq
```

**Output:**
```json
[
  {
    "Type": "volume",
    "Name": "feedback-data",
    "Source": "/var/lib/docker/volumes/feedback-data/_data",
    "Destination": "/app/feedback",
    "Mode": "z",
    "RW": true,
    "Propagation": ""
  },
  {
    "Type": "volume",
    "Name": "abc123...",
    "Source": "/var/lib/docker/volumes/abc123.../_data",
    "Destination": "/app/node_modules",
    "Mode": "",
    "RW": true,
    "Propagation": ""
  },
  {
    "Type": "bind",
    "Source": "/home/user/05-bind-mounts-override-issue/src",
    "Destination": "/app",
    "Mode": "",
    "RW": true,
    "Propagation": "rprivate"
  }
]
```

**Analysis:**
- Three mounts on the same container
- Different types: volume (named), volume (anonymous), bind
- Different destinations: most specific wins

### Step 12: Cleanup

```bash
# Stop and remove container
docker stop feedback-protected
docker rm feedback-protected

# Volume cleanup
docker volume rm feedback-data
docker volume prune -f

# Image cleanup
docker rmi feedback-app:bindmount
```

## Volume Precedence Deep Dive

### Rule 1: More Specific Path Wins

```bash
docker run \
  -v /app \                    # Specificity: 1 level
  -v /app/node_modules \       # Specificity: 2 levels (WINS)
  my-image
```

Result: `/app/node_modules` uses anonymous volume, rest uses first volume.

### Rule 2: Order Matters for Same Specificity

```bash
docker run \
  -v /data:/app \
  -v /other:/app \   # WINS - last one for same path
  my-image
```

Result: `/app` maps to `/other` (later mount overrides).

### Rule 3: Volume Types Don't Matter for Precedence

```bash
docker run \
  -v $(pwd):/app \              # Bind mount
  -v /app/node_modules \        # Anonymous volume (WINS - more specific)
  -v data:/app/uploads \        # Named volume (WINS - more specific)
  my-image
```

All three can coexist - specificity determines winner.

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker run -v $(pwd):/path` | Bind mount current directory |
| `docker run -v /abs/path:/path` | Bind mount absolute path |
| `docker run -v /path` | Anonymous volume |
| `docker inspect <c> -f '{{.Mounts}}'` | View container mounts |
| `docker run -v name:/path:ro` | Read-only mount |

## Troubleshooting

**"Cannot find module" error:**
```bash
# Verify node_modules protection
docker exec <container> ls /app/node_modules

# If missing, add anonymous volume
docker run -v /app/node_modules ...
```

**Bind mount path not found:**
```bash
# Ensure using absolute path
docker run -v $(pwd):/app ...   # ✅ Good
docker run -v ./src:/app ...    # ❌ Relative path fails
```

## What You Learned

In this lab, you:
- ✅ Understood bind mounts and their development use case
- ✅ Discovered the bind mount override problem (node_modules missing)
- ✅ Explained why container directories get hidden by bind mounts
- ✅ Applied anonymous volumes to protect specific directories
- ✅ Mastered Docker's volume precedence rules (specificity wins)
- ✅ Tested live updates for static files (HTML/CSS)
- ✅ Identified why server code changes don't auto-apply
- ✅ Recognized that Node.js hot reload needs nodemon (Project 06!)

**Key Takeaway:** Bind mounts are powerful for development, but require anonymous volumes to protect critical directories like `node_modules`. However, they don't solve the application hot reload problem - that needs nodemon!