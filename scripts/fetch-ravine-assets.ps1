# Authoring inputs only. Run from the repository root; never needed at runtime.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$review = Join-Path $root 'art\review\ravine'
$textures = Join-Path $root 'public\textures\ravine'
New-Item -ItemType Directory -Force -Path $review,$textures | Out-Null
$headers = @{'User-Agent'='RexPursuitAssetPreparation/1.0'}
Invoke-WebRequest -UseBasicParsing 'https://opengameart.org/sites/default/files/Dromaeosaur.blend' -OutFile (Join-Path $root 'art\Dromaeosaur.blend')
if ((Get-FileHash (Join-Path $root 'art\Dromaeosaur.blend')).Hash -ne 'C0E63B9E1A637D62A541566571262D0EA52375CA27E833EDB370C0B1C42307C3') { throw 'Raptor source changed: inspect its license and file before exporting.' }
$cliff = Invoke-RestMethod -Headers $headers 'https://api.polyhaven.com/files/coastal_cliff_01'
Invoke-WebRequest -UseBasicParsing -Headers $headers $cliff.blend.'2k'.blend.url -OutFile (Join-Path $root 'art\coastal-cliff.blend')
foreach ($map in @('Diffuse','nor_gl','Rough')) { Invoke-WebRequest -UseBasicParsing -Headers $headers $cliff.$map.'2k'.jpg.url -OutFile (Join-Path $review ('cliff-'+$map+'.jpg')) }
$gravel = Invoke-RestMethod -Headers $headers 'https://api.polyhaven.com/files/gravelly_sand'
foreach ($pair in @(@('Diffuse','diff'),@('nor_gl','nor_gl'),@('Rough','rough'))) { $key=$pair[0]; Invoke-WebRequest -UseBasicParsing -Headers $headers $gravel.$key.'2k'.jpg.url -OutFile (Join-Path $textures ('gravel-'+$pair[1]+'.jpg')) }
Write-Output 'CC0 authoring inputs downloaded. Run Blender with --disable-autoexec and the two art/prepare_*.py scripts.'
