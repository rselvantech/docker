# Use nginx:alpine-slim as base Docker Image
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
