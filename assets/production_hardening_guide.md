# Production Hardening & Remediation Guide

This guide provides a comprehensive, step-by-step blueprint to remediate all security, architectural, and operational gaps identified in the [Production Readiness Audit](file:///home/ansira-u/Documents/Development/loco-works-management-system/assets/production_readiness_audit.md). Following these steps will transition the **Loco Works Management System (LWMS)** into a fully production-ready application.

---

## Step 1: Database Migration & Schema Hardening

### 1.1 Remove Runtime DDL Execution from FastAPI Lifespan
Currently, `app/main.py` automatically runs `Base.metadata.create_all` during application startup, which causes race conditions and schema drift in multi-replica deployments.

**Action**: Open `backend/app/main.py` and modify the lifespan function to remove runtime DDL execution:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background stream and pub/sub listeners
    stream_task = asyncio.create_task(redis_stream_listener())
    chat_task = asyncio.create_task(chat_pubsub_listener())
    yield
    stream_task.cancel()
    chat_task.cancel()
```

### 1.2 Enforce Out-of-Band Alembic Migrations
In production, database migrations must execute prior to launching web containers. Run migrations via Alembic in your deployment pipeline or release entrypoint script:

```bash
# Execute outstanding database migrations before application release
docker compose exec web-1 alembic upgrade head
```

### 1.3 Eliminate Default Password Fallbacks
Remove default plain-text fallbacks in environment variable evaluations to prevent containers from running with default credentials if `.env` values are omitted.

**Action**: Update `.env` and `docker-compose.yml` environment blocks to enforce explicit variables without fallback defaults:
```yaml
# In docker-compose.yml: replace ${POSTGRES_PASSWORD:-locopass} with:
POSTGRESQL_PASSWORD: ${POSTGRES_PASSWORD}
```

---

## Step 2: Application Security & Middleware Hardening

### 2.1 Dynamic HTTPS Cookie Security
Currently, `write_window_lag` cookie generation sets `secure=False`.

**Action**: Modify `db_routing_middleware` in `backend/app/main.py` to evaluate the request scheme dynamically or check settings:

```python
is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"

response.set_cookie(
    key="write_window_lag",
    value="1",
    max_age=2,
    httponly=True,
    samesite="lax",
    secure=is_https,
)
```

### 2.2 Implement Nginx Rate-Limiting on Auth Routes
Protect sensitive authentication and verification routes against brute-force and credential stuffing attacks.

**Action**: Open `infrastructure/nginx/nginx.conf` and define rate-limiting zones in the `http` block:

```nginx
http {
    # Define rate-limiting zone: 10 requests per minute per IP for auth routes
    limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
    limit_req_status 429;

    server {
        # Apply rate limiting to authentication endpoints
        location /api/v1/auth/ {
            limit_req zone=auth_limit burst=5 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 2.3 Add Global Exception Handlers
Prevent unhandled Python runtime exceptions from exposing internal stack traces to end users.

**Action**: Add a central exception handler in `backend/app/main.py`:

```python
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact system support."}
    )
```

---

## Step 3: Container Immutability & Topology Optimization

### 3.1 Separate Development & Production Docker Topologies
Keep development debugging tools (Mailpit, Ngrok, live host code bind mounts) isolated from production deployments.

**Action**: Create `docker-compose.prod.yml` for production deployments. Omit host code bind mounts under `volumes:` in web services:

```yaml
  web-1:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: loco_web_1
    restart: always
    env_file:
      - .env
    # Omit local code mounts (- ./backend/app:/app/app) to preserve image immutability
    depends_on:
      db-primary:
        condition: service_healthy
      redis-master:
        condition: service_healthy
```

### 3.2 Add Container Healthchecks and Resource Limits
Define CPU/Memory bounds and healthcheck probes in `docker-compose.prod.yml` for all service containers:

```yaml
  db-primary:
    image: bitnami/postgresql:latest
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2.00'
          memory: 2048M

  web-1:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.00'
          memory: 1024M
```

---

## Step 4: Verification & Deployment Sequence

Execute the following verification sequence before promoting to a production host:

1. **Build Production Assets**:
   ```bash
   cd frontend && npm run build
   ```
2. **Launch Production Stack**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. **Run Database Migrations**:
   ```bash
   docker compose -f docker-compose.prod.yml exec web-1 alembic upgrade head
   ```
4. **Verify Endpoint Health & Rate Limits**:
   ```bash
   curl -i http://localhost/api/v1/health
   ```
