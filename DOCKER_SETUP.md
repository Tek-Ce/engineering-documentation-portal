# Docker Setup Guide

This guide will help you run the Engineering Documentation Portal using Docker containers.

## Prerequisites

1. **Install Docker**: https://docs.docker.com/get-docker/
2. **Install Docker Compose**: Usually included with Docker Desktop

Verify installation:
```bash
docker --version
docker-compose --version
```

## Quick Start (3 Commands)

```bash
# 1. Navigate to project directory
cd /home/kiplimo/Desktop/opt/Devs

# 2. Build and start all containers
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

Access the application:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Step-by-Step Instructions

### Step 1: Stop Local Servers (If Running)

If you have local servers running, stop them first:
```bash
# Stop any processes on port 8000, 3306, and 5173
lsof -ti:8000 | xargs kill -9
lsof -ti:3306 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Step 2: Build Docker Images

```bash
cd /home/kiplimo/Desktop/opt/Devs

# Build all images
docker-compose build

# This will:
# - Build backend image (Python + FastAPI)
# - Build frontend image (React + Nginx)
# - Pull MySQL 8.0 image
```

### Step 3: Start All Services

```bash
# Start in detached mode (background)
docker-compose up -d

# Or start with logs visible
docker-compose up
```

This starts:
- MySQL database on port 3306
- Backend API on port 8000
- Frontend on port 80

### Step 4: Check Container Status

```bash
# List running containers
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
```

### Step 5: Initialize Database

The backend will automatically create tables on first run. To verify:

```bash
# Execute a command in the backend container
docker-compose exec backend python -c "from app.main import app; print('Backend loaded successfully')"
```

### Step 6: Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Default Login**:
  - Email: `admin@engportal.local`
  - Password: `admin123`

## Common Docker Commands

### Managing Containers

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes (deletes database!)
docker-compose down -v

# Restart a specific service
docker-compose restart backend

# View container logs
docker-compose logs -f backend

# Execute command in running container
docker-compose exec backend bash
```

### Rebuilding After Code Changes

```bash
# Rebuild specific service
docker-compose build backend

# Rebuild and restart
docker-compose up -d --build backend

# Rebuild everything
docker-compose build --no-cache
docker-compose up -d
```

### Database Management

```bash
# Access MySQL shell
docker-compose exec mysql mysql -u enguser -pengpassword engportal

# Backup database
docker-compose exec mysql mysqldump -u enguser -pengpassword engportal > backup.sql

# Restore database
docker-compose exec -T mysql mysql -u enguser -pengpassword engportal < backup.sql
```

## Moving to Another Machine

### Option 1: Using Docker Images

**On current machine:**
```bash
# Save images
docker save -o engportal-backend.tar devs-backend:latest
docker save -o engportal-frontend.tar devs-frontend:latest

# Copy to new machine (USB, network, etc.)
```

**On new machine:**
```bash
# Load images
docker load -i engportal-backend.tar
docker load -i engportal-frontend.tar

# Copy docker-compose.yml and start
docker-compose up -d
```

### Option 2: Using Git + Docker (Recommended)

**On new machine:**
```bash
# 1. Clone from GitHub
git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
cd REPO_NAME

# 2. Build and run
docker-compose up -d
```

That's it! The application runs the same way on any machine with Docker.

## Volume Management

### Persistent Data

Docker volumes store data that persists across container restarts:

- **mysql_data**: Database files
- **./backend/uploads**: Uploaded documents

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect devs_mysql_data

# Remove unused volumes
docker volume prune
```

### Backup Volumes

```bash
# Backup uploads
tar -czf uploads-backup.tar.gz backend/uploads

# Restore uploads
tar -xzf uploads-backup.tar.gz
```

## Environment Variables

Edit `.env.docker` for production deployment:

```bash
# Generate a secure SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update .env.docker with the generated key
SECRET_KEY=your-generated-key-here
DEBUG=False
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8000
lsof -i:8000

# Kill the process
lsof -ti:8000 | xargs kill -9

# Or change port in docker-compose.yml
ports:
  - "8001:8000"  # External:Internal
```

### Container Won't Start

```bash
# View detailed logs
docker-compose logs backend

# Check container status
docker-compose ps

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Database Connection Issues

```bash
# Wait for MySQL to be ready
docker-compose logs mysql | grep "ready for connections"

# Test connection
docker-compose exec backend python -c "from app.db.database import engine; print('DB connected')"
```

### Frontend Can't Reach Backend

The frontend is configured to proxy API requests to the backend. Check:

1. Backend is running: `docker-compose ps backend`
2. Network connectivity: `docker-compose exec frontend ping backend`
3. Backend logs: `docker-compose logs backend`

### Reset Everything

```bash
# Stop and remove everything
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

### Security Checklist

- [ ] Change `SECRET_KEY` in `.env.docker`
- [ ] Change MySQL passwords
- [ ] Set `DEBUG=False`
- [ ] Use HTTPS (add reverse proxy like Nginx/Traefik)
- [ ] Enable firewall
- [ ] Regular backups
- [ ] Monitor logs

### Using Reverse Proxy (Nginx)

Add SSL/TLS termination and proper domain:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Benefits of Docker Deployment

✅ **Portability**: Run anywhere Docker is installed
✅ **Consistency**: Same environment on dev, test, and production
✅ **Isolation**: No conflicts with other applications
✅ **Easy Setup**: One command to start everything
✅ **Scalability**: Easy to add more containers
✅ **Version Control**: Docker images are versioned
✅ **Rollback**: Easy to revert to previous version

## Next Steps

1. Test the application: http://localhost
2. Upload some documents
3. Try the database reset feature
4. Create a backup
5. Deploy to a production server

For questions or issues, check the logs:
```bash
docker-compose logs -f
```
