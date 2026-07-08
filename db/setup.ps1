# Vento - Setup de Base de Datos Local
# Requiere: PostgreSQL 16 instalado y en PATH

param(
    [string]$DbName = "vento",
    [string]$DbUser = "vento",
    [string]$DbPass = "vento_dev",
    [string]$Host = "localhost"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Vento - Setup de Base de Datos ===" -ForegroundColor Cyan

# 1. Verificar que PostgreSQL está instalado
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL detectado: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ PostgreSQL no encontrado. Instálalo desde https://www.postgresql.org/download/" -ForegroundColor Red
    exit 1
}

# 2. Crear usuario si no existe
Write-Host "`nCreando usuario '$DbUser'..." -ForegroundColor Yellow
try {
    psql -U postgres -c "CREATE USER $DbUser WITH PASSWORD '$DbPass';" 2>$null
    Write-Host "✓ Usuario creado" -ForegroundColor Green
} catch {
    Write-Host "  El usuario ya existe (ok)" -ForegroundColor Gray
}

# 3. Crear base de datos
Write-Host "Creando base de datos '$DbName'..." -ForegroundColor Yellow
try {
    psql -U postgres -c "CREATE DATABASE $DbName OWNER $DbUser;" 2>$null
    Write-Host "✓ Base de datos creada" -ForegroundColor Green
} catch {
    Write-Host "  La base ya existe (ok)" -ForegroundColor Gray
}

# 4. Ejecutar schema
Write-Host "`nEjecutando schema (init.sql)..." -ForegroundColor Yellow
try {
    psql -U postgres -d $DbName -f "$PSScriptRoot\init.sql"
    Write-Host "✓ Schema aplicado" -ForegroundColor Green
} catch {
    Write-Host "✗ Error aplicando schema: $_" -ForegroundColor Red
    exit 1
}

# 5. Ejecutar seed
Write-Host "`nInsertando datos de prueba (seed.sql)..." -ForegroundColor Yellow
try {
    psql -U postgres -d $DbName -f "$PSScriptRoot\seed.sql"
    Write-Host "✓ Seed insertado" -ForegroundColor Green
} catch {
    Write-Host "✗ Error insertando seed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Setup completado ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resumen:"
Write-Host "  Host:     $Host"
Write-Host "  Puerto:   5432"
Write-Host "  Base:     $DbName"
Write-Host "  Usuario:  $DbUser"
Write-Host "  Password: $DbPass"
Write-Host ""
Write-Host "Login de prueba: admin@vento.app / admin123" -ForegroundColor Green
