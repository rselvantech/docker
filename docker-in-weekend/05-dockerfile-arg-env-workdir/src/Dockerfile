# Use nginx:alpine-slim as base Docker Image
# ARG defined before FROM is available only in FROM — not in the rest of Dockerfile
ARG NGINX_IMAGE_TAG=1.27-alpine-slim

FROM nginx:${NGINX_IMAGE_TAG}

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: ARG + ENV + WORKDIR"
LABEL org.opencontainers.image.description="Multi-environment Nginx demo"

# ARG defined after FROM — available during build for RUN, COPY, ENV etc.
ARG APP_ENV=dev
ARG APP_VERSION=1.0.0

# ENV — promote ARG values to runtime environment variables
# Single line with multiple key=value pairs (best practice — saves one image layer)
ENV APP_ENV=${APP_ENV} \
    APP_VERSION=${APP_VERSION} \
    APP_PORT=80 \
    NGINX_WORKER_PROCESSES=auto

# WORKDIR — set working directory for all following instructions
# Creates /app directory if it does not exist
WORKDIR /app

# Copy files relative to WORKDIR — no need to specify full paths
COPY nginx.conf ./nginx.conf
COPY html/ ./html/

# Copy nginx config from WORKDIR to nginx config directory
RUN cp ./nginx.conf /etc/nginx/conf.d/default.conf && \
    cp -r ./html/. /usr/share/nginx/html/

# EXPOSE the port nginx listens on
EXPOSE 80
