# TeamBoard SaaS - Windows Setup Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "          TeamBoard SaaS - Production Environment Setup   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$envFile = ".env"

if (Test-Path $envFile) {
    Write-Host "Found existing $envFile file. Preserving existing secrets." -ForegroundColor Yellow
} else {
    Write-Host "Generating cryptographically secure secrets in $envFile..." -ForegroundColor Green

    function Get-RandomHex([int]$length) {
        $bytes = New-Object byte[] $length
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        return -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
    }

    function Get-RandomBase64([int]$length) {
        $bytes = New-Object byte[] $length
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        return [System.Convert]::ToBase64String($bytes)
    }

    $mysqlPass = Get-RandomHex 16
    $mysqlRootPass = Get-RandomHex 16
    $redisPass = Get-RandomHex 16
    $jwtSec = Get-RandomBase64 48
    $grafanaPass = Get-RandomHex 16

    $dateUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    $content = @"
# ========================================================
# TeamBoard Configuration - Generated $dateUtc
# ========================================================

# MySQL Configuration
MYSQL_DATABASE=teamboard
MYSQL_USER=teamboard_user
MYSQL_PASSWORD=$mysqlPass
MYSQL_ROOT_PASSWORD=$mysqlRootPass
SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/teamboard?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8
SPRING_DATASOURCE_USERNAME=teamboard_user
SPRING_DATASOURCE_PASSWORD=$mysqlPass

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$redisPass

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=kafka:9092

# JWT Security Configuration
JWT_SECRET=$jwtSec
JWT_ACCESS_EXPIRATION=900
JWT_REFRESH_EXPIRATION=604800

# CORS & Gateway Configuration
CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:80,http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost/api/v1

# Monitoring
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$grafanaPass
"@

    Set-Content -Path $envFile -Value $content
    Write-Host "Successfully generated $envFile." -ForegroundColor Green
}

Write-Host "Starting TeamBoard services with Docker Compose..." -ForegroundColor Green
docker compose up --build -d

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " TeamBoard is starting up! " -ForegroundColor Green
Write-Host " - Web App:        http://localhost"
Write-Host " - API Docs:       http://localhost/swagger-ui.html"
Write-Host " - Health Check:   http://localhost/actuator/health"
Write-Host " - Prometheus:     http://localhost:9090"
Write-Host " - Grafana:        http://localhost:3001"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Run 'docker compose logs -f' to view live application logs."
