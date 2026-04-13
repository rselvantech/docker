# Docker Image Security Scanning — Trivy + Docker Scout

## Overview

Every Docker image you build is a stack of OS packages, language runtimes, and third-party libraries. Any of them can contain known vulnerabilities (CVEs). Deploying unscanned images to production is one of the most common security failures in cloud environments. This demo covers the two most widely used scanning tools — **Trivy** (open source, industry standard) and **Docker Scout** (built into Docker CLI) — and how to integrate scanning into a CI/CD pipeline to block vulnerable images from reaching production.

**What you'll learn:**
- What a CVE is and how vulnerability scanners work
- Trivy — scan local images, filter by severity, output formats
- Docker Scout — `quickview`, `cves`, `compare`, `recommendations`
- `--exit-code 1` — fail CI/CD builds on vulnerabilities
- `--ignore-unfixed` — filter out vulnerabilities with no patch available
- `.trivyignore` — suppress accepted/false positive CVEs
- Remediation workflow — scan → identify → update base image → rescan
- When to use Trivy vs Docker Scout

---

## What is a CVE?

A **CVE (Common Vulnerabilities and Exposures)** is a publicly disclosed security vulnerability with a unique identifier like `CVE-2024-1234`. Each CVE has:

```
CVE ID:        CVE-2024-1234
Severity:      CRITICAL / HIGH / MEDIUM / LOW / UNKNOWN
CVSS Score:    0.0 – 10.0 (10 = worst)
Package:       libssl3 3.0.11
Fixed in:      3.0.12
Description:   OpenSSL buffer overflow allowing remote code execution
```

**CVSS Severity Ranges:**

```
CRITICAL   9.0 – 10.0   Remote code execution, no user interaction required
HIGH       7.0 – 8.9    Easily exploitable, significant data exposure
MEDIUM     4.0 – 6.9    Harder to exploit, partial compromise
LOW        0.1 – 3.9    Unlikely exploitation, minimal impact
UNKNOWN    N/A          Not yet scored
```

---

## How Vulnerability Scanners Work

```
1. Extract software inventory from image layers
   → OS packages (apt/apk/rpm)
   → Language packages (pip, npm, gem, maven)
   → Binary files

2. Build SBOM (Software Bill of Materials)
   package: libssl3
   version: 3.0.11

3. Cross-reference against vulnerability databases
   NVD (National Vulnerability Database)
   GitHub Advisory Database
   Alpine SecDB, Debian Security Tracker, Red Hat OVAL, etc.

4. Report matching CVEs with severity and fix version
```

---

## Project Structure

```
22-image-scanning/
├── src/
│   ├── app/
│   │   ├── app.py              # simple Flask app
│   │   └── requirements.txt
│   ├── Dockerfile.vulnerable   # old base image — intentional CVEs
│   ├── Dockerfile.fixed        # updated base image — remediated
│   └── .trivyignore            # suppress accepted CVEs
└── README.md
```

---

## Application Files

**`src/app/app.py`**
```python
from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return "Security Scanning Demo"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**`src/app/requirements.txt`**
```
flask==3.1.0
```

**`src/Dockerfile.vulnerable`** — intentionally uses an old base image with known CVEs:
```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.9-slim

WORKDIR /app
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ .

EXPOSE 5000
CMD ["python", "app.py"]
```

**`src/Dockerfile.fixed`** — updated to latest patch release:
```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.13-slim

WORKDIR /app
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ .

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 5000
CMD ["python", "app.py"]
```

**`src/.trivyignore`**
```
# Accepted risk — low impact, no fix available, reviewed 2026-01-15
# CVE-2024-XXXXX

# False positive — we do not use the affected code path
# CVE-2024-YYYYY
```

---

## Part 1: Trivy

### What is Trivy?

Trivy is an open source vulnerability scanner by Aqua Security. It is the most widely adopted container scanner — used by Google, Amazon, Microsoft, and thousands of engineering teams. It requires no daemon, no setup, and produces results in under a minute.

```
Scans:   Container images, filesystems, Git repos, IaC files, Kubernetes
Sources: NVD, GitHub Advisory Database, Alpine SecDB, Debian Security Tracker,
         Red Hat OVAL, Ubuntu Security Tracker, and 15+ others
Output:  table (default), json, sarif, cyclonedx, spdx
Free:    Yes — open source, Apache 2.0
```

### Step 1: Install Trivy

Trivy can be run as a Docker container without any installation:

```bash
# No install required — run directly via Docker
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $HOME/.cache/trivy:/root/.cache/trivy \
  aquasec/trivy:latest \
  image nginx:alpine
```

Or install natively for faster repeated use:

```bash
# macOS
brew install trivy

# Linux (Ubuntu/Debian)
sudo apt-get install wget apt-transport-https gnupg lsb-release
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key \
  | gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] \
  https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" \
  | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt-get update && sudo apt-get install trivy

# Verify
trivy --version
```
```
Version: 0.59.1
```

---

### Step 2: Scan a Public Image

```bash
# Scan nginx:alpine — fast and commonly used
trivy image nginx:alpine
```
```
nginx:alpine (alpine 3.20.3)
Total: 0 (UNKNOWN: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0)
```

Clean ✅ — Alpine-based images are minimal and well-maintained.

```bash
# Scan an older nginx — intentionally has known CVEs
trivy image nginx:1.21
```
```
nginx:1.21 (debian 11.6)
Total: 148 (UNKNOWN: 2, LOW: 88, MEDIUM: 30, HIGH: 20, CRITICAL: 8)

┌───────────────┬────────────────┬──────────┬───────────────────┬─────────────────┬──────────────────────────────────────────┐
│    Library    │ Vulnerability  │ Severity │ Installed Version │  Fixed Version  │                  Title                  │
├───────────────┼────────────────┼──────────┼───────────────────┼─────────────────┼──────────────────────────────────────────┤
│ libssl1.1     │ CVE-2023-0286  │ HIGH     │ 1.1.1n-0+deb11u4  │ 1.1.1n-0+deb11u5│ OpenSSL: X.400 address type confusion    │
│ libssl1.1     │ CVE-2023-2650  │ HIGH     │ 1.1.1n-0+deb11u4  │                 │ OpenSSL: possible DoS translating ...    │
│ ...                                                                                                                         │
└───────────────┴────────────────┴──────────┴───────────────────┴─────────────────┴──────────────────────────────────────────┘
```

**Reading the output:**
```
Library           the package containing the vulnerability
Vulnerability     CVE ID
Severity          CRITICAL / HIGH / MEDIUM / LOW
Installed Version what is currently in the image
Fixed Version     the version that patches this CVE (blank = no fix yet)
Title             brief description of the vulnerability
```

---

### Step 3: Filter by Severity

Scanning everything generates noise. In practice, focus on HIGH and CRITICAL first.

```bash
# Show only HIGH and CRITICAL vulnerabilities
trivy image --severity HIGH,CRITICAL nginx:1.21
```
```
nginx:1.21 (debian 11.6)
Total: 28 (HIGH: 20, CRITICAL: 8)
```

```bash
# Show only CRITICAL
trivy image --severity CRITICAL nginx:1.21
```
```
Total: 8 (CRITICAL: 8)
```

---

### Step 4: Ignore Unfixed Vulnerabilities

Many vulnerabilities have no patch yet — the upstream maintainer has not released a fix. These are noise in CI pipelines because there is nothing you can do about them.

```bash
# Only show vulnerabilities that have a fixed version available
trivy image --severity HIGH,CRITICAL --ignore-unfixed nginx:1.21
```
```
Total: 12 (HIGH: 9, CRITICAL: 3)   ← fewer results, only actionable ones
```

---

### Step 5: Build and Scan a Custom Image

```bash
cd 22-image-scanning/src

# Build the vulnerable version
docker build -f Dockerfile.vulnerable -t scanapp:vulnerable .

# Scan it
trivy image --severity HIGH,CRITICAL scanapp:vulnerable
```
```
scanapp:vulnerable (debian 12.x)

Python packages:
Total: 5 (HIGH: 3, CRITICAL: 2)

│ Package  │ CVE           │ Severity │ Installed │ Fixed   │
│ flask    │ CVE-2024-XXXX │ HIGH     │ 2.x.x     │ 3.1.0   │ ← old flask version
│ ...
```

---

### Step 6: Fix and Rescan — The Remediation Workflow

Update to the fixed image:

```bash
# Build the fixed version
docker build -f Dockerfile.fixed -t scanapp:fixed .

# Rescan
trivy image --severity HIGH,CRITICAL scanapp:fixed
```
```
scanapp:fixed (debian 12.x)
Total: 0 (HIGH: 0, CRITICAL: 0)   ← clean ✅
```

**Remediation workflow:**
```
1. trivy image myapp:latest               → find CVEs
2. Identify which base image has the CVE  → update FROM in Dockerfile
3. docker build -t myapp:fixed .          → rebuild
4. trivy image myapp:fixed                → rescan — confirm clean
5. Push to registry                       → deploy
```

---

### Step 7: JSON Output — For Automation

```bash
# Machine-readable output for integration with other tools
trivy image --format json --output trivy-results.json nginx:1.21

# View results
cat trivy-results.json | python3 -m json.tool | head -50
```

JSON output is used in CI/CD pipelines to parse results, generate reports, feed SIEM systems, or upload to security dashboards.

---

### Step 8: `--exit-code` — Gate Your CI/CD Pipeline

By default, Trivy exits with code 0 even if vulnerabilities are found. Use `--exit-code 1` to fail the build when critical issues are detected.

```bash
# Exit code 0 = no critical CVEs, exit code 1 = critical CVEs found
trivy image --severity CRITICAL --exit-code 1 scanapp:vulnerable
echo "Exit code: $?"
```
```
... (critical CVEs listed)
Exit code: 1   ← build should fail ✅
```

```bash
# Against the fixed image
trivy image --severity CRITICAL --exit-code 1 scanapp:fixed
echo "Exit code: $?"
```
```
Total: 0 (CRITICAL: 0)
Exit code: 0   ← build continues ✅
```

**In a CI/CD pipeline (shell script):**

```bash
#!/bin/bash
IMAGE="myapp:$BUILD_TAG"

docker build -t $IMAGE .

# Scan — fail build on CRITICAL or HIGH vulnerabilities with a fix available
trivy image \
  --severity HIGH,CRITICAL \
  --ignore-unfixed \
  --exit-code 1 \
  $IMAGE

if [ $? -ne 0 ]; then
  echo "❌ Security scan failed — vulnerable image blocked from deployment"
  exit 1
fi

echo "✅ Security scan passed — proceeding with deployment"
docker push $IMAGE
```

---

### Step 9: `.trivyignore` — Suppress Accepted CVEs

Some CVEs are:
- False positives — the vulnerable code path is not used
- Accepted risks — business decision to accept the risk with a review date
- Not yet fixable — no patch exists and you need the build to pass

```bash
# Create .trivyignore in your project root
cat > .trivyignore << 'EOF'
# Accepted risk: only exploitable with physical server access
# Reviewed: 2026-01-15, Next review: 2026-07-15
CVE-2024-XXXXX

# False positive: we don't use the affected TLS feature
CVE-2024-YYYYY
EOF

# Trivy automatically reads .trivyignore in the current directory
trivy image --severity HIGH,CRITICAL scanapp:vulnerable
```

Suppressed CVEs are excluded from the output and exit code calculation.

---

## Part 2: Docker Scout

### What is Docker Scout?

Docker Scout is built directly into the Docker CLI since Docker Desktop 4.17 and Docker Engine 24. It analyses images against vulnerability databases and provides remediation recommendations including which base image update would fix the most CVEs.

```
docker scout quickview    → summary dashboard — total CVEs by severity
docker scout cves         → detailed CVE list
docker scout recommendations → base image update suggestions with CVE counts
docker scout compare      → diff two image versions side by side
```

### Step 10: Docker Scout Quickview

```bash
# Quick health summary of an image
docker scout quickview nginx:1.21
```
```
    ✓ Pulled
    ✓ Image stored for indexing
    ✓ Indexed 148 packages

  Target             │  nginx:1.21
    digest           │  sha256:abc123...
    platform         │  linux/amd64
    vulnerabilities  │    8C    20H    30M    88L
    size             │  54 MB
    packages         │  148

  Base Image     │  debian:bullseye-slim
  Vulnerabilities │    6C    18H    28M    82L

  What's next?
    Learn more about vulnerabilities → docker scout cves nginx:1.21
```

**Reading the summary:**
```
8C = 8 CRITICAL
20H = 20 HIGH
30M = 30 MEDIUM
88L = 88 LOW
```

---

### Step 11: Detailed CVE List

```bash
docker scout cves nginx:1.21
```
```
    ✓ Image stored for indexing

  ## Overview
     Analyzed image:  nginx:1.21

  ## Packages and Vulnerabilities

  0C     0H     1M     0L  curl 7.74.0-1.3+deb11u7
  pkg:deb/debian/curl@7.74.0-1.3+deb11u7?os-distro=debian&os-version=11

    ✗ MEDIUM CVE-2023-27536
      https://scout.docker.com/v/CVE-2023-27536
      Affected range  : <7.88.1
      Fixed version   : 7.88.1
...
```

```bash
# Filter to critical and high only, show only fixable
docker scout cves --only-severity critical,high --only-fixed nginx:1.21
```

---

### Step 12: Base Image Recommendations

```bash
# Scout recommends which base image update fixes the most CVEs
docker scout recommendations nginx:1.21
```
```
  ## Recommended tags

  Tag           │ Details
  ──────────────┼───────────────────────────────────────
  nginx:1.25    │ 0C 2H 15M 62L  ← 6 fewer CRITICAL, most secure ✅
  nginx:latest  │ 0C 2H 12M 58L  ← even fewer vulnerabilities
  nginx:alpine  │ 0C 0H 0M  0L   ← cleanest option ✅✅

  Switch to a different base image tag to fix 8 CRITICAL vulnerabilities.
```

This tells you exactly what to change `FROM` to in your Dockerfile to remediate the most CVEs.

---

### Step 13: Compare Two Image Versions

```bash
# Compare old vs new — what changed in terms of CVEs?
docker scout compare scanapp:vulnerable scanapp:fixed
```
```
  ## Comparing images

    Source │ scanapp:vulnerable
    Target │ scanapp:fixed

  ## Changes in vulnerabilities

    ✓ 5 vulnerabilities removed
    - 0 vulnerabilities added

  ## Changes in packages

    + python 3.13  (was 3.9)
    + flask 3.1.0  (was 2.x.x)
```

`compare` is useful after updating a base image — confirms the CVE count went down and nothing new was introduced.

---

## Trivy vs Docker Scout — When to Use Each

```
Tool            Trivy                              Docker Scout
────────────────────────────────────────────────────────────────────────────
Type            Open source (free)                 Built into Docker CLI (free tier)
                                                   Paid tiers for advanced features
Install         Separate install required          Already in `docker` CLI
Speed           Fast — local DB, no API calls      Slower — calls Docker backend API
Air-gapped      Yes — download DB once             No — requires internet
CI/CD gate      --exit-code 1 — native             Scripting required
Output formats  table, json, sarif, cyclonedx      table, json, sarif
Base image recs No                                 Yes — recommends specific tags
DB sources      15+ sources (most comprehensive)   Docker's own DB
Best for        CI/CD pipelines, automation,       Developer desktop, quick checks,
                air-gapped, compliance scanning     remediation guidance, base image
                                                   selection
```

**Recommendation:**
- Use **Trivy** in CI/CD pipelines — `--exit-code 1` makes it a true security gate
- Use **Docker Scout** on your desktop — recommendations help you choose the right base image
- Use both together — they complement each other

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| CVE | Publicly disclosed vulnerability with ID, severity score, and fix version |
| CVSS score | 0–10 scale: Critical=9-10, High=7-8.9, Medium=4-6.9, Low=0.1-3.9 |
| Trivy | Open source scanner — scans images, filesystems, repos, IaC |
| `trivy image <name>` | Scan a local or remote image |
| `--severity HIGH,CRITICAL` | Filter to only actionable severities |
| `--ignore-unfixed` | Skip CVEs with no patch available — reduces noise |
| `--exit-code 1` | Fail CI/CD build if vulnerabilities found — the security gate |
| `--format json` | Machine-readable output for automation and dashboards |
| `.trivyignore` | Suppress accepted or false positive CVEs per project |
| `docker scout quickview` | CVE severity summary dashboard |
| `docker scout cves` | Detailed CVE list with fix versions |
| `docker scout recommendations` | Which base image tag fixes the most CVEs |
| `docker scout compare` | Diff two image versions — CVE count changes |
| Remediation workflow | Scan → identify → update base image/packages → rebuild → rescan |
| Scanning frequency | At build time in CI/CD + scheduled scans of running images |