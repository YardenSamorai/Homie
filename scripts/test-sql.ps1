# Runs a migration and its checks against the linked project inside one transaction that always rolls back.
# Usage: ./scripts/test-sql.ps1 0012_smart_shopping [project-ref]
param(
  [Parameter(Mandatory = $true)][string]$Migration,
  [string]$ProjectRef = "coapiwghkwwhofislwgv"
)

$root = Split-Path -Parent $PSScriptRoot
$sql = @(
  "begin;"
  Get-Content -LiteralPath (Join-Path $root "supabase/migrations/$Migration.sql") -Raw
  Get-Content -LiteralPath (Join-Path $root "supabase/tests/$Migration.test.sql") -Raw
  "rollback;"
) -join "`n"

$file = Join-Path ([System.IO.Path]::GetTempPath()) "homie-$Migration-test.sql"
Set-Content -LiteralPath $file -Value $sql -Encoding utf8
npx supabase db query --yes --remote=$ProjectRef -f $file 2>&1
Remove-Item -LiteralPath $file
