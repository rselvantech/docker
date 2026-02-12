# MongoDB Installation and Configuration Guide for Ubuntu

## Overview

This guide provides step-by-step instructions to install and configure MongoDB Community Edition on Ubuntu for use with Docker container networking demos. MongoDB will run on your host machine and be accessible to Docker containers.

## System Requirements

**Supported Ubuntu Versions:**
- Ubuntu 24.04 LTS (Noble)
- Ubuntu 22.04 LTS (Jammy)
- Ubuntu 20.04 LTS (Focal)

**Minimum Requirements:**
- 2 GB RAM
- 10 GB free disk space
- 64-bit processor

## Installation Methods

This guide covers **Method 1: Official MongoDB Repository** (recommended for production-like setup).

---

## Method 1: Install from Official MongoDB Repository

### Step 1: Import MongoDB GPG Key

**1.1 Update package index:**

```bash
sudo apt-get update
```

**1.2 Install required packages:**

```bash
sudo apt-get install -y gnupg curl
```

**1.3 Import MongoDB public GPG key:**

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
   --dearmor
```

**Verification:**
```bash
# Check key was added
ls -la /usr/share/keyrings/mongodb-server-7.0.gpg
```

Expected output:
```
-rw-r--r-- 1 root root 3243 Jan 15 10:30 /usr/share/keyrings/mongodb-server-7.0.gpg
```

### Step 2: Add MongoDB Repository

**2.1 Determine your Ubuntu version:**

```bash
lsb_release -dc
```

**Expected output examples:**
```
Description:    Ubuntu 24.04 LTS
Codename:       noble
```

**2.2 Create MongoDB repository list file:**

**For Ubuntu 24.04 (Noble):**

⚠️ **Important:** MongoDB 7.0 doesn't have official packages for Ubuntu 24.04 yet. We'll use the Ubuntu 22.04 (Jammy) repository which is compatible:

```bash
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

**For Ubuntu 22.04 (Jammy):**
```bash
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

**For Ubuntu 20.04 (Focal):**
```bash
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

**2.3 Verify repository was added:**

```bash
cat /etc/apt/sources.list.d/mongodb-org-7.0.list
```

### Step 3: Install MongoDB

**3.1 Reload package database:**

```bash
sudo apt-get update
```

**3.2 Install MongoDB packages:**

```bash
sudo apt-get install -y mongodb-org
```

**Expected output (truncated):**
```
Reading package lists... Done
Building dependency tree... Done
The following NEW packages will be installed:
  mongodb-database-tools mongodb-mongosh mongodb-org mongodb-org-database
  mongodb-org-database-tools-extra mongodb-org-mongos mongodb-org-server
  mongodb-org-shell mongodb-org-tools
...
Setting up mongodb-org (7.0.x) ...
```

**3.3 Verify installation:**

```bash
mongod --version
```

**Expected output:**
```
db version v7.0.x
Build Info: {
    "version": "7.0.x",
    "gitVersion": "...",
    "openSSLVersion": "OpenSSL 3.0.x",
    "modules": [],
    "allocator": "tcmalloc",
    "environment": {
        "distmod": "ubuntu2404",
        "distarch": "x86_64",
        "target_arch": "x86_64"
    }
}
```

✅ **MongoDB installed successfully!**

### Step 4: Start MongoDB Service

**4.1 Start MongoDB:**

```bash
sudo systemctl start mongod
```

**4.2 Check service status:**

```bash
sudo systemctl status mongod
```

**Expected output:**
```
● mongod.service - MongoDB Database Server
     Loaded: loaded (/lib/systemd/system/mongod.service; disabled; vendor preset: enabled)
     Active: active (running) since Thu 2026-02-05 10:30:15 UTC; 5s ago
       Docs: https://docs.mongodb.org/manual
   Main PID: 12345 (mongod)
     Memory: 64.5M
        CPU: 1.234s
     CGroup: /system.slice/mongod.service
             └─12345 /usr/bin/mongod --config /etc/mongod.conf

Feb 05 10:30:15 ubuntu systemd[1]: Started MongoDB Database Server.
```

**Look for:** `Active: active (running)`

✅ **MongoDB is running!**

**4.3 Enable MongoDB to start on boot:**

```bash
sudo systemctl enable mongod
```

**Expected output:**
```
Created symlink /etc/systemd/system/multi-user.target.wants/mongod.service → /lib/systemd/system/mongod.service.
```

### Step 5: Verify MongoDB is Listening

**5.1 Check MongoDB is listening on port 27017:**

```bash
sudo netstat -tuln | grep 27017
```

**Or using `ss` (if netstat not available):**

```bash
sudo ss -tuln | grep 27017
```

**Expected output:**
```
tcp        0      0 127.0.0.1:27017         0.0.0.0:*               LISTEN
```

**Note:** By default, MongoDB listens only on `127.0.0.1` (localhost).

**5.2 Connect to MongoDB shell:**

```bash
mongosh
```

**Expected output:**
```
Current Mongosh Log ID: 65c1234567890abcdef12345
Connecting to:          mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.1.0
Using MongoDB:          7.0.x
Using Mongosh:          2.1.0

For mongosh info see: https://docs.mongodb.com/mongodb-shell/

test>
```

**5.3 Test basic MongoDB commands:**

```javascript
// Show databases
show dbs

// Switch to test database
use testdb

// Insert test document
db.testcollection.insertOne({ name: "Docker Test", type: "demo" })

// Query document
db.testcollection.find()
```

**Expected output:**
```
[
  {
    _id: ObjectId('65c1234567890abcdef12345'),
    name: 'Docker Test',
    type: 'demo'
  }
]
```

**5.4 Exit MongoDB shell:**

```javascript
exit
```

✅ **MongoDB is working correctly!**

---

## Configuration for Docker Access

By default, MongoDB only accepts connections from localhost (`127.0.0.1`). To allow Docker containers to connect, we need to configure MongoDB's network settings.

### Understanding the Network Configuration

**Default MongoDB binding:**
```yaml
net:
  bindIp: 127.0.0.1
```

This means MongoDB only accepts connections from the same machine.

**For Docker containers to connect, we have two options:**

1. **Option A:** Use Docker's special DNS name `host.docker.internal` (recommended, no MongoDB config change needed)
2. **Option B:** Configure MongoDB to listen on all interfaces (less secure, useful for testing)

### Option A: Using host.docker.internal (Recommended)

**No MongoDB configuration change needed!**

In your Docker container application, use:

```javascript
// Instead of this:
mongoose.connect('mongodb://localhost:27017/swfavorites')

// Use this:
mongoose.connect('mongodb://host.docker.internal:27017/swfavorites')
```

**How it works:**
- Docker Desktop provides special DNS name `host.docker.internal`
- This DNS name resolves to host machine's IP
- Container can reach host services on localhost

**Supported platforms:**
- ✅ Docker Desktop for Mac
- ✅ Docker Desktop for Windows
- ⚠️ Linux requires additional configuration (see below)

**For Linux users:**

Add `--add-host=host.docker.internal:host-gateway` to `docker run`:

```bash
docker run --add-host=host.docker.internal:host-gateway -p 3000:3000 myapp
```

**AND configure MongoDB to listen on Docker bridge:**

**Step 1: Find Docker gateway IP:**
```bash
docker network inspect bridge | grep Gateway
```

Expected: `"Gateway": "172.17.0.1"`

**Step 2: Edit MongoDB config:**
```bash
sudo nano /etc/mongod.conf
```

**Step 3: Update bindIp to include Docker gateway:**
```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,172.17.0.1
```

**Step 4: Restart MongoDB:**
```bash
sudo systemctl restart mongod
```

**Step 5: Verify:**
```bash
sudo netstat -tuln | grep 27017
```

Expected output (two lines):
```
tcp        0      0 127.0.0.1:27017         0.0.0.0:*               LISTEN
tcp        0      0 172.17.0.1:27017        0.0.0.0:*               LISTEN
```

✅ **Now containers can connect using `host.docker.internal`!**

### Option B: Configure MongoDB to Listen on All Interfaces

**⚠️ Warning:** This makes MongoDB accessible from network. Only use for development/testing!

**6.1 Edit MongoDB configuration:**

```bash
sudo nano /etc/mongod.conf
```

**6.2 Find the `net:` section and modify `bindIp`:**

**Before:**
```yaml
# network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1
```

**After:**
```yaml
# network interfaces
net:
  port: 27017
  bindIp: 0.0.0.0
```

**What changed:**
- `127.0.0.1` → `0.0.0.0`
- MongoDB will listen on all network interfaces
- Accessible from host IP address

**6.3 Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

**6.4 Restart MongoDB to apply changes:**

```bash
sudo systemctl restart mongod
```

**6.5 Verify new binding:**

```bash
sudo netstat -tuln | grep 27017
```

**Expected output:**
```
tcp        0      0 0.0.0.0:27017           0.0.0.0:*               LISTEN
```

**Note:** Now listening on `0.0.0.0` (all interfaces) instead of `127.0.0.1`.

**6.6 Find your host machine IP:**

```bash
hostname -I | awk '{print $1}'
```

**Example output:**
```
192.168.1.100
```

**6.7 Test from container using host IP:**

```javascript
// In your application
mongoose.connect('mongodb://192.168.1.100:27017/swfavorites')
```

---

## Create Database for Demo Application

### Step 7: Setup Star Wars Favorites Database

**7.1 Connect to MongoDB:**

```bash
mongosh
```

**7.2 Create and switch to demo database:**

```javascript
use swfavorites
```

**Expected output:**
```
switched to db swfavorites
```

**7.3 Create a test document (optional):**

```javascript
db.favorites.insertOne({
  type: "movie",
  name: "The Empire Strikes Back",
  url: "https://swapi.dev/api/films/2/"
})
```

**Expected output:**
```javascript
{
  acknowledged: true,
  insertedId: ObjectId('65c1234567890abcdef12345')
}
```

**7.4 Verify the document:**

```javascript
db.favorites.find()
```

**7.5 Exit shell:**

```javascript
exit
```

✅ **Database `swfavorites` is ready!**

---

## MongoDB Service Management

### Common Commands

**Start MongoDB:**
```bash
sudo systemctl start mongod
```

**Stop MongoDB:**
```bash
sudo systemctl stop mongod
```

**Restart MongoDB:**
```bash
sudo systemctl restart mongod
```

**Check status:**
```bash
sudo systemctl status mongod
```

**Enable auto-start on boot:**
```bash
sudo systemctl enable mongod
```

**Disable auto-start:**
```bash
sudo systemctl disable mongod
```

**View MongoDB logs:**
```bash
sudo tail -f /var/log/mongodb/mongod.log
```

---

## Verification Checklist

Before proceeding with Docker demos, verify:

- [ ] MongoDB installed: `mongod --version`
- [ ] MongoDB service running: `sudo systemctl status mongod`
- [ ] MongoDB listening on 27017: `sudo netstat -tuln | grep 27017`
- [ ] Can connect with mongosh: `mongosh`
- [ ] Database created: `use swfavorites`
- [ ] Configuration chosen:
  - [ ] Option A: Will use `host.docker.internal`
  - [ ] Option B: MongoDB listening on `0.0.0.0`

---

## Troubleshooting

### Error: "Repository does not have a Release file" (404 Error)

**Full error message:**
```
E: The repository 'https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 Release' does not have a Release file.
```

**Cause:** MongoDB 7.0 doesn't have official packages for Ubuntu 24.04 (Noble) yet.

**Solution:** Use Ubuntu 22.04 (Jammy) repository instead (it's compatible):

**Step 1: Remove incorrect repository:**
```bash
sudo rm /etc/apt/sources.list.d/mongodb-org-7.0.list
```

**Step 2: Add correct repository (Jammy for Noble):**
```bash
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

**Step 3: Update and install:**
```bash
sudo apt-get update
sudo apt-get install -y mongodb-org
```

✅ **This works because Ubuntu 24.04 is binary-compatible with Ubuntu 22.04 packages.**

### MongoDB service fails to start

**Check logs:**
```bash
sudo journalctl -u mongod -n 50
```

**Common issues:**
- Port 27017 already in use
- Permission issues with data directory
- Invalid configuration syntax

**Solution - Reset data directory permissions:**
```bash
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown mongodb:mongodb /tmp/mongodb-27017.sock
sudo systemctl restart mongod
```

### Cannot connect with mongosh

**Verify service is running:**
```bash
sudo systemctl status mongod
```

**Check if port is listening:**
```bash
sudo netstat -tuln | grep 27017
```

**Try connecting with explicit host:**
```bash
mongosh --host 127.0.0.1 --port 27017
```

### Docker container cannot connect to MongoDB

**If using host.docker.internal:**

**Mac/Windows:**
```javascript
mongoose.connect('mongodb://host.docker.internal:27017/swfavorites')
```

**Linux:**
```bash
docker run --add-host=host.docker.internal:host-gateway ...
```

**If using host IP (Option B):**

1. Verify MongoDB listening on 0.0.0.0:
```bash
sudo netstat -tuln | grep 27017
```

2. Get host IP:
```bash
hostname -I | awk '{print $1}'
```

3. Use IP in connection string:
```javascript
mongoose.connect('mongodb://192.168.1.100:27017/swfavorites')
```

### "connection refused" errors

**Check firewall (if using host IP):**

```bash
# Ubuntu/Debian
sudo ufw status
sudo ufw allow 27017

# Check if firewall is blocking
sudo iptables -L -n | grep 27017
```

---

## Uninstalling MongoDB

If you need to remove MongoDB:

### Stop and disable service

```bash
sudo systemctl stop mongod
sudo systemctl disable mongod
```

### Remove packages

```bash
sudo apt-get purge -y mongodb-org*
```

### Remove data and logs

```bash
sudo rm -rf /var/log/mongodb
sudo rm -rf /var/lib/mongodb
```

### Remove repository

```bash
sudo rm /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo rm /usr/share/keyrings/mongodb-server-7.0.gpg
```

### Update package index

```bash
sudo apt-get update
```

---

## Additional Resources

**Official Documentation:**
- MongoDB Installation Guide: https://docs.mongodb.com/manual/installation/
- MongoDB Configuration: https://docs.mongodb.com/manual/reference/configuration-options/
- MongoDB Shell (mongosh): https://docs.mongodb.com/mongodb-shell/

**Docker Networking:**
- Docker host networking: https://docs.docker.com/network/host/
- Container networking: https://docs.docker.com/config/containers/container-networking/

---

## Security Notes

**For Development/Testing:**
- MongoDB installed without authentication is acceptable
- Binding to 0.0.0.0 is acceptable on local machine

**For Production:**
- ❌ Never bind to 0.0.0.0 without authentication
- ✅ Enable authentication and authorization
- ✅ Use TLS/SSL for connections
- ✅ Configure network security groups/firewall rules
- ✅ Use connection string with credentials
- ✅ Regular backups and monitoring

**Example production connection with auth:**
```javascript
mongoose.connect('mongodb://username:password@host:27017/database?authSource=admin')
```

---

## Quick Reference Summary

| Task | Command |
|------|---------|
| Install MongoDB | `sudo apt-get install -y mongodb-org` |
| Start service | `sudo systemctl start mongod` |
| Check status | `sudo systemctl status mongod` |
| Connect to shell | `mongosh` |
| View logs | `sudo tail -f /var/log/mongodb/mongod.log` |
| Edit config | `sudo nano /etc/mongod.conf` |
| Restart after config change | `sudo systemctl restart mongod` |
| Check listening port | `sudo netstat -tuln \| grep 27017` |

---

**Your MongoDB installation is now ready for Docker container networking demos!** 🚀