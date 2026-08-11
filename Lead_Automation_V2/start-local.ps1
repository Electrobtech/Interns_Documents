$ErrorActionPreference = 'Stop'

# Start API Gateway
Start-Process node -ArgumentList "src/index.js" -WorkingDirectory "api-gateway" -NoNewWindow -RedirectStandardOutput "api-gateway.log" -RedirectStandardError "api-gateway.err.log"

# Start Frontend
Start-Process npm.cmd -ArgumentList "run", "dev" -WorkingDirectory "frontend" -NoNewWindow -RedirectStandardOutput "frontend.log" -RedirectStandardError "frontend.err.log"

Write-Host "Local UI and Gateway started. Logs are being written to frontend.log and api-gateway.log in the root directory."
Write-Host "API Gateway: 8080 | Frontend: 3000"
