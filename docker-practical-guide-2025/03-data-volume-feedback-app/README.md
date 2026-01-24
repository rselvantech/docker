# Docker Data Persistence Lab - Feedback Application

## Lab Overview

This hands-on lab explores data persistence challenges in Docker containers through a practical feedback application. You'll learn how containers handle file system operations, understand the ephemeral nature of container storage, and discover why Docker volumes are necessary for persistent data.

**What you'll do:**
- Build an application that writes files to the container filesystem
- Understand how feedback and temp directories work in containers
- Test data persistence across container stops, starts, and removals
- Handle duplicate file scenarios
- Discover the limitations of container-only storage

## Prerequisites

**Required Software:**
- Docker Desktop installed and running
- Text editor or IDE


**Knowledge Requirements:**
- Completion of previous Docker labs (Demo 1 & 2) recommended
- Basic understanding of file systems
- Familiarity with Node.js file operations helpful

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand container filesystem behavior
2. ✅ Recognize data persistence limitations in containers
3. ✅ Test file creation and access in containerized applications
4. ✅ Handle file conflicts and duplicate detection
5. ✅ Identify when Docker volumes are needed
6. ✅ Understand the difference between temp and persistent storage

## Demo Application

### Feedback Storage Web Application

The demo application allows users to submit feedback that gets saved as text files in the container:

**Features:**
- Form-based feedback submission with title and content
- File-based storage using Node.js fs/promises API
- Duplicate title detection with error page
- Temporary file staging before final storage
- Static file serving for accessing stored feedback
- Runs on port 80 inside the container

**Application Structure:**
```
03-data-volume-feedback-app/
├── src/
│   ├── server.js              # Express server with file operations
│   ├── package.json           # Dependencies
│   ├── Dockerfile             # Container configuration
│   ├── pages/
│   │   ├── feedback.html      # Main feedback form
│   │   └── exists.html        # Duplicate error page
│   ├── styles/
│   │   └── styles.css         # Application styling
│   ├── feedback/              # Stored feedback files (created at runtime)
│   └── temp/                  # Temporary file staging (created at runtime)
```

**User Flow:**
1. User fills out feedback form (title + text)
2. App creates temp file for staging
3. App checks if final file already exists
4. If new: moves to feedback directory, deletes temp file
5. If duplicate: redirects to error page, cleans up temp file
6. Feedback files accessible at `/feedback/{title}.txt`

## Understanding Container Storage

### What Happens When Your App Writes Files

**File creation flow:**
```
1. User submits "awesome" feedback
2. App writes to: temp/awesome.txt
3. App checks: Does feedback/awesome.txt exist?
4. If NO:
   - Creates feedback/awesome.txt
   - Deletes temp/awesome.txt
   - Redirects to success page
5. If YES:
   - Redirects to /exists page
   - Temp file remains (commented out in code)
```

**Where files are stored:**
- Files are written to the container's writable layer
- Located at `feedback/` and `temp/` inside container
- Stored in container's union filesystem
- Not visible on your host machine
- Exist only within that specific container instance

### What Happens During Stop and Start

**Scenario 1: Stop and Start Same Container**
```bash
docker stop feedback-app
docker start feedback-app
```

**Result:** ✅ Files PERSIST
- Container's writable layer is preserved
- All feedback files remain intact
- You can access previously saved feedback
- Application state is maintained

**Why?** Stopping a container doesn't delete it—just pauses it. The container's filesystem remains on disk.

**Scenario 2: Remove and Recreate Container**
```bash
docker stop feedback-app
docker rm feedback-app
docker run -d -p 8080:80 --name feedback-app feedback-app-image
```

**Result:** ❌ Files are LOST
- New container created from original image
- Starts with fresh, empty feedback directory
- All previously saved feedback is gone
- Application resets to initial state

**Why?** Each container has its own writable layer. Removing the container deletes that layer forever.

### Handling Duplicate Feedback

**When you submit feedback with an existing title:**

1. App writes to temp: `temp/<duplicate-title>.txt`
2. Attempts to create: `feedback/<duplicate-title>.txt`
3. Node.js throws EEXIST error
4. App catches error and redirects to `/exists` page
5. Temp file handling:
   - Temp file remains on disk (demonstrates cleanup importance)

**Test this:**
```bash
# Submit feedback titled "test"
# Submit again with same title "test"
# See error page: "This title exists already!"
# Check container: docker exec feedback-app ls -la temp
# You'll see accumulated temp files if cleanup is disabled
```

### Limitations of This Solution

**Critical Issues:**

1. **Data Loss on Container Removal**
   - All feedback lost when container is deleted
   - No backup or recovery mechanism
   - Unacceptable for production applications

2. **Backup and Recovery Challenges**
   - No straightforward backup process
   - Must export container filesystem manually
   - Disaster recovery is complex

**Why this matters:**
- Real applications need persistent storage
- Data must survive container lifecycle
- This lab demonstrates the problem that Docker Volumes solve
- Next labs will introduce volumes as the solution

## Lab Instructions

### Step 1: Create Project Structure

```bash
mkdir -p 03-data-volume-feedback-app/src/{pages,styles,feedback,temp}
cd 03-data-volume-feedback-app/src
```

### Step 2: Create Application Files

**2.1 Create `server.js`:**

**2.2 Create `pages/feedback.html`:**

**2.3 Create `pages/exists.html`:**

**2.4 Create `styles/styles.css`:**

**2.5 Create `package.json`:**


### Step 3: Create the Dockerfile

Create a `Dockerfile` in the `src` directory. This follows the same pattern as previous examples—refer to Demo 1 and Demo 2 for detailed explanations of each instruction.

```dockerfile
FROM node:25
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 80
CMD ["node","server.js"]
```

### Step 4: Build the Docker Image

```bash
cd 03-data-volume-feedback-app/src
docker build -t feedback-app .
```

### Step 5: Run the Container

```bash
docker run -d -p 8080:80 --name feedback-app feedback-app
```

### Step 6: Test Basic Functionality

**6.1 Access the application:**
```
http://localhost:8080
```

**6.2 Submit first feedback:**
- Title: `awesome`
- Text: `This Docker course is awesome!`
- Click Save
- Page refreshes to empty form (success)

**6.3 Access the saved feedback:**
```
http://localhost:8080/feedback/awesome.txt
```
You should see your feedback content displayed.

### Step 7: Test Duplicate Detection

**7.1 Submit duplicate:**
- Title: `awesome` (same as before)
- Text: `Different content`
- Click Save
- You'll see: "This title exists already!"

**7.2 Check temp directory:**
```bash
docker exec feedback-app ls -la temp
```
You will see `awesome.txt` which is not moved to `feedback` due to duplicate.
All such temp files will be accumulating here.

### Step 8: Test Data Persistence - Stop and Start

**8.1 Stop the container:**
```bash
docker stop feedback-app
```

**8.2 Start the same container:**
```bash
docker start feedback-app
```

**8.3 Check URL , if data persists:**
```
http://localhost:8080/feedback/awesome.txt
```
✅ **Result:** File still exists! Data survived stop/start.

**8.4 Check directories, if data persists:**

Check `feedback` and `temp` directories

```bash
docker exec feedback-app ls -la feedback
docker exec feedback-app ls -la temp
```
✅ **Result:** File still exists

### Step 9: Test Data Loss - Remove and Recreate

**9.1 Stop and remove container:**
```bash
docker stop feedback-app
docker rm feedback-app
```

**9.2 Create new container from same image:**
```bash
docker run -d -p 8080:80 --name feedback-app feedback-app
```

**9.3 Try to access previous feedback:**
```
http://localhost:8080/feedback/awesome.txt
```
❌ **Result:** File not found! Data was lost with container removal.

**9.4 Verify feedback & temp directories are empty:**
```bash
docker exec feedback-app ls -la feedback
docker exec feedback-app ls -la temp
```
Only shows empty directory.

### Step 10: Test Multiple Feedbacks

**10.1 Create several feedback files:**
- Submit feedback with title: `docker`
- Submit feedback with title: `containers`
- Submit feedback with title: `volumes`

**10.2 List all feedback:**
```bash
docker exec feedback-app ls -la feedback
```

You'll see:
```
docker.txt
containers.txt
volumes.txt
```

**10.3 Access each file:**
```
http://localhost:8080/feedback/docker.txt
http://localhost:8080/feedback/containers.txt
http://localhost:8080/feedback/volumes.txt
```

### Step 11: Cleanup

```bash
docker stop feedback-app
docker rm feedback-app
docker rmi feedback-app
```


## Testing Summary

| Test | Command/Action | Expected Result |
|------|---------------|-----------------|
| Submit feedback | Form submission | File created in `feedback/` |
| Access feedback | Visit `/feedback/{title}.txt` | File content displayed |
| Submit duplicate | Same title again | Error page shown |
| Stop & start | `docker stop` then `docker start` | ✅ Data persists |
| Remove & recreate | `docker rm` then new `docker run` | ❌ Data lost |
| Multiple files | Submit several feedbacks | All files accessible |
| Check temp dir | `docker exec ls temp` | May show orphaned files |

## Key Concepts Explained

### Container Writable Layer
- Each container has a thin read-write layer on top of the image
- Files written by the application go here
- Persists with the container, not the image
- Deleted when container is removed

### File System Isolation
- Container filesystem is separate from host
- Changes inside container don't affect host
- Must use volumes or bind mounts to share data

### Understanding Docker's layered filesystem 

**Why We Need `feedback` and `temp` Directories in Image**

Without these pre-existing directories in the image, this Node.js app cannot create files and will throw `ENOENT` errors.

This is due to the following code in the app:
```javascript
const tempFilePath = path.join(__dirname, 'temp', title + '.txt');
const finalFilePath = path.join(__dirname, 'feedback', title + '.txt');

await fs.writeFile(tempFilePath, content);
const handle = await fs.open(finalFilePath, 'wx');
```

**❌ What these methods do NOT do:**
- They do not create parent directories automatically
- They do not auto-create `feedback/` or `temp/` if missing
- They will fail with `ENOENT: no such file or directory` if the directories don't exist

**✅ Why directories must exist in the image:**
- The directories must be present in the **image layers** during build time
- When the application writes files (e.g., `awesome.txt`), those files are created in the **container's writable layer**, not in the image
- Think of it as: 
  - Directories = "folder structure in the blueprint" (image)
  - Files = "documents created during use" (container)

**Understanding Docker's layered filesystem:**
- **Image layers (read-only):** Contains the directory structure (`feedback/`, `temp/`)
- **Container writable layer (read-write):** Contains the actual feedback files created at runtime
- Directory creation: During `docker build` → stored in **image layers** (read-only)
- File creation: During `docker run` → stored in **container's writable layer** (read-write)
- The container's filesystem = Image layers + Writable layer (union filesystem)

## Troubleshooting

**Program crashes when submitting first feedback:**

**Issue:** Application fails with "ENOENT: no such file or directory" error when saving feedback.

**Solution:** Ensure your project has `feedback` and `temp` directories created before building the Docker image.
```bash
# Create the directories
mkdir -p src/feedback src/temp

# Then rebuild your image
docker build -t feedback-app .
```

**Temp files accumulating:**
- This is intentional (cleanup commented out)
- Demonstrates importance of cleanup logic
- In production, uncomment `fs.unlink()` in catch block

## What You Learned

In this lab, you:
- ✅ Built an app that writes files to container filesystem
- ✅ Understood how `feedback` and `temp` directories serve different purposes
- ✅ Tested data persistence across stop/start operations
- ✅ Discovered data loss when containers are removed
- ✅ Identified critical limitations of container-only storage
- ✅ Recognized the need for Docker volumes (next topic)

