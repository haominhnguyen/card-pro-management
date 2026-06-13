// Cross-platform port killer — called by npm predev / prestart:dev hooks
const { execSync } = require('child_process');
const port = process.argv[2];
if (!port) process.exit(0);
try {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "$p=(Get-NetTCPConnection -LocalPort ${port} -EA SilentlyContinue).OwningProcess|Sort-Object -Unique;if($p){$p|ForEach-Object{Stop-Process -Id $_ -Force -EA SilentlyContinue};Write-Host '[kill-port] Freed port ${port}'}"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { shell: true });
  }
} catch {}
