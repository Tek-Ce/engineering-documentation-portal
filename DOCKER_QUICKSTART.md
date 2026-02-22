# Docker Migration - Quick Start Guide

## Current Status
Your Docker build is running in the background. It will take **5-10 minutes** to complete.

---

## Step-by-Step Commands

### 1. Navigate to Project Directory
```bash
cd /home/kiplimo/Desktop/opt/Devs
```

### 2. Build All Docker Images (Currently Running)
```bash
docker-compose build --no-cache
```
**Status:** In progress (installing dependencies)
**Time:** ~5-10 minutes

### 3. Start All Services
```bash
docker-compose up -d
```
This starts:
- MySQL database on port 3307 (host) → 3306 (container)
- Backend API on port 8000
- Frontend on port 80

### 4. Check Container Status
```bash
docker-compose ps
```
All containers should show "Up" status.

### 5. View Logs
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql

# Press Ctrl+C to exit logs
```

### 6. Access Your Application
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **Database:** localhost:3307 (user: enguser, password: engpassword)

---

## Daily Usage Commands

### Start Services
```bash
cd /home/kiplimo/Desktop/opt/Devs
docker-compose up -d
```

### Stop Services
```bash
docker-compose stop
```

### Restart a Service
```bash
docker-compose restart backend
docker-compose restart frontend
docker-compose restart mysql
```

### View Service Logs
```bash
docker-compose logs -f backend
```

### Stop and Remove All Containers
```bash
docker-compose down
```

### Stop and Remove Everything (INCLUDING DATABASE DATA)
```bash
docker-compose down -v
```
⚠️ **Warning:** This deletes all database data!

---

## Troubleshooting

### Container Won't Start?
```bash
# Check logs for errors
docker-compose logs backend

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

### Database Issues?
```bash
# Reset database (WARNING: Deletes all data)
docker-compose down -v
docker-compose up -d

# Check if database is healthy
docker-compose ps
```

### Port Already in Use?
```bash
# Find what's using the port
sudo lsof -i :8000  # Backend
sudo lsof -i :80    # Frontend
sudo lsof -i :3307  # MySQL

# Kill the process
sudo kill -9 <PID>
```

### Need to Update Code?
```bash
# Backend code changes
docker-compose restart backend

# Frontend code changes (requires rebuild)
docker-compose build frontend
docker-compose up -d frontend
```

---

## File Structure

```
/home/kiplimo/Desktop/opt/Devs/
├── docker-compose.yml          # Main orchestration file
├── .env.docker                 # Environment variables template
├── backend/
│   ├── Dockerfile             # Backend container definition
│   ├── .dockerignore          # Files to exclude from container
│   └── requirements.txt       # Python dependencies
└── engineering-portal-frontend/
    ├── Dockerfile             # Frontend container definition
    ├── .dockerignore          # Files to exclude from container
    └── nginx.conf             # Nginx web server config
```

---

## Environment Variables

The Docker setup uses these environment variables (defined in docker-compose.yml):

**Database:**
- MYSQL_ROOT_PASSWORD=rootpassword
- MYSQL_DATABASE=engportal
- MYSQL_USER=enguser
- MYSQL_PASSWORD=engpassword

**Backend:**
- DATABASE_URL=mysql://enguser:engpassword@mysql:3306/engportal
- SECRET_KEY=your-super-secret-key-change-this-in-production
- ALGORITHM=HS256
- ACCESS_TOKEN_EXPIRE_MINUTES=30
- DEBUG=True

⚠️ **For Production:** Generate a secure SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Next Steps After Build Completes

1. **Wait for build to finish** (check progress with background job)
2. **Start services:** `docker-compose up -d`
3. **Check status:** `docker-compose ps`
4. **View logs:** `docker-compose logs -f`
5. **Access app:** http://localhost
6. **Create admin user:**
   ```bash
   docker-compose exec backend python scripts/create_admin.py
   ```

---

## Benefits of Docker

✅ **Portable:** Works on any machine with Docker installed
✅ **Isolated:** Doesn't interfere with local MySQL/Python installations
✅ **Consistent:** Same environment for development and production
✅ **Easy Deployment:** Just copy files and run `docker-compose up -d`
✅ **Easy Cleanup:** `docker-compose down -v` removes everything

---

## Getting Help

**View container details:**
```bash
docker-compose ps
docker-compose logs <service-name>
```

**Access container shell:**
```bash
docker-compose exec backend bash
docker-compose exec frontend sh
docker-compose exec mysql bash
```

**Check Docker resources:**
```bash
docker system df          # Disk usage
docker system prune       # Clean up unused resources
```

---

Generated: 2025-12-05
