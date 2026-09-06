# Generates PWA icons from the approved source logo (assets/app_icon.png).
# Outputs regular / maskable / Apple Touch icons into public/, and refreshes
# the web favicon source (assets/images/favicon.png).
# Requires Windows PowerShell 5.1 (System.Drawing). No third-party deps.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$srcPath = Join-Path $projectRoot 'assets\app_icon.png'
$publicDir = Join-Path $projectRoot 'public'
$faviconPath = Join-Path $projectRoot 'assets\images\favicon.png'

if (-not (Test-Path $srcPath)) { throw "Missing source icon: $srcPath" }
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

$src = [System.Drawing.Image]::FromFile($srcPath)
try {
  $background = $src.GetPixel(0, 0)

  function Save-Resized([System.Drawing.Image]$img, [int]$w, [int]$h, [string]$dest) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.DrawImage($img, 0, 0, $w, $h)
      } finally {
        $g.Dispose()
      }
      $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bmp.Dispose()
    }
  }

  Save-Resized $src 192 192 (Join-Path $publicDir 'icon-192.png')
  Save-Resized $src 512 512 (Join-Path $publicDir 'icon-512.png')
  Save-Resized $src 180 180 (Join-Path $publicDir 'apple-touch-icon.png')
  Save-Resized $src 48 48 $faviconPath

  # Maskable icon: 512x512 canvas, artwork scaled to 80% and centered so the
  # important content stays inside the safe zone.
  $size = 512
  $inner = [int]([double]$size * 0.8)
  $offset = [int](($size - $inner) / 2)
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  try {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.Clear($background)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.DrawImage($src, $offset, $offset, $inner, $inner)
    } finally {
      $g.Dispose()
    }
    $bmp.Save((Join-Path $publicDir 'icon-maskable-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $bmp.Dispose()
  }
} finally {
  $src.Dispose()
}

Write-Output 'PWA icons generated.'
Get-ChildItem $publicDir -Filter *.png | Select-Object Name, Length
Write-Output "favicon: $faviconPath"
