# ============================================================
#  EducaENEM - servidor local (não precisa instalar nada)
# ------------------------------------------------------------
#  Sobe um servidor HTTP simples na sua própria máquina,
#  servindo os arquivos desta pasta. Feito só com PowerShell,
#  que já vem no Windows 10 e 11.
#
#  Uso normal: dê dois cliques em INICIAR.bat
#  Uso manual: powershell -ExecutionPolicy Bypass -File iniciar-servidor.ps1
# ============================================================

param(
  [int]$PortaInicial = 8787,
  [int]$Tentativas = 10
)

$ErrorActionPreference = "Stop"
$raiz = (Resolve-Path $PSScriptRoot).Path

# Tipos de arquivo e como o navegador deve tratá-los.
$tipos = @{
  ".html"   = "text/html; charset=utf-8"
  ".htm"    = "text/html; charset=utf-8"
  ".js"     = "text/javascript; charset=utf-8"
  ".mjs"    = "text/javascript; charset=utf-8"
  ".css"    = "text/css; charset=utf-8"
  ".json"   = "application/json; charset=utf-8"
  ".svg"    = "image/svg+xml"
  ".png"    = "image/png"
  ".jpg"    = "image/jpeg"
  ".jpeg"   = "image/jpeg"
  ".gif"    = "image/gif"
  ".webp"   = "image/webp"
  ".ico"    = "image/x-icon"
  ".pdf"    = "application/pdf"
  ".mp4"    = "video/mp4"
  ".webm"   = "video/webm"
  ".mp3"    = "audio/mpeg"
  ".wav"    = "audio/wav"
  ".woff"   = "font/woff"
  ".woff2"  = "font/woff2"
  ".txt"    = "text/plain; charset=utf-8"
  ".md"     = "text/plain; charset=utf-8"
  ".zip"    = "application/zip"
}

function Enviar-Resposta {
  param($Stream, [string]$Metodo, [int]$Codigo, [string]$Motivo, [string]$Tipo, $Dados)

  $corpo = $false
  if ($Dados -is [string]) {
    $Dados = [System.Text.Encoding]::UTF8.GetBytes($Dados)
    $corpo = $true
  } elseif ($null -ne $Dados) {
    $corpo = $true
  }

  $cab = "HTTP/1.1 $Codigo $Motivo`r`n"
  $cab += "Content-Type: $Tipo`r`n"
  $cab += "Content-Length: $($Dados.Length)`r`n"
  $cab += "Cache-Control: no-cache`r`n"
  $cab += "Connection: close`r`n`r`n"
  $b = [System.Text.Encoding]::ASCII.GetBytes($cab)
  $Stream.Write($b, 0, $b.Length)
  if ($corpo -and $Metodo -ne "HEAD") {
    $Stream.Write($Dados, 0, $Dados.Length)
  }
}

function Pegar-Arquivo {
  param([string]$Requisicao)

  # "/index.html?x=1" -> "index.html"
  $caminho = $Requisicao.Split("?")[0].Split("#")[0]
  $caminho = [System.Uri]::UnescapeDataString($caminho)
  if ([string]::IsNullOrWhiteSpace($caminho) -or $caminho -eq "/") { $caminho = "/index.html" }
  $caminho = $caminho.TrimStart("/")

  $completo = [System.IO.Path]::GetFullPath((Join-Path $raiz $caminho))

  # Não deixa sair da pasta do site (proteção contra "../../etc/passwd")
  if (-not $completo.StartsWith($raiz, [System.StringComparison]::OrdinalIgnoreCase)) {
    return @{ Erro = 403; Motivo = "Forbidden"; Conteudo = $null }
  }
  if (-not (Test-Path $completo -PathType Leaf)) {
    return @{ Erro = 404; Motivo = "Not Found"; Conteudo = $null }
  }

  $ext = [System.IO.Path]::GetExtension($completo).ToLowerInvariant()
  $tipo = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { "application/octet-stream" }

  return @{ Erro = 0; Motivo = "OK"; Conteudo = [System.IO.File]::ReadAllBytes($completo); Tipo = $tipo }
}

# Acha uma porta livre
$listener = $null
$porta = 0
for ($p = $PortaInicial; $p -lt ($PortaInicial + $Tentativas); $p++) {
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $listener.Start()
    $porta = $p
    break
  } catch {
    $listener = $null
  }
}
if ($null -eq $listener) {
  Write-Host ""
  Write-Host "  Nao consegui abrir nenhuma porta entre $PortaInicial e $($PortaInicial + $Tentativas - 1)." -ForegroundColor Red
  Write-Host "  Feche outros programas que possam estar usando essas portas e tente de novo." -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Pressione ENTER para fechar"
  exit 1
}

$url = "http://127.0.0.1:$porta/index.html"
$inicio = Get-Date

Write-Host ""
Write-Host "  ===============================================" -ForegroundColor Cyan
Write-Host "   EducaENEM - curso online do Prof. Marcelo" -ForegroundColor Cyan
Write-Host "  ===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Site abrindo no navegador em:" -ForegroundColor Green
Write-Host "   $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Pasta servida: $raiz" -ForegroundColor DarkGray
Write-Host "   Para PARAR o site: feche esta janela (ou Ctrl+C)." -ForegroundColor DarkGray
Write-Host ""

try { Start-Process $url } catch { Write-Host "   Abra manualmente: $url" -ForegroundColor Yellow }

while ($true) {
  $cliente = $null
  try {
    $cliente = $listener.AcceptTcpClient()
    $stream = $cliente.GetStream()
    $stream.ReadTimeout = 15000

    $leitor = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
    $linha = $leitor.ReadLine()
    if ([string]::IsNullOrEmpty($linha)) { $cliente.Close(); continue }

    # Descarta o restante dos cabeçalhos
    while ($true) {
      $h = $leitor.ReadLine()
      if ($null -eq $h -or $h -eq "") { break }
    }

    $partes = $linha.Split(" ")
    if ($partes.Length -lt 2) { $cliente.Close(); continue }
    $metodo = $partes[0].ToUpperInvariant()
    $requisicao = $partes[1]

    if ($metodo -ne "GET" -and $metodo -ne "HEAD") {
      Enviar-Resposta -Stream $stream -Metodo $metodo -Codigo 405 -Motivo "Method Not Allowed" -Tipo "text/plain; charset=utf-8" -Dados "Somente GET."
      $cliente.Close()
      continue
    }

    $arquivo = Pegar-Arquivo -Requisicao $requisicao

    if ($arquivo.Erro -eq 0) {
      Enviar-Resposta -Stream $stream -Metodo $metodo -Codigo 200 -Motivo "OK" -Tipo $arquivo.Tipo -Dados $arquivo.Conteudo
    } elseif ($arquivo.Erro -eq 403) {
      Enviar-Resposta -Stream $stream -Metodo $metodo -Codigo 403 -Motivo "Forbidden" -Tipo "text/plain; charset=utf-8" -Dados "Acesso negado."
    } else {
      $nao = "<!doctype html><html lang='pt-br'><meta charset='utf-8'><title>404</title>" +
             "<body style='font-family:system-ui,sans-serif;padding:40px'>" +
             "<h1>404 - arquivo nao encontrado</h1><p>O endereco <b>$([System.Net.WebUtility]::HtmlEncode($requisicao))</b> nao existe.</p>" +
             "<p><a href='/index.html'>Voltar para o site</a></p></body></html>"
      Enviar-Resposta -Stream $stream -Metodo $metodo -Codigo 404 -Motivo "Not Found" -Tipo "text/html; charset=utf-8" -Dados $nao
    }
  } catch {
    # Erro de rede pontual (navegador cancelou a conexao, etc.): segue o baile.
  } finally {
    if ($null -ne $cliente) { try { $cliente.Close() } catch {} }
  }
}
