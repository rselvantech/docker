# Docker Development with Nodemon Hot Reload Lab

## Lab Overview

This hands-on lab builds upon [05-bind-mounts-override-issue](../05-bind-mounts-override-issue/) to solve the server code hot reload problem. You'll learn why Docker images are immutable, understand the Node.js process limitation, and implement nodemon for automatic server restarts when code changes are detected.

**What you'll do:**
- Understand why server code changes don't auto-reload
- Recognize Docker image immutability
- Install nodemon for development hot reload
- Update Dockerfile to use nodemon
- Test automatic server restarts on code changes
- Experience a complete development workflow with live reload

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE

**Knowledge Requirements:**
- **REQUIRED:** Completion of [05-bind-mounts-override-issue](../05-bind-mounts-override-issue/)
- Understanding of bind mounts and volume precedence
- Basic Node.js knowledge

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand Docker image immutability
2. ✅ Explain why code changes require image rebuilds (without nodemon)
3. ✅ Install and configure nodemon for development
4. ✅ Update Dockerfile CMD to use nodemon
5. ✅ Achieve full hot reload for both static and server code
6. ✅ Implement efficient development workflows with Docker

## Demo Application

### Same Feedback Application with Hot Reload

This lab reuses the exact same feedback application from demos 03, 04, and 05.

**For application details, refer to:**
- [03-data-volume-feedback-app README](../03-data-volume-feedback-app/README.md)

**Application Structure:**
```
06-bind-mounts-nodemon-hot-reload/
└── src/
    ├── server.js              # Same as demo 03 (will add logging)
    ├── package.json           # UPDATED: Add nodemon dependency
    ├── Dockerfile             # UPDATED: Use nodemon in CMD
    ├── pages/                 # Same as demo 03
    ├── styles/                # Same as demo 03
    ├── feedback/              # Backed by named volume
    └── temp/                  # In container layer
```

**What's different:**
- `package.json` includes nodemon as dependency
- Dockerfile uses nodemon instead of node
- Server automatically restarts on file changes
- Complete hot reload for development

## Understanding the Problem

### Docker Images Are Immutable Snapshots

**What "immutable" means:**
- Once an image is built, its contents are **frozen**
- Source code is **copied** into the image at build time (`COPY . .`)
- After build, the image is a **read-only snapshot**
- Running containers use this snapshot

**Timeline without bind mounts:**
```
1. Write code (v1) in your editor
2. docker build → Image contains code v1
3. docker run → Container runs code v1
4. Edit code (v2) in your editor
5. Image STILL contains code v1 (unchanged)
6. Running container STILL uses code v1
7. Must: docker build again → New image with code v2
8. Must: docker run new image → Container with code v2
```

### The Node.js Process Problem

Even with bind mounts (from Project 05), server code doesn't auto-reload:

**Why:**
```
Container startup:
1. Node.js process starts
2. Loads server.js into memory
3. Keeps running with code in memory

You edit server.js:
4. File changes on disk (via bind mount)
5. Node.js process still uses OLD code in memory
6. ❌ Changes not applied until process restarts
```

**This is how Node.js works - NOT a Docker issue!**

Even without Docker:
```bash
$ node server.js          # Process starts, loads code
# Edit server.js in another terminal
# Changes NOT applied - still running old code
# Must: Ctrl+C and restart manually
```

### Why We Need Nodemon

**Nodemon** is a Node.js development tool that:
- **Watches** your files for changes
- **Automatically restarts** the Node.js process when files change
- **Eliminates** manual restart cycles
- **Works** both with and without Docker

**With nodemon:**
```
1. nodemon starts server.js
2. You edit server.js
3. nodemon detects change
4. nodemon automatically restarts Node.js
5. ✅ New code is loaded and running
```

## Lab Instructions

### Step 1: Setup - Copy Demo 03 Files

```bash
# Create project structure
mkdir -p 06-bind-mounts-nodemon-hot-reload/src
cd 06-bind-mounts-nodemon-hot-reload/src

# Copy all files from demo 03
cp -r ../../03-data-volume-feedback-app/src/* .
```

Refer to [03-data-volume-feedback-app](../03-data-volume-feedback-app/README.md) for complete file contents.

### Step 2: Update package.json - Add Nodemon

**2.1 Open `package.json` in your editor**

**2.2 Add nodemon to dependencies and add dev script:**
```json
{
  "name": "feedback-app",
  "version": "1.0.0",
  "description": "Feedback storage application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "body-parser": "^1.19.0",
    "nodemon": "^2.0.20"
  }
}
```

**Note:** Nodemon is added as a regular dependency (not devDependency) because we need it inside the container.

### Step 3: Update Dockerfile - Use Nodemon

**3.1 Open `Dockerfile` in your editor**

**3.2 Update the CMD instruction:**
```dockerfile
FROM node:25
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 80
CMD ["npm", "run", "dev"]
```

**What changed:**
- `CMD ["node","server.js"]` → `CMD ["npm", "run", "dev"]`
- Uses npm script to run nodemon
- Nodemon will watch files and auto-restart

### Step 4: Build New Image with Nodemon

```bash
docker build -t feedback-app:nodemon .
```

**What happens:**
1. Installs dependencies (including nodemon)
2. Copies source code
3. Sets up nodemon as default command

**Verify nodemon is installed:**
```bash
docker run --rm feedback-app:nodemon npm list nodemon
```

**Expected output:**
```
feedback-app@1.0.0 /app
`-- nodemon@2.0.22
```

### Step 5: Run with Bind Mounts and Nodemon

```bash
docker run -d -p 8080:80 --name feedback-dev \
  -v feedback-data:/app/feedback \
  -v /app/node_modules \
  -v $(pwd):/app \
  feedback-app:nodemon
```

**Complete setup:**
- Named volume: `/app/feedback` for persistent data
- Anonymous volume: `/app/node_modules` to protect dependencies
- Bind mount: `/app` for live code updates
- Nodemon: Watches for changes and restarts

### Step 6: Verify Nodemon is Running

**6.1 Check container logs:**

```bash
docker logs feedback-dev
```

**Expected output:**
```
> feedback-app@1.0.0 dev
> nodemon server.js

[nodemon] 2.0.22
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node server.js`
```

**6.2 Access the application:**
```
http://localhost:8080
```

✅ Application works normally.

### Step 7: Test Hot Reload - Server Code Changes

**7.1 Open `server.js` in your editor**

**7.2 Add a console.log at the top:**

```javascript
const fs = require('fs').promises;
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');

console.log('🚀 SERVER STARTED WITH NODEMON HOT RELOAD!');

const app = express();
```

**7.3 Save the file**

**7.4 Watch container logs in real-time:**

```bash
docker logs -f feedback-dev
```

**Expected output:**
```
[nodemon] restarting due to changes...
[nodemon] starting `node server.js`
🚀 SERVER STARTED WITH NODEMON HOT RELOAD!
```

✅ **Server automatically restarted!** Your console.log appears!

**Without nodemon:** Would need rebuild + restart for each change (~5minutes)

### Step 8: Test Static Files Still Work

**8.1 Edit `pages/feedback.html`:**

```html
<h2>Your Feedback</h2>
<!-- Change to: -->
<h2>🔥 Real-time Development with Nodemon 🔥</h2>
```

**8.2 Save and refresh browser:**

✅ **HTML changes still instant!** (No nodemon restart needed for static files)

**8.3 Edit `styles/styles.css`:**

```css
button {
  cursor: pointer;
  font: inherit;
  border: 1px solid #350035;
  background-color: #350035;
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: 30px;
  /* Add: */
  transition: all 0.3s ease;
  transform: scale(1);
}

button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(53, 0, 53, 0.3);
}
```

**8.4 Save and refresh browser:**

✅ **CSS changes instant!** Hover over button to see animation.

### Step 12: Cleanup

```bash
# Stop and remove container
docker stop feedback-dev
docker rm feedback-dev

# Volume cleanup
docker volume rm feedback-data
docker volume prune -f

# Image cleanup
docker rmi feedback-app:nodemon
```

## Comparison: Before vs After Nodemon

### Before Nodemon (Project 05)

| Change Type | Rebuild Required? | Container Restart? | Time |
|-------------|-------------------|-------------------|------|
| HTML/CSS | ❌ No | ❌ No | Instant |
| Server code | ✅ Yes | ✅ Yes | 2-5 min |

**Workflow:**
```bash
# Edit server.js
docker build -t app .          # 30-60 seconds
docker stop app                # 5 seconds
docker rm app                  # 2 seconds
docker run ... app             # 5 seconds
# Test changes
# Total: ~1-2 minutes per change
```

### After Nodemon (Project 06)

| Change Type | Rebuild Required? | Container Restart? | Time |
|-------------|-------------------|-------------------|------|
| HTML/CSS | ❌ No | ❌ No | Instant |
| Server code | ❌ No | ⚠️ Auto | 1-2 sec |

**Workflow:**
```bash
# Edit server.js
# Save file
# Nodemon auto-restarts
# Test changes
# Total: ~2 seconds per change
```

**Productivity gain:** 30-60x faster development cycle!

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker run -v $(pwd):/app` | Bind mount for live code |
| `docker logs -f <container>` | Follow logs in real-time |
| `npx nodemon --version` | Check nodemon version |
| `docker exec <c> npx nodemon --help` | Nodemon help inside container |

## Troubleshooting

**Nodemon not restarting:**
```bash
# Check if nodemon is running
docker logs feedback-dev | grep nodemon

# Verify bind mount
docker inspect feedback-dev -f '{{.Mounts}}'

# Check file permissions
ls -la server.js
```

**"Cannot find module 'nodemon'":**
```bash
# Verify nodemon in package.json
cat package.json | grep nodemon

# Rebuild image
docker build -t feedback-app:nodemon .
```

## What You Learned

In this lab, you:
- ✅ Understood Docker image immutability and its implications
- ✅ Recognized why code changes don't auto-apply without tools
- ✅ Installed and configured nodemon for development
- ✅ Updated Dockerfile to use nodemon instead of node
- ✅ Achieved complete hot reload for all code changes
- ✅ Tested server restarts, error recovery, and route additions
- ✅ Experienced a modern, efficient Docker development workflow
- ✅ Learned the difference between development and production setups

**Key Takeaway:** Combining bind mounts + anonymous volumes + nodemon creates a powerful development environment where ALL changes (static files and server code) are immediately reflected without manual rebuilds or restarts!