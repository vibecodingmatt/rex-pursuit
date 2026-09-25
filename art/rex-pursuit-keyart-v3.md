# Rex: Pursuit key art v3

Generated on 2026-09-25 using the built-in OpenAI ImageGen tool.

Final asset: `rex-pursuit-keyart-v3.png` (1734 x 907, approximately 1.91:1).

This is promotional artwork, not an in-game capture. It preserves the v2 composition while adapting the vehicle and occupants from the game references. A second pass removed badge lettering and the bumper logo sticker, retaining the vehicle number "18" and a plain dinosaur silhouette badge.

The final PNG is an unmodified copy of:
`C:\Users\burns\.codex\generated_images\01a0d893-95e5-70a2-b02c-6a4cfa14f59b\exec-09b5b4c9-62d8-4c8a-967b-542d93542006.png`

`npm run social:render` packages it as `public/social/rex-pursuit-v4.jpg`.

## Reference inputs

1. `art/rex-pursuit-keyart-v2.png` — composition and scene.
2. `art/review/jeepref-front34.png` — vehicle design.
3. `art/review/jeepref-side.png` — vehicle design.
4. `art/review/jeepref-rear34.png` — vehicle design and rear gunner.

The starting prompt is in [rex-pursuit-keyart-v3-prompt.md](rex-pursuit-keyart-v3-prompt.md). The submitted prompts below clarify the input roles, place the badge on the side body panel, and make "18" an explicit exception to the no-text instruction.

## Initial generation prompt

Use case: precise-object-edit.
Asset type: Rex: Pursuit cinematic promotional key art.
Input images: Image 1 is the artwork to edit and composition to preserve. Images 2, 3 and 4 are front-three-quarter, side, and rear-three-quarter references for the replacement Jeep and its occupants; use their vehicle design, not their rendering style.

Recreate the first image as a new piece of cinematic promotional artwork for a video game, keeping its composition, camera angle, golden-hour light, jungle, waterfall, flying mud and the huge roaring brown T. rex bearing down from behind on the right. The only change is the vehicle: replace the green military Jeep with the exact vehicle shown in the other reference images, rendered with the same photoreal detail as the rest of the scene.

The vehicle is a compact, boxy, open-top safari tour 4x4 charging toward the camera through the muddy jungle track:
- No roof and no doors on the cab: a black tubular roll cage arches over the seats.
- An upright windshield in a thick, glossy bright-red frame, with red-backed side mirrors on short arms.
- Sand-khaki body panels mottled with darker olive-brown camouflage blotches and caked with mud.
- A bold red diagonal stripe sweeps across each front fender and each rear quarter panel, and a large red "18" is painted on the front fender just behind the headlight.
- The side body panel carries a round red badge with a black T. rex silhouette, with no lettering.
- A square, black-framed front end with a slatted grille, rectangular headlamps with round spotlights below, a chunky winch on a heavy black bumper, and a small yellow "18" plate.
- Big knobby black off-road tyres on red-painted hubs, and a spare tyre on the tailgate.
- A tall whip antenna.

A heavy belt-fed machine gun is mounted on a post at the back of the cab, facing backward toward the T. rex, with a green ammo can and a brass cartridge belt. A gunner stands behind it firing at the dinosaur, with a bright muzzle flash. The gunner wears a blue work shirt, a red neckerchief and a straw safari hat. The driver hunches at the wheel in khaki with a safari hat, eyes wide.

Wide 1.91:1 cinematic frame. The T. rex's head and open jaws and the whole vehicle sit in the upper and central part of the image, with jungle foliage framing the left edge. No text, titles, logos or watermarks anywhere in the image, except the explicitly requested painted vehicle number "18" and plain unlettered dinosaur silhouette badge. Do not reproduce any franchise lettering from the reference renders. Preserve the Rex's appearance, open-jawed pose, dramatic scale and the scene from image 1.

## Final correction prompt

Input: the first generated image, `exec-94b2cdf6-3086-4534-a745-a234b047c9ee.png`, in the same generated-images folder.

Use case: precise-object-edit.
Edit this generated Rex: Pursuit promotional artwork with one narrowly targeted correction to the vehicle markings.
Keep the entire image, composition, proportions, Rex, light, jungle, waterfall, flying mud, vehicle, both people, gun and muzzle flash unchanged.
Remove ALL logo lettering and decorative text from the Jeep's badges. On the visible side panel replace the existing dinosaur emblem with a simple round red disc containing a plain black T. rex silhouette, with NO words, no rectangular wordmark bar, no tiny letters and no extra outline label. On the front bumper remove the white logo sticker completely so the bumper is plain black there; retain the small yellow plate with black "18" to its right.
Retain the red "18" painted on the front fender, red diagonal stripes, red windshield and mirror backs, khaki camouflage, red hubs, and every other feature.
Only visible text in the finished image: the requested vehicle number "18". No franchise names, no logos other than the plain unlettered round dinosaur badge, no titles, no watermark.
Keep exact wide 1.91:1 framing and high photoreal detail.

