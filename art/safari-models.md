# Safari dinosaur visual targets

The September 2026 rebuild targets the Jurassic Park / The Lost World designs for the seven baked ground species. The meshes are original, procedurally authored interpretations in `scripts/build-safari.mjs`, not scans or production meshes. Reference photographs are used for visual comparison only and are not distributed with the game.

| Species | Structural changes |
| --- | --- |
| Velociraptor, including the ghost variant | Deeper, squared muzzle and mandible, orbital ridge, fuller S-shaped neck, narrower abdomen, defined shoulder/thigh masses, long three-fingered hands with hooked claws, two supporting toes and a separate raised sickle toe. |
| Dilophosaurus | Shorter broad face, paired swept crests, scalloped and pleated display frill, longer grasping hands, olive mottling and subdued ochre/red-brown membrane. The fan is authored in a spread display pose. |
| Parasaurolophus | Taller, heavier neck, swept arched tubular crest, larger head, ochre saddle, dark longitudinal ribbons and stippling. |
| Pachycephalosaurus | More upright, reinforced neck, larger skull with a lower oval dome and a bony shelf, muted blue-grey hide and pale dome. |
| Triceratops | Broader face and dished frill, shorter wedge-shaped hooked beak, curved brow horns, recessed nostrils, brown hide and weathered keratin. Limb lofts taper into the torso instead of ending in exposed flat caps. |
| Stegosaurus | Taller, broader alternating plates, four longer tail spikes, a larger/deeper small head, green-brown hide and muted plates. Limb attachment caps are buried in the torso. |
| Gallimimus | Taller S-shaped neck, small long-beaked head, longer separated fingers, slim legs and warmer ochre countershading. Its shared chase herd uses the same sculpt. |

The Rex, compies, lizards, brachiosaur and flying animals retain their existing geometry and materials. The ghost raptor intentionally shares the new raptor anatomy and retains its existing rare coloration. Spawn rates, scoring, health, speeds and instance sizes are unchanged.

## Surface and rendering

- Eyes and elliptical lids are unioned **after** the skull's subtractive cuts. Previously the socket cutter removed the exposed eyeball surface along with the skull.
- The bake includes eye centres, radii, outward axes, iris colors and pupil types. The runtime draws iris fibres and pupil edges per fragment rather than relying only on tiny vertex-color regions. This works on both geometry tiers without textures or added draw calls.
- High uses smaller, shallower scales with per-cell pigment variation and fine neck compression lines. Broad joint folds live in the sculpt; Low keeps geometry, baked pigmentation, eye detail and gloss while skipping the scale-cell evaluations.
- Hit spheres were adjusted for relocated heads, the Dilophosaurus fan and enlarged Stegosaurus plates. Resting hulls are rebuilt from the final geometry. Existing body suspension, independent cadence, foot compensation, arm motion and kill transforms remain in use.

## Visual references

- [ECC Jurassic Park raptor maquette](https://www.cinemaquette.com/elite/jurassic-park-1-4-scale-raptor-maquette): side profile, skull/neck relationship, hands and raised sickle toe. The manufacturer describes this as a reproduction of the original maquette.
- [Stan Winston School: Triceratops animatronic](https://www.stanwinstonschool.com/blog/jurassic-park-triceratops-animatronic-dinosaur) and [ECC sick Triceratops close-up](https://www.darksidetoy.com/fr/shop-by-theme/jurassic-park/sick-triceratops-jurassic-park-1-8-maquette-by-ecc-detail.html?print=1&tmpl=component): broad facial anatomy, beak, horns and hide.
- [Prime 1 licensed Dilophosaurus](https://www.hlj.com/1-6-scale-legacy-museum-collection-jurassic-park-dilophosaurus-lmcjp-06-prs94492): the film's paired crests and pleated display fan.
- [ECC Parasaurolophus maquette](https://www.jedishop.eu/jurassic-world-maquette-1-8-parasaurolophus-52-cm/): swept crest, neck, ochre saddle and dorsal ribbons.
- [Chronicle Pachycephalosaurus maquette](https://www.bigbadtoystore.com/Product/VariationDetails/70767): film-maquette provenance and overall target.
- [Lost World Stegosaurus maquette exhibit](https://hollywoodmoviecostumesandprops.blogspot.com/2009/07/lost-world-jurassic-park-dinosaur.html): plate and body silhouette.
- [Spielberg-approved Gallimimus production artwork](https://www.juliensauctions.com/en/items/231225/jurassic-park-steven-spielberg-approved-mark-crash-mccreery-gallimimus-production-artwork-copy): slender neck and runner proportions.

## Authoring and review

Run `npm run art:safari` to rebuild both tiers in `public/models/safari-runners.bin`. Format 2 is retained; the eye descriptions are additional JSON metadata, and the vertex/index layout is unchanged. Missing eye metadata falls back to baked colors.

Neutral studio views, comparable original captures, both tiers, game/phone views and local diagnostics for this pass are in ignored `art/review/film-safari/`. Its `studio.html` uses the real game materials and gait and is served by the local authoring server. Geometry density and shader detail alone are not proof of film-level fidelity: further refinements should continue to use side, front and close-up comparisons.
