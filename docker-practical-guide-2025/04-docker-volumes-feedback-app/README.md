# Docker Data Persistence using Docker Volumes Lab - Feedback Application

## Lab Overview

This hands-on lab builds upon [03-data-volume-feedback-app](../03-data-volume-feedback-app/) to solve the data persistence problem using Docker volumes. You'll learn the difference between anonymous and named volumes, understand their use cases and limitations, and implement true data persistence that survives container removal.

**What you'll do:**
- Run the feedback app with anonymous volumes and observe limitations
- Implement named volumes for persistent data storage
- Compare container writable layer vs anonymous vs named volumes
- Test data persistence across container recreations
- Understand volume management and best practices

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE

**Knowledge Requirements:**
- **REQUIRED:** Completion of [03-data-volume-feedback-app](../03-data-volume-feedback-app/) lab
- Understanding of container writable layer limitations
- Basic Docker commands

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand Docker volumes and their purpose
2. ✅ Create and use anonymous volumes
3. ✅ Identify limitations of anonymous volumes
4. ✅ Create and use named volumes
5. ✅ Compare volume types and their use cases
6. ✅ Manage volumes (inspect, list, remove)
7. ✅ Achieve true data persistence across container lifecycles

## Demo Application

### Same Feedback Application with Volumes

This lab reuses the exact same feedback application from demo 03. 

**For application details, refer to:**
- [03-data-volume-feedback-app README](../03-data-volume-feedback-app/README.md)

**Application Structure:**
```
04-docker-volumes-feedback-app/
└── src/
    ├── server.js              # Same as demo 03
    ├── package.json           # Same as demo 03
    ├── Dockerfile             # Same as demo 03
    ├── pages/                 # Same as demo 03
    ├── styles/                # Same as demo 03
    ├── feedback/              # NOW backed by Docker volume
    └── temp/                  # Still in container layer
```

**What's different:**
- `feedback/` directory now uses Docker volumes for persistence
- Data survives container removal and recreation
- Multiple container instances can potentially share data
- Easier backup and management

## Understanding Docker Volumes

### The Three Storage Options

| Storage Type | Location | Survives `docker rm`? | Use Case |
|--------------|----------|----------------------|----------|
| **Container Writable Layer** | Inside container | ❌ No | Temporary data, logs |
| **Anonymous Volume** | Docker-managed, random name | ✅ Yes (orphaned) | Temporary isolation |
| **Named Volume** | Docker-managed, your name | ✅ Yes | Persistent data, databases |

### What is a Docker Volume?

A Docker volume is a directory that exists outside the container's union filesystem, managed by Docker.

**Key characteristics:**
- Stored on host filesystem (managed by Docker)
- Independent of container lifecycle
- Can be shared between containers
- Persists even when container is deleted
- Better performance than bind mounts on Windows/Mac

### Anonymous vs Named Volumes

**Anonymous Volume:**
```bash
docker run -v /app/feedback my-image
```
- Docker generates random name (e.g., `a7f3d8e9b2c1...`)
- Hard to identify and reuse
- Gets removed with `docker run --rm` automatically
- Persists if container removed manually(`--rm` not used. but hard to find)

**Named Volume:**
```bash
docker run -v feedback-data:/app/feedback my-image
```
- You choose the name (`feedback-data`)
- Easy to identify and manage
- Persists after `docker rm`
- Can be explicitly reused across containers

## Lab Instructions

### Step 1: Setup - Copy Demo 03 Files

Since this lab reuses demo 03, copy all files:

```bash
# Create project structure
mkdir -p 04-docker-volumes-feedback-app/src
cd 04-docker-volumes-feedback-app/src

# Copy all files from demo 03
cp -r ../../03-data-volume-feedback-app/src/* .
```

**Or manually create:**
- Copy `server.js`, `package.json`, `Dockerfile`
- Copy `pages/` and `styles/` directories
- Create empty `feedback/` and `temp/` directories

Refer to [03-data-volume-feedback-app](../03-data-volume-feedback-app/README.md) for complete file contents.

### Step 2: Build the Image

```bash
docker build -t feedback-app:volumes .
```

This is the same image as demo 03—no Dockerfile changes needed yet.

### Step 3: Review Demo 03 Limitations

**Quick recap from demo 03:**

Without volumes:
```bash
docker run -d -p 8080:80 --name feedback-app feedback-app:volumes
# Submit feedback
docker stop feedback-app
docker rm feedback-app
docker run -d -p 8080:80 --name feedback-app feedback-app:volumes
# ❌ Feedback is GONE
```

**Problem:** Data stored in container writable layer is deleted with the container.

### Step 4: Run with Anonymous Volume

**4.1 Create container with anonymous volume:**

```bash
docker run -d -p 8080:80 --name feedback-anonymous \
  -v /app/feedback \
  feedback-app:volumes
```

**Command breakdown:**
- `-v /app/feedback`: Create anonymous volume mounted at `/app/feedback`
- Docker generates random volume name
- Files written to `/app/feedback` go to the volume, not container layer

**4.2 Verify volume creation:**

```bash
docker volume ls
```

You'll see something like:
```
DRIVER    VOLUME NAME
local    26f51df659e60daa...
```

**4.3 Inspect the volume:**

```bash
docker volume inspect <VOLUME_NAME>
```

You'll see something like:
```
[
    {
        "CreatedAt": "2026-01-26T09:53:10-05:00",
        "Driver": "local",
        "Labels": {
            "com.docker.volume.anonymous": ""
        },
        "Mountpoint": "/var/lib/docker/volumes/26f51df659e60daac6388a73919ecbdd2cfb1d0a3f1b89f9da36cf0862bf31f3/_data",
        "Name": "26f51df659e60daac6388a73919ecbdd2cfb1d0a3f1b89f9da36cf0862bf31f3",
        "Options": null,
        "Scope": "local"
    }
]
```

**4.4 Test the application:**

```
http://localhost:8080
```

Submit feedback:
- Title: `anonymous-test`
- Text: `Testing anonymous volume`

**4.5 Verify file in volume:**

```bash
docker exec feedback-anonymous ls -la /app/feedback
docker exec feedback-anonymous cat /app/feedback/anonymous-test.txt
```

You should see `anonymous-test.txt` file and its content

**4.6 Test persistence - Remove and recreate:**

```bash
docker stop feedback-anonymous
docker rm feedback-anonymous
```

**Check if volume still exists:**
```bash
docker volume ls
```

**Note:** The volume still exists. It would have been deleted automatically if the container was started with --rm.

✅ **Volume still exists!** But...

**4.7 Create new container:**

```bash
docker run -d -p 8080:80 --name feedback-anonymous-2 \
  -v /app/feedback \
  feedback-app:volumes
```

**Access the feedback:**
```
http://localhost:8080/feedback/anonymous-test.txt
```

❌ **Result:** File not found!

**Why?** Docker created a NEW anonymous volume with a different random name.

**4.8 Check volumes again:**

```bash
docker volume ls
```

Now you have TWO anonymous volumes! The old one is orphaned.

### Step 5: Anonymous Volume Limitations

**What we discovered:**

1. **Not Reusable:**
   - Random names make it impossible to reference the same volume
   - Each container run creates a new anonymous volume
   - Old volumes become orphaned

2. **Hard to Manage:**
   - Can't identify which volume belongs to which container
   - Difficult to backup or inspect
   - Manual cleanup required

3. **Waste of Space:**
   - Orphaned volumes accumulate
   - No automatic cleanup (unless using `--rm` flag)

**Cleanup orphaned volumes:**
```bash
docker volume prune
```

**When to use anonymous volumes?**
- Temporary data isolation during development
- With `docker run --rm` for automatic cleanup
- When you don't care about reusing the data

### Step 6: Run with Named Volume

**6.1 Create container with named volume:**

```bash
docker run -d -p 8080:80 --name feedback-named \
  -v feedback-data:/app/feedback \
  feedback-app:volumes
```

**Command breakdown:**
- `-v feedback-data:/app/feedback`: Create/use volume named `feedback-data`
- If volume doesn't exist, Docker creates it
- If it exists, Docker reuses it

**6.2 Verify named volume:**

```bash
docker volume ls
```

```
DRIVER    VOLUME NAME
local     feedback-data
```

Much easier to identify!

**6.3 Inspect named volume:**

```bash
docker volume inspect feedback-data
```

**Output:**
```json
[
    {
        "CreatedAt": "2026-01-26T10:30:00Z",
        "Driver": "local",
        "Labels": {},
        "Mountpoint": "/var/lib/docker/volumes/feedback-data/_data",
        "Name": "feedback-data",
        "Options": {},
        "Scope": "local"
    }
]
```

**6.4 Test the application:**

Submit feedback:
- Title: `docker-volumes`
- Text: `Named volumes are awesome!`

```bash
docker exec feedback-named ls -la /app/feedback
```

You should see `docker-volumes.txt`

**6.5 Submit multiple feedbacks:**

- Title: `persistent`
- Title: `data`
- Title: `storage`

**6.6 Verify all files:**

```bash
docker exec feedback-named ls -la /app/feedback
```

```
docker-volumes.txt
persistent.txt
data.txt
storage.txt
```

### Step 7: Test Named Volume Persistence

**7.1 Stop and remove container:**

```bash
docker stop feedback-named
docker rm feedback-named
```

**7.2 Verify volume still exists:**

```bash
docker volume ls
```

✅ `feedback-data` is still there!

**7.3 Create new container with same volume:**

```bash
docker run -d -p 8080:80 --name feedback-named-2 \
  -v feedback-data:/app/feedback \
  feedback-app:volumes
```

**7.4 Access previous feedback:**

```
http://localhost:8080/feedback/docker-volumes.txt
http://localhost:8080/feedback/persistent.txt
http://localhost:8080/feedback/data.txt
http://localhost:8080/feedback/storage.txt
```

✅ **All files are there!** Data persisted across container recreation!

**7.5 Add more feedback:**

- Title: `amazing`
- Text: `This actually works!`

**7.6 Verify combined data:**

```bash
docker exec feedback-named-2 ls -la /app/feedback
```

You'll see all previous files PLUS the new one:
```
docker-volumes.txt
persistent.txt
data.txt
storage.txt
amazing.txt
```

### Step 8: Named Volume Benefits Demonstrated

**8.1 Backup the volume:**

Docker volumes can be backed up easily:

```bash
# Create a backup container
docker run --rm -v feedback-data:/source -v $(pwd):/backup \
  alpine tar czf /backup/feedback-backup.tar.gz -C /source .
```

This creates `feedback-backup.tar.gz` in your current directory!

**8.2 Inspect volume data location:**

```bash
docker volume inspect feedback-data -f '{{ .Mountpoint }}'
```

Shows where Docker stores the volume on your host (requires elevated permissions to access directly).

**8.3 Share volume between containers:**

```bash
# Start second container using same volume
docker run -d -p 9090:80 --name feedback-readonly \
  -v feedback-data:/app/feedback:ro \
  feedback-app:volumes
```

Both containers can access the same data!
- Port 8080: Read-write access
- Port 9090: Read-only access (`:ro` flag)

**Test read-only:**
```
http://localhost:9090/feedback/docker-volumes.txt  # ✅ Works
```

Try to submit feedback on port 9090 - it will fail because the volume is read-only!

### Step 9: Volume Management

**9.1 List all volumes:**

```bash
docker volume ls
```

**9.2 Inspect specific volume:**

```bash
docker volume inspect feedback-data
```

**9.3 Remove unused volumes:**

```bash
# Remove all unused volumes
docker volume prune

# Remove specific volume (must stop containers first)
docker stop feedback-named-2 feedback-readonly
docker rm feedback-named-2 feedback-readonly
docker volume rm feedback-data
```

**9.4 Create volume manually (before running container):**

```bash
docker volume create my-feedback-vol
docker volume ls
```

Then use it:
```bash
docker run -d -p 8080:80 --name feedback-app \
  -v my-feedback-vol:/app/feedback \
  feedback-app:volumes
```

### Step 10: Comparison Summary

**Test all three approaches:**

**Approach 1: Container writable layer (Demo 03)**
```bash
docker run -d -p 8080:80 --name test-writable feedback-app:volumes
# Submit feedback
docker rm -f test-writable
docker run -d -p 8080:80 --name test-writable feedback-app:volumes
# ❌ Data lost
```

**Approach 2: Anonymous volume**
```bash
docker run -d -p 8081:80 --name test-anon -v /app/feedback feedback-app:volumes
# Submit feedback
docker rm -f test-anon
docker run -d -p 8081:80 --name test-anon -v /app/feedback feedback-app:volumes
# ❌ Data lost (new volume created)
# ⚠️ Old volume orphaned
```

**Approach 3: Named volume**
```bash
docker run -d -p 8082:80 --name test-named -v test-data:/app/feedback feedback-app:volumes
# Submit feedback
docker rm -f test-named
docker run -d -p 8082:80 --name test-named -v test-data:/app/feedback feedback-app:volumes
# ✅ Data persists!
```

### Step 11: Cleanup

```bash
# Stop and remove all containers
docker stop feedback-named-2 feedback-readonly
docker rm feedback-named-2 feedback-readonly

# Remove volumes
docker volume rm feedback-data

# Remove anonymous volumes if any
docker volume prune -f

# Remove image
docker rmi feedback-app:volumes
```

## Volume Types Comparison

| Feature | Container Layer | Anonymous Volume | Named Volume |
|---------|----------------|------------------|--------------|
| **Survives `docker rm`** | ❌ No | ⚠️ Yes (but unusable) | ✅ Yes |
| **Reusable** | ❌ No | ❌ No | ✅ Yes |
| **Easy to identify** | N/A | ❌ No | ✅ Yes |
| **Manageable** | N/A | ⚠️ Hard | ✅ Easy |
| **Backup** | ⚠️ Hard | ⚠️ Hard | ✅ Easy |
| **Share between containers** | ❌ No | ⚠️ Possible but hard | ✅ Yes |
| **Auto cleanup with `--rm`** | ✅ Yes | ✅ Yes | ❌ No |
| **Best for** | Temp files | Temp isolation | Production data |

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker run -v /path` | Create anonymous volume |
| `docker run -v name:/path` | Create/use named volume |
| `docker volume ls` | List all volumes |
| `docker volume inspect <name>` | View volume details |
| `docker volume create <name>` | Create volume manually |
| `docker volume rm <name>` | Remove specific volume |
| `docker volume prune` | Remove all unused volumes |
| `docker run -v name:/path:ro` | Mount volume as read-only |

## Key Concepts Explained

### Volume Lifecycle

**Anonymous volume:**
1. Created when container starts (if doesn't exist)
2. Random name assigned
3. Persists after `docker rm` (but orphaned)
4. Removed only with `docker volume prune` or explicit delete
5. Removed automatically with `docker run --rm`

**Named volume:**
1. Created on first use or with `docker volume create`
2. Name specified by you
3. Persists after `docker rm`
4. Explicitly managed and removed when needed
5. Can be reused across multiple containers

### Read-Only Volumes

Mount volumes as read-only to prevent modifications:

```bash
docker run -v feedback-data:/app/feedback:ro my-image
```

**Use cases:**
- Configuration files
- Shared reference data
- Preventing accidental writes

### Volume Drivers

Docker supports different volume drivers for various storage backends:
- `local`: Default, stored on host filesystem
- `nfs`: Network File System
- `cifs`: Windows file shares
- Cloud storage (AWS EFS, Azure Files, etc.)

Example:
```bash
docker volume create --driver local my-volume
```

## Troubleshooting

**Volume not mounting:**
```bash
# Verify volume exists
docker volume ls

# Check mount points
docker inspect <container-name> -f '{{ .Mounts }}'
```


**Cannot remove volume:**
```bash
# Check if volume is in use
docker ps -a --filter volume=feedback-data

# Stop and remove containers first
docker stop <container>
docker rm <container>
docker volume rm feedback-data
```

**Old anonymous volumes accumulating:**
```bash
# Clean up unused volumes
docker volume prune

# Or use --rm flag when running
docker run --rm -v /app/feedback my-image
```

## What You Learned

In this lab, you:
- ✅ Understood the difference between container layer and volumes
- ✅ Created and tested anonymous volumes
- ✅ Identified anonymous volume limitations (not reusable, hard to manage)
- ✅ Implemented named volumes for true data persistence
- ✅ Verified data survives container removal and recreation
- ✅ Learned volume management commands (ls, inspect, rm, prune)
- ✅ Compared all three storage approaches
- ✅ Understood when to use each storage type
- ✅ Practiced volume backup and sharing between containers