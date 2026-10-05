# encode.sh <mode> : frames in art/review/hub/<mode>-{wide,tall}/ -> public/previews/<mode>-{wide,tall}.mp4
F=${FFMPEG:-ffmpeg};R=${FRAMES:-art/review/previews};m=$1
for o in wide tall; do $F -hide_banner -loglevel error -y -framerate 30 -i $R/$m-$o/%04d.jpg -vf "hqdn3d=1.5:1.5:4:4" -c:v libx264 -preset veryslow -crf 35 -pix_fmt yuv420p -profile:v high -movflags +faststart -an public/previews/$m-$o.mp4; done
ls -la public/previews/$m-* | awk '{print $5, $9}'
