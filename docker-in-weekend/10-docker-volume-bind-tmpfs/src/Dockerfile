FROM nginx:alpine-slim

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: Docker Storage"
LABEL org.opencontainers.image.description="Nginx storage demo — volumes, bind mounts, tmpfs"

# Remove symlinks to /dev/stdout and /dev/stderr
# Create real log files so named volume has actual content to persist
# Without this, access.log and error.log are symlinks — cat hangs, volume has nothing to persist
RUN unlink /var/log/nginx/access.log && \
    unlink /var/log/nginx/error.log && \
    touch /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy html content
COPY html/ /usr/share/nginx/html/

# Copy static content — used for non-empty dir behavior demo
COPY static-content/ /usr/share/nginx/html/static/

EXPOSE 80
