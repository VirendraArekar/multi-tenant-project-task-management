#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "          TeamBoard SaaS - Production Environment Setup   "
echo "=========================================================="

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    echo "Found existing $ENV_FILE file. Preserving existing secrets."
else
    echo "Generating cryptographically secure secrets in $ENV_FILE..."

    # Check for openssl or use python/shasum fallback
    gen_secret() {
        if command -v openssl >/dev/null 2>&1; then
            openssl rand -hex 16
        else
            head -c 16 /dev/urandom | xxd -p | tr -d '\n'
        fi
    }

    gen_jwt_secret() {
        if command -v openssl >/dev/null 2>&1; then
            openssl rand -base64 48 | tr -d '\n'
        else
            head -c 48 /dev/urandom | base64 | tr -d '\n'
        fi
    }

    MYSQL_PASS=$(gen_secret)
    MYSQL_ROOT_PASS=$(gen_secret)
    REDIS_PASS=$(gen_secret)
    JWT_SEC=$(gen_jwt_secret)

    cat <<EOF > "$ENV_FILE"
# ========================================================
# TeamBoard Configuration - Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ========================================================

# MySQL Configuration
MYSQL_DATABASE=teamboard
MYSQL_USER=teamboard_user
MYSQL_PASSWORD=${MYSQL_PASS}
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASS}
SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/teamboard?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8
SPRING_DATASOURCE_USERNAME=teamboard_user
SPRING_DATASOURCE_PASSWORD=${MYSQL_PASS}

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# JWT Security Configuration
JWT_SECRET=${JWT_SEC}
JWT_ACCESS_EXPIRATION=900
JWT_REFRESH_EXPIRATION=604800

# CORS & Gateway Configuration
CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost/api/v1

# Monitoring
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$(gen_secret)
EOF

    echo "Successfully generated $ENV_FILE."
fi

echo "Starting TeamBoard services with Docker Compose..."
docker compose up --build -d

echo ""
echo "=========================================================="
echo " TeamBoard is starting up! "
echo " - Web App:        http://localhost"
echo " - API Docs:       http://localhost/swagger-ui.html"
echo " - Health Check:   http://localhost/actuator/health"
echo " - Prometheus:     http://localhost:9090"
echo " - Grafana:        http://localhost:3001"
echo "=========================================================="
echo "Run 'docker compose logs -f' to view live application logs."
