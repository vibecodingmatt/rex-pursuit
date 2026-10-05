# Homepage hub previews

The hub (`index.html`, `src/chase/hub.js`, `src/chase/modes.js`) previews Pursuit, Safari Run and Containment live in its own 3D scene. Raptor Ravine and Lost Circuit '94 run on their own pages, so the hub plays recorded loops of them instead. Each loop lives in `public/previews/` in two orientations, `<mode>-wide.mp4` (1280x720) and `<mode>-tall.mp4` (720x1280), with a poster (`<mode>-wide.jpg`, `<mode>-tall.jpg`). Every mode, including the live ones, also has a rail thumbnail (`<mode>-thumb.jpg`, 320x180).

Re-record a loop when its title scene or the featured moments change noticeably.

1. Serve the checkout (`npm start`, port 5188) or pass `TEST_URL`.
2. Record frames. `vclock.js` replaces the page clock and `requestAnimationFrame`, so every frame advances exactly 1/30 s however slowly headless Chrome renders it. Headless real-time playback runs at about 1 fps and is useless for video.
   - `node scripts/previews/record-arcade.cjs art/review/previews/arcade-wide 1280 720`, then again with `arcade-tall 720 1280`. `arcade-plan.json` lists the segments: the 3D title, then boss moments reached with the test API's `seek` while a simple gunner aims at the nearest animal. Bosses arrive about 2 s after a stage's ride time ends.
   - `node scripts/previews/record-ravine.cjs art/review/previews/ravine-wide 1280 720`. For the tall version, record the menu segment at 720x1280, but record the gameplay segments at 1080x1280 and centre-crop them to 720 wide. In portrait the ravine switches to a 100° lens and the raptors become specks.
3. Encode both orientations: `FFMPEG=<path to ffmpeg> bash scripts/previews/encode.sh arcade`. It uses H.264 at CRF 35 with light denoise. Rain and water compress badly; this setting keeps a loop under about 2 MB and still looks clean under the menu's scrim.
4. Posters and thumbnails are single frames, exported with ffmpeg (`-q:v 4`; thumbnails cropped to the subject, then scaled to 320x180). For the live modes, take stills of the hub with the menu hidden (`#start-screen,.masthead{visibility:hidden}`).

Frames go to the ignored `art/review/`; only the encoded files in `public/previews/` are committed.
