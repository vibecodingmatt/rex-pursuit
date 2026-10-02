# Authoring inputs only. Run from the repository root; never needed at runtime.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$review = Join-Path $root 'art\review\ravine'
$textures = Join-Path $root 'public\textures\ravine'
New-Item -ItemType Directory -Force -Path $review,$textures | Out-Null
$headers = @{'User-Agent'='RexPursuitAssetPreparation/1.0'}
Invoke-WebRequest -UseBasicParsing 'https://opengameart.org/sites/default/files/Dromaeosaur.blend' -OutFile (Join-Path $root 'art\Dromaeosaur.blend')
if ((Get-FileHash (Join-Path $root 'art\Dromaeosaur.blend')).Hash -ne 'C0E63B9E1A637D62A541566571262D0EA52375CA27E833EDB370C0B1C42307C3') { throw 'Raptor source changed: inspect its license and file before exporting.' }
$gravel = Invoke-RestMethod -Headers $headers 'https://api.polyhaven.com/files/gravelly_sand'
foreach ($pair in @(@('Diffuse','diff'),@('nor_gl','nor_gl'),@('Rough','rough'))) { $key=$pair[0]; Invoke-WebRequest -UseBasicParsing -Headers $headers $gravel.$key.'2k'.jpg.url -OutFile (Join-Path $textures ('gravel-'+$pair[1]+'.jpg')) }
$outcrop = Invoke-RestMethod -Headers $headers 'https://api.polyhaven.com/files/namaqualand_cliff_02'
Invoke-WebRequest -Headers $headers $outcrop.blend.'2k'.blend.url -OutFile (Join-Path $root 'art\namaqualand-cliff.blend')
if ((Get-FileHash (Join-Path $root 'art\namaqualand-cliff.blend')).Hash -ne 'A3CE3A54970B1992EE3FE126CD58012E2A80104691C46932254E473CF6C8D517') { throw 'Outcrop source changed: inspect before exporting.' }
foreach ($pair in @(@('Diffuse','4k'),@('nor_gl','2k'),@('Rough','2k'))) { Invoke-WebRequest -Headers $headers $outcrop.($pair[0]).($pair[1]).jpg.url -OutFile (Join-Path $review ('nama-'+$pair[0]+'.jpg')) }
$sandstone = Invoke-RestMethod -Headers $headers 'https://api.polyhaven.com/files/sandstone_cracks'
foreach ($pair in @(@('Diffuse','diff'),@('nor_gl','nor_gl'),@('Rough','rough'))) { Invoke-WebRequest -Headers $headers $sandstone.($pair[0]).'2k'.jpg.url -OutFile (Join-Path $textures ('sandstone-'+$pair[1]+'.jpg')) }
Write-Output 'CC0 authoring inputs downloaded. Run Blender with --disable-autoexec and art/prepare_raptor.py / art/prepare_ravine_outcrop.py.'
