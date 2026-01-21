# Docker Goal Tracker Application Lab - Complete Guide

## Lab Overview

This hands-on lab builds upon Docker basics by creating a more interactive web application with form handling and state management. You'll containerize a Node.js application that allows users to set and update their course goals through a web interface, demonstrating how Docker handles stateful applications.

**What you'll do:**
- Build a complete web application with HTML forms and CSS styling
- Create a Dockerfile for a multi-file Node.js project
- Understand port mapping and container networking
- Work with static files and public directories in containers
- Handle application state within containers

## Prerequisites

**Required Software:**
- Docker Desktop installed and running

**Knowledge Requirements:**
- Completion of Docker Basics Lab (Demo 1) recommended
- Basic HTML/CSS understanding helpful
- Familiarity with Express.js beneficial but not required

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Containerize a multi-file Node.js web application
2. ✅ Serve static files (CSS, images) from Docker containers
3. ✅ Map container ports to access web applications
4. ✅ Understand how application state works in containers


## Demo Application

### Interactive Goal Tracker Web App

The demo application is an interactive web application that demonstrates practical Docker usage:

**Features:**
- Express.js server with form handling
- Dynamic HTML rendering with user input
- CSS styling served as static files
- POST request handling to update goals
- In-memory state management
- Runs on port 80 inside the container

**Application Structure:**
```
02-goal-tracker-app//
├── src/
│   ├── server.js           # Main Express application
│   ├── package.json        # Node.js dependencies
│   └── styles/
│       └── styles.css      # CSS styling
└── Dockerfile              # Container configuration
```

**User Experience:**
1. User visits the web page
2. Sees current course goal (default: "Learn Docker!")
3. Enters a new goal in the form
4. Submits the form
5. Page refreshes with updated goal

This application demonstrates how containers handle both static content and dynamic data processing.

## Lab Instructions


### Step 1: Create Application Files

**1.1 Create `src/server.js`:**

**1.2 Create `src/package.json`:**

**1.3 Create `src/styles/styles.css`:**

### Step 3: Create the Dockerfile

Create a `Dockerfile` in the `02-goal-tracker-app/src` directory:

```dockerfile
# Use official Node.js runtime
FROM node:25

# Set working directory
WORKDIR /app

# Copy package.json first (for better caching)
COPY package.json .

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose port 80
EXPOSE 80

# Start the application
CMD ["node", "server.js"]
```

### Step 4: Build the Docker Image

From the `02-goal-tracker-app/src` directory, run:

```bash
docker build -t goal-tracker-app .
```

**What happens:**
- Docker uses Node.js 25 as base image
- Sets `/app` as working directory
- Installs Express and body-parser dependencies
- Copies application files and static assets
- Exposes port 80 for HTTP traffic

**Expected output:**
```
Successfully built [IMAGE_ID]
Successfully tagged goal-tracker-app:latest
```

### Step 5: Run the Container

Start the container with port mapping:

```bash
docker run -d -p 8080:80 --name goal-container goal-tracker-app
```

**Command breakdown:**
- `-d`: Run in detached mode (background)
- `-p 8080:80`: Map host port 8080 to container port 80
- `--name goal-container`: Assign a friendly name
- `goal-tracker-app`: The image to use

**Note:** We map to port 8080 on the host because port 80 often requires admin privileges.

### Step 6: Test the Application

**6.1 Open your browser and navigate to:**
```
http://localhost:8080
```

**6.2 Test the functionality:**
1. You should see "My Course Goal" with "Learn Docker!" displayed
2. Enter a new goal in the input field (e.g., "Master Containerization")
3. Click "Set Course Goal" button
4. Page refreshes and displays your new goal

**6.3 View container logs:**
```bash
docker logs goal-container
```

You should see the goals you submitted logged to the console.

### Step 7: Understand Application State

**Important concept:**
- The `userGoal` variable is stored in memory
- State persists as long as the container runs
- When you stop and remove the container, state is lost
- This demonstrates the ephemeral nature of containers

**Test this:**
```bash
# Stop the container
docker stop goal-container

# Start it again
docker start goal-container

# Visit http://localhost:8080
# Your goal is still there!

# But if you remove and recreate:
docker stop goal-container
docker rm goal-container
docker run -d -p 8080:80 --name goal-container goal-tracker-app

# Visit http://localhost:8080
# Goal is reset to "Learn Docker!"
```

### Step 8: Cleanup

Stop and remove the container:

```bash
docker stop goal-container
docker rm goal-container
```

Remove the image (optional):

```bash
docker rmi goal-tracker-app
```

## Key Concepts Explained

### Port Mapping
- Container port: 80 (where app listens inside container)
- Host port: 8080 (where you access it on your machine)
- Format: `-p <host-port>:<container-port>`

### Static Files
- `express.static('public')` serves files from public directory
- CSS, images, and other assets must be copied to container
- Files are served relative to the working directory

### Application State
- State stored in memory (`userGoal` variable)
- Persists while container runs
- Lost when container is removed
- For persistent data, use Docker volumes (covered in later labs)

## Troubleshooting

**Cannot access http://localhost:8080:**
```bash
# Check if container is running
docker ps

# Check port mapping
docker port goal-container

# Try different host port
docker run -d -p 3000:80 --name goal-container goal-tracker-app
```

**CSS not loading:**
- Verify `styles` directory and `styles/styles.css` file are copied: 
```
docker exec goal-container ls -la app/styles
```


## What You Learned

In this lab, you:
- ✅ Containerized a multi-file web application with static assets
- ✅ Configured port mapping between host and container
- ✅ Served static CSS files from Docker containers
- ✅ Understood how application state works in containers


