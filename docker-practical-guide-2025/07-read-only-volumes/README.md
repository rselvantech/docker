# Docker Read-Only Volumes Lab

## Lab Overview

This hands-on lab builds upon [03-data-volume-feedback-app](../03-data-volume-feedback-app/), [05-bind-mounts-override-issue](../05-bind-mounts-override-issue/), and [06-bind-mounts-nodemon-hot-reload](../06-bind-mounts-nodemon-hot-reload/) to introduce read-only volume mounts. You'll learn how to protect source code from accidental modification by containers while maintaining write access to specific directories that need it.

**What you'll do:**
- Understand the difference between read-write and read-only volumes
- Make bind mounts read-only to protect source code
- Use volume precedence to allow writes to specific subdirectories
- Apply security best practices for container file access
- Test read-only enforcement

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE

**Knowledge Requirements:**
- **REQUIRED:** Completion of [06-bind-mounts-nodemon-hot-reload](../06-bind-mounts-nodemon-hot-reload/)
- Understanding of bind mounts and volume precedence
- Familiarity with named and anonymous volumes

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand read-write vs read-only volume modes
2. ✅ Make bind mounts read-only using `:ro` flag
3. ✅ Identify directories that need write access
4. ✅ Use volume precedence to override read-only restrictions
5. ✅ Apply security best practices for production containers
6. ✅ Test and verify read-only enforcement

## Demo Application

### Same Feedback Application with Read-Only Protection

This lab reuses the exact same feedback application from previous demos.

**For application details, refer to:**
- [03-data-volume-feedback-app README](../03-data-volume-feedback-app/README.md)

**Application Structure:**
```
07-read-only-volumes/
└── src/
    ├── server.js              # Same as demo 03
    ├── package.json           # Same as demo 06 (with nodemon)
    ├── Dockerfile             # Same as demo 06
    ├── pages/                 # Same as demo 03
    ├── styles/                # Same as demo 03
    ├── feedback/              # Needs WRITE access
    └── temp/                  # Needs WRITE access
```

**What's different:**
- Bind mount is read-only (`:ro`)
- `feedback/` writable via named volume
- `temp/` writable via anonymous volume
- Source code protected from container modifications

## Understanding Read-Only Volumes

### Default Volume Behavior: Read-Write

By default, all Docker volumes are **read-write** (rw):

```bash
docker run -v /host/path:/container/path image
# Container can READ and WRITE to /container/path
```

**What this means:**
- Container can read files from the volume ✅
- Container can modify existing files ✅
- Container can create new files ✅
- Container can delete files ✅

### Read-Only Volume Mode

You can restrict volumes to **read-only** (ro):

```bash
docker run -v /host/path:/container/path:ro image
# Container can only READ from /container/path
```

**What this means:**
- Container can read files from the volume ✅
- Container CANNOT modify files ❌
- Container CANNOT create new files ❌
- Container CANNOT delete files ❌

**Host machine:**
- Can still modify files normally ✅
- Read-only applies ONLY to container ✅

### Why Use Read-Only Volumes?

**Security & Safety:**
1. **Prevent accidental modifications** - Container can't corrupt source code
2. **Enforce immutability** - Source code should only change from host
3. **Clear intentions** - Makes it explicit what the container should/shouldn't modify
4. **Production best practice** - Reduces attack surface

**Common use cases for read-only:**
- Source code (bind mounts)
- Configuration files
- Static assets
- Certificates and keys
- Reference data

**Common use cases for read-write:**
- Database data directories
- Log files
- User uploads
- Application-generated files
- Cache directories

## The Read-Only Challenge

### Problem: Application Needs to Write

In our feedback app:

```javascript
// server.js needs to write files!
const tempFilePath = path.join(__dirname, 'temp', title + '.txt');
const finalFilePath = path.join(__dirname, 'feedback', title + '.txt');

await fs.writeFile(tempFilePath, content);  // Writes to temp/
await handle.writeFile(content);            // Writes to feedback/
```

**If we make entire `/app` read-only:**
```bash
docker run -v $(pwd):/app:ro feedback-app
```

**Result:** ❌ Application crashes! Can't write to `temp/` or `feedback/`

### Solution: Volume Precedence to the Rescue

**Strategy:**
1. Make bind mount read-only (protects source code)
2. Add writable volumes for specific subdirectories
3. More specific paths override less specific paths

**Implementation:**
```bash
docker run \
  -v $(pwd):/app:ro \              # Read-only for everything
  -v feedback-data:/app/feedback \ # Writable for feedback (more specific)
  -v /app/temp \                   # Writable for temp (more specific)
  feedback-app
```

**Result:**
- `/app/` = Read-only (source code protected)
- `/app/feedback/` = Read-write (can save feedback)
- `/app/temp/` = Read-write (can create temp files)
- `/app/node_modules/` = Read-only (from anonymous volume in previous labs)

## Lab Instructions

### Step 1: Setup - Copy Demo 06 Files

```bash
# Create project structure
mkdir -p 07-read-only-volumes/src
cd 07-read-only-volumes/src

# Copy all files from demo 06
cp -r ../../06-bind-mounts-nodemon-hot-reload/src/* .
```

Refer to [03-data-volume-feedback-app](../03-data-volume-feedback-app/README.md) for file contents and [06-bind-mounts-nodemon-hot-reload](../06-bind-mounts-nodemon-hot-reload/README.md) for nodemon setup.

### Step 2: Review Current Dockerfile

Check that your Dockerfile does NOT have `VOLUME` instruction for temp:

```dockerfile
FROM node:25
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 80
CMD ["npm", "run", "dev"]
```

**Important:** Remove `VOLUME ["/app/temp"]` if present in Dockerfile. Anonymous volumes must be specified in `docker run` command to properly override bind mounts.

### Step 3: Build the Image

```bash
docker build -t feedback-app:readonly .
```

### Step 4: Run WITHOUT Read-Only (Baseline)

First, verify everything works with standard read-write volumes:

```bash
docker run -d -p 8080:80 --name feedback-baseline \
  -v feedback-data:/app/feedback \
  -v /app/node_modules \
  -v $(pwd):/app \
  feedback-app:readonly
```

**Test:**
```
http://localhost:8080
```

Submit feedback to ensure it works.

**Cleanup:**
```bash
docker stop feedback-baseline
docker rm feedback-baseline
```

### Step 5: Run WITH Read-Only Bind Mount (Problem)

**5.1 Try read-only without writable subdirectories:**

```bash
docker run -d -p 8080:80 --name feedback-readonly-broken \
  -v feedback-data:/app/feedback \
  -v /app/node_modules \
  -v $(pwd):/app:ro \
  feedback-app:readonly
```

**Note the `:ro` flag** at the end of the bind mount!

**5.2 Check logs:**

```bash
docker logs feedback-readonly-broken
```

**5.3 Try to submit feedback:**
```
http://localhost:8080
```

Fill out form and submit.

**5.4 Check logs again:**

```bash
docker logs -f feedback-readonly-broken
```

**Expected error:**
```
Error: EROFS: read-only file system, open '/app/temp/test.txt'
```

❌ **Application crashes!** The `temp/` directory is read-only because it's part of the read-only bind mount.

**5.5 Cleanup:**
```bash
docker stop feedback-readonly-broken
docker rm feedback-readonly-broken
```

### Step 6: Understanding the Problem

**What happened:**

```
Mount configuration (broken):
-v feedback-data:/app/feedback    ← Writable (named volume)
-v /app/node_modules              ← Read-only (from bind mount)
-v $(pwd):/app:ro                 ← Read-only for EVERYTHING

Container filesystem:
/app/                    ← Read-only (from bind mount)
├── feedback/            ← Writable (named volume overrides)
├── temp/                ← Read-only (no override!) 💥
├── node_modules/        ← Read-only (anonymous volume)
└── server.js            ← Read-only (from bind mount)
```

**The issue:**
- `feedback/` is writable (named volume overrides read-only bind mount) ✅
- `temp/` is read-only (no override, inherits from bind mount) ❌
- Application tries to write to `temp/` → EROFS error

### Step 7: Solution - Add Writable Volume for Temp

**7.1 Run with proper configuration:**

```bash
docker run -d -p 8080:80 --name feedback-readonly \
  -v feedback-data:/app/feedback \
  -v /app/temp \
  -v /app/node_modules \
  -v $(pwd):/app:ro \
  feedback-app:readonly
```

**Complete volume configuration:**
- `-v feedback-data:/app/feedback` - Named volume (writable)
- `-v /app/temp` - Anonymous volume (writable)
- `-v /app/node_modules` - Anonymous volume (writable)
- `-v $(pwd):/app:ro` - Bind mount (read-only)

**Volume precedence applied:**
```
Most specific → Least specific:
1. /app/feedback      ← Named volume (writable)
2. /app/temp          ← Anonymous volume (writable)
3. /app/node_modules  ← Anonymous volume (writable)
4. /app               ← Bind mount (read-only)
```

**7.2 Check logs:**

```bash
docker logs feedback-readonly
```

No errors - nodemon should be running.

**7.3 Test the application:**
```
http://localhost:8080
```

**7.4 Submit feedback:**
- Title: `readonly-test`
- Text: `Testing read-only volumes with writable exceptions!`
- Click Save

✅ **Works!** Feedback saved successfully.

**7.5 Verify file creation:**

```bash
docker exec feedback-readonly ls -la /app/feedback
docker exec feedback-readonly ls -la /app/temp
```

Both directories should show files were created.

### Step 8: Test Read-Only Enforcement

**8.1 Try to create a file in read-only area:**

```bash
docker exec feedback-readonly touch /app/test-readonly.txt
```

**Expected error:**
```
touch: cannot touch '/app/test-readonly.txt': Read-only file system
```

✅ **Read-only works!** Container cannot write to `/app/`

**8.2 Try to modify server.js from container:**

```bash
docker exec feedback-readonly sh -c 'echo "// hacked" >> /app/server.js'
```

**Expected error:**
```
sh: can't create /app/server.js: Read-only file system
```

✅ **Source code is protected!**

**8.3 Verify writable areas work:**

```bash
# Can write to feedback directory
docker exec feedback-readonly touch /app/feedback/test-writable.txt

# Can write to temp directory
docker exec feedback-readonly touch /app/temp/test-temp.txt

# Verify creation
docker exec feedback-readonly ls /app/feedback
docker exec feedback-readonly ls /app/temp
```

✅ **Writable directories work as expected!**

### Step 9: Test Host Can Still Modify Files

**9.1 From your host machine, edit `pages/feedback.html`:**

```html
<h2>Your Feedback</h2>
<!-- Change to: -->
<h2>🔒 Protected Source Code with Read-Only Volumes 🔒</h2>
```

**9.2 Save and refresh browser:**

✅ **Changes work!** Host can still modify files.

**9.3 Edit `server.js` and add logging:**

```javascript
app.post('/create', async (req, res) => {
  const title = req.body.title.toLowerCase();
  const content = req.body.text;
  
  console.log('📝 Saving feedback:', title);  // Add this

  const tempFilePath = path.join(__dirname, 'temp', title + '.txt');
  // ... rest of code
});
```

**9.4 Save and watch logs:**

```bash
docker logs -f feedback-readonly
```

**Expected:**
```
[nodemon] restarting due to changes...
[nodemon] starting `node server.js`
```

✅ **Nodemon hot reload still works!**

**Read-only applies ONLY to container, not host.**

### Step 10: Inspect Volume Mounts

**10.1 View all mounts:**

```bash
docker inspect feedback-readonly -f '{{ json .Mounts }}' | jq
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
    "RW": true
  },
  {
    "Type": "volume",
    "Name": "abc123...",
    "Source": "/var/lib/docker/volumes/abc123.../_data",
    "Destination": "/app/temp",
    "Mode": "",
    "RW": true
  },
  {
    "Type": "volume",
    "Name": "def456...",
    "Source": "/var/lib/docker/volumes/def456.../_data",
    "Destination": "/app/node_modules",
    "Mode": "",
    "RW": true
  },
  {
    "Type": "bind",
    "Source": "/home/user/07-read-only-volumes/src",
    "Destination": "/app",
    "Mode": "ro",
    "RW": false
  }
]
```

**Key observations:**
- `feedback-data`: `"RW": true` (writable)
- `temp`: `"RW": true` (writable)
- `node_modules`: `"RW": true` (writable)
- Bind mount: `"Mode": "ro"`, `"RW": false` (read-only)

### Step 11: Cleanup

```bash
# Stop and remove container
docker stop feedback-readonly
docker rm feedback-readonly

# Volume cleanup
docker volume rm feedback-data
docker volume prune -f

# Image cleanup
docker rmi feedback-app:readonly
```

## Volume Modes Deep Dive

### Read-Write Mode (Default)

**Syntax:**
```bash
docker run -v /host:/container image
docker run -v /host:/container:rw image  # Explicit
```

**Permissions:**
- Container: Read ✅ Write ✅ Delete ✅
- Host: Read ✅ Write ✅ Delete ✅

### Read-Only Mode

**Syntax:**
```bash
docker run -v /host:/container:ro image
```

**Permissions:**
- Container: Read ✅ Write ❌ Delete ❌
- Host: Read ✅ Write ✅ Delete ✅

**Important:** Read-only is enforced at the container level, not on the host.

### Mixed Mode with Precedence

**Most specific path wins:**

```bash
docker run \
  -v $(pwd):/app:ro \              # /app is read-only
  -v data:/app/uploads \           # /app/uploads is read-write
  -v logs:/app/logs:ro \           # /app/logs is read-only
  my-image
```

**Result:**
- `/app/` → Read-only
- `/app/uploads/` → Read-write (overrides parent)
- `/app/logs/` → Read-only (explicit)
- `/app/src/` → Read-only (inherits from parent)

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker run -v path:path:ro` | Read-only volume mount |
| `docker run -v path:path:rw` | Read-write volume mount (default) |
| `docker inspect <c> -f '{{.Mounts}}'` | View volume configuration |
| `docker exec <c> touch /path/file` | Test write permissions |

## Troubleshooting

**Application fails with "Read-only file system":**
```bash
# Check mount modes
docker inspect feedback-readonly -f '{{.Mounts}}' | grep -i mode

# Add writable volume for directory that needs writes
docker run -v /app/writable-dir ...
```

**Anonymous volume not overriding:**
```bash
# Anonymous volumes MUST be in docker run command, not Dockerfile
# Remove VOLUME instruction from Dockerfile
# Add -v /app/path in docker run command
```

## What You Learned

In this lab, you:
- ✅ Understood read-write vs read-only volume modes
- ✅ Made bind mounts read-only to protect source code
- ✅ Identified which directories need write access
- ✅ Used volume precedence to create writable exceptions
- ✅ Applied security best practices (principle of least privilege)
- ✅ Tested read-only enforcement from container perspective
- ✅ Verified host can still modify read-only volumes
- ✅ Learned production-ready volume configuration patterns

**Key Takeaway:** Read-only volumes enforce immutability and security by preventing containers from modifying files they shouldn't touch, while volume precedence allows surgical exceptions for directories that legitimately need write access. This is a production best practice!