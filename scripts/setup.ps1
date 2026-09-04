# Bootstrap local de CuchosTool (F0). Ejecutar desde la raiz: powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
$ErrorActionPreference = 'Stop'

Write-Host '[1/5] Instalando dependencias npm...'
npm install --no-audit --no-fund

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host '[2/5] Creado .env desde .env.example'
} else { Write-Host '[2/5] .env ya existe' }

Write-Host '[3/5] Levantando PostgreSQL (Docker)...'
docker compose up -d db

Write-Host '[4/5] Migraciones y seed...'
Push-Location apps/api
$env:DATABASE_URL = 'postgres://cuchos:cuchos_dev_pass@localhost:5433/cuchostool_dev'
npx drizzle-kit migrate
npx tsx src/db/seed.ts
Pop-Location

Write-Host '[5/5] Pruebas...'
npm test -w @cuchostool/api

Write-Host 'Listo. Levanta API: npm run dev:api | Web: npm run dev:web'
