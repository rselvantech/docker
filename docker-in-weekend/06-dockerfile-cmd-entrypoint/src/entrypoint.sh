#!/bin/sh
# Real-world pattern: wrapper script as ENTRYPOINT
# Adds default behaviour before passing all args to curl
echo "==> Running curl diagnostic tool"
echo "==> Target: $@"
echo "---"
exec curl "$@"
