FROM nginx:alpine

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: USER + HEALTHCHECK + Ports"
LABEL org.opencontainers.image.description="Hardened Nginx with non-root user and health check"

# Install curl — required for HEALTHCHECK command
RUN apk add --no-cache curl

# Create non-root group and user
# -S = system account, -G = assign to group, no login shell, no home dir
RUN addgroup -g 1001 -S nginxgroup && \
    adduser -u 1001 -S -G nginxgroup nginxuser

# Give nginxuser ownership of all directories Nginx needs to write to
RUN chown -R nginxuser:nginxgroup \
      /var/cache/nginx \
      /var/log/nginx \
      /etc/nginx/conf.d \
      /usr/share/nginx/html

# Copy application files
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY html/ /usr/share/nginx/html/

# Switch to non-root user — all instructions after this run as nginxuser
USER nginxuser

# Document that container listens on 8080
# Required for -P (publish-all) to know which ports to map
EXPOSE 8080

# Health check — verify nginx is serving requests
# --interval=30s  : check every 30 seconds
# --timeout=5s    : fail if no response within 5 seconds
# --start-period=5s : wait 5s after container starts before first check
# --retries=3     : mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
