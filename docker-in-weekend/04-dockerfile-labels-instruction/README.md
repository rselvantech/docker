# Dockerfile LABEL Instruction Lab

## Lab Overview

This hands-on lab demonstrates how to use the LABEL instruction in Dockerfiles to add metadata to Docker images. You'll learn how to document images with labels for maintainer information, versioning, descriptions, and custom metadata that helps organize and manage images in production environments.

**What you'll do:**
- Add metadata to images using LABEL instruction
- Understand single vs multi-line LABEL syntax
- Inspect labels in built images
- Use labels for image documentation and organization

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE

**Knowledge Requirements:**
- Basic Dockerfile syntax (FROM, COPY instructions)
- Completion of previous Docker labs recommended

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Use LABEL instruction to add metadata to images
2. ✅ Apply best practices for label formatting
3. ✅ Inspect labels using docker inspect command
4. ✅ Understand common label keys and conventions

## Demo Application

### Nginx with Comprehensive Labels

Same custom Nginx setup from previous lab, now enhanced with metadata labels:

**Application Structure:**
```
04-dockerfile-labels-instruction/
└── src/
    ├── Dockerfile           # With LABEL instructions
    └── index.html          # Custom HTML content
```

**What's different:**
- Adds maintainer information
- Includes version and description
- Demonstrates label best practices
- No functional changes - purely metadata

## Lab Instructions

### Step 1: Understanding LABEL Instruction

The LABEL instruction adds key-value metadata to images. Labels provide critical information for image management, documentation, and automation in production environments.

**Real-world Use Cases:**

1. **Image Management & Organization**
   - Track image versions and build dates
   - Identify image ownership and maintainers
   - Organize images by team, project, or environment

2. **CI/CD Pipeline Integration**
   - Store build numbers and commit SHAs
   - Link images to source code repositories
   - Track deployment environments (dev/staging/prod)

3. **Kubernetes & Orchestration**
   - Label-based pod scheduling and node selection
   - Resource quotas and limits based on labels
   - Service discovery and load balancing

4. **Security & Compliance**
   - Track license information
   - Document security scan results
   - Maintain audit trails for regulatory compliance

5. **Automated Cleanup & Maintenance**
   - Filter and remove old images by version/date
   - Implement retention policies
   - Identify unused or deprecated images

**Syntax:**

```dockerfile
# Single label
LABEL key="value"

# Multiple labels (recommended - creates one layer)
LABEL version="1.0" \
      description="My custom nginx" \
      maintainer="you@example.com"

# Alternative multi-label syntax
LABEL version="1.0" description="My custom nginx" maintainer="you@example.com"
```

**Common Label Types:**

**Custom Labels:**
- `maintainer` - Image maintainer contact
- `version` - Image version
- `description` - What the image does
- `vendor` - Organization/company name

**OCI (Open Container Initiative) Labels:**

The OCI Image Specification defines standard labels for container images. These labels ensure consistency across different container tools and registries.

**Standard OCI Label Keys:**
- `org.opencontainers.image.authors` - Contact details of image authors
- `org.opencontainers.image.title` - Human-readable title
- `org.opencontainers.image.description` - Detailed description
- `org.opencontainers.image.version` - Version of packaged software
- `org.opencontainers.image.revision` - Source control revision (git SHA)
- `org.opencontainers.image.created` - ISO 8601 timestamp
- `org.opencontainers.image.url` - Project homepage URL
- `org.opencontainers.image.source` - Source code repository URL
- `org.opencontainers.image.documentation` - Documentation URL
- `org.opencontainers.image.vendor` - Organization name
- `org.opencontainers.image.licenses` - License identifier (SPDX)

**Why use OCI labels?**
- **Standardization**: Recognized by all OCI-compliant tools
- **Automation**: Tools can automatically extract metadata
- **Integration**: Works with registries, scanners, and monitoring tools
- **Best Practice**: Industry-standard for professional images

### Step 2: Create Project Structure

```bash
mkdir -p docker-in-weekend/04-dockerfile-labels-instruction/src
cd docker-in-weekend/04-dockerfile-labels-instruction/src
```

### Step 3: Create Application Files

**3.1 Create `Dockerfile`:**

**3.2 Create `index.html`:**

> **Note:** Use the same HTML content from previous lab or create your own custom page.

### Step 4: Build Image with Labels

```bash
docker build -t nginx-labels:1.0 .
```

### Step 5: Inspect Labels

**5.1 View all image metadata:**
```bash
docker inspect nginx-labels:1.0
```

**5.2 View only labels:**
```bash
docker inspect --format='{{json .Config.Labels}}' nginx-labels:1.0 | jq
```

**Expected output (partial):**
```json
{
  "maintainer": "RSelvan",
  "version": "1.0",
  "description": "A simple Nginx Application",
  "org.opencontainers.image.authors": "RSelvan",
  "org.opencontainers.image.title": "Nginx Alpine Slim Application",
  "org.opencontainers.image.version": "1.0",
  "org.opencontainers.image.licenses": "Apache-2.0"
}
```

**5.3 View specific OCI label:**
```bash
docker inspect --format='{{index .Config.Labels "org.opencontainers.image.version"}}' nginx-labels:1.0
```

**5.4 View custom label:**
```bash
docker inspect --format='{{.Config.Labels.version}}' nginx-labels:1.0
```

### Step 6: Best Practice - Multi-line Labels

While the current Dockerfile works, it's better to combine labels for layer optimization:

**Optimized Dockerfile:**
```dockerfile
FROM nginx:alpine-slim

# Custom Labels combined
LABEL maintainer="RSelvan" \
      version="1.0" \
      description="A simple Nginx Application"

# OCI Labels combined
LABEL org.opencontainers.image.authors="RSelvan" \
      org.opencontainers.image.title="Nginx Alpine Slim Application" \
      org.opencontainers.image.description="A lightweight Nginx application built on Alpine." \
      org.opencontainers.image.version="1.0" \
      org.opencontainers.image.revision="1234567890abcdef" \
      org.opencontainers.image.created="2025-01-25T08:30:00Z" \
      org.opencontainers.image.url="https://github.com/stacksimplify/docker-in-a-weekend" \
      org.opencontainers.image.source="https://github.com/docker/blob/main/docker-in-weekend/04-dockerfile-labels-instruction/src/Dockerfile" \
      org.opencontainers.image.documentation="https://github.com/docker/blob/main/docker-in-weekend/04-dockerfile-labels-instruction/" \
      org.opencontainers.image.vendor="RSelvanTech" \
      org.opencontainers.image.licenses="Apache-2.0"

COPY index.html /usr/share/nginx/html
```

**Why?** Each LABEL instruction creates a layer. Combining them reduces layers and image size.

**Rebuild:**
```bash
docker build -t nginx-labels:2.0 .
```

**Compare layers:**
```bash
docker history nginx-labels:1.0
docker history nginx-labels:2.0
```

Version 2.0 has fewer layers!

### Step 7: Run and Verify

```bash
docker run -d -p 8080:80 --name nginx-labels nginx-labels:2.0
```

**Access:**
```
http://localhost:8080
```

**Inspect running container labels:**
```bash
docker inspect --format='{{json .Config.Labels}}' nginx-labels | jq
```

### Step 8: Filter Images by Label

**List images with specific label:**
```bash
docker images --filter "label=maintainer=rselvantech"
```

**List images with version label:**
```bash
docker images --filter "label=version"
```

### Step 9: Cleanup

```bash
docker stop nginx-labels
docker rm nginx-labels
docker rmi nginx-labels:1.0
docker rmi nginx-labels:2.0
```

## Key Concepts Explained

### LABEL vs Comments
- **Comments (`#`)**: Documentation in Dockerfile only
- **Labels**: Metadata stored in the image itself
- Labels can be queried and filtered
- Labels persist with the image

### Label Namespacing

**OCI labels use standardized namespace:**
```dockerfile
LABEL org.opencontainers.image.version="1.0"
LABEL org.opencontainers.image.authors="Your Name"
```

This ensures compatibility across tools and prevents naming conflicts.

### Layer Optimization
```dockerfile
# ❌ Creates 3 layers
LABEL version="1.0"
LABEL maintainer="rselvantech"
LABEL description="My app"

# ✅ Creates 1 layer
LABEL version="1.0" \
      maintainer="rselvantech" \
      description="My app"
```

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker inspect <image>` | View all image metadata |
| `docker inspect --format='{{.Config.Labels}}' <image>` | View labels only |
| `docker images --filter "label=key=value"` | Filter images by label |
| `docker history <image>` | View image layers |

## Troubleshooting

**Labels not showing:**
```bash
# Ensure image was built successfully
docker images | grep nginx-labels

# Check if you're inspecting correct image
docker inspect nginx-labels:2.0
```

**jq command not found:**
```bash
# Install jq on WSL-Ubuntu
sudo apt update
sudo apt install jq -y
```

**Can't filter images by label:**
```bash
# Verify label exists
docker inspect --format='{{.Config.Labels}}' <image>

# Check exact key-value match
docker images --filter "label=version=1.0"
```

## What You Learned

In this lab, you:
- ✅ Added metadata to images using LABEL instruction
- ✅ Understood single vs multi-line LABEL syntax
- ✅ Inspected and filtered images by labels
- ✅ Applied layer optimization with combined labels
- ✅ Learned label naming conventions and namespacing