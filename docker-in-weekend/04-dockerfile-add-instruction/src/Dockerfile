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