$ErrorActionPreference = 'Stop'

python smoke_test.py
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Vérification locale terminée : la page répond et les fichiers requis sont présents."
