# Visitor Center arrival art

Reconstructed for the Rex: Pursuit victory sequence, 2026-09-20. This is an original runtime fan reconstruction, not a film production model or a claim of surveyed dimensions.

## Visual research

- [Lauren Polizzi — Jurassic Park set design](https://laurenpolizzi.com/set-design/jurassic-park-1-9grsr): original exterior elevation, location plan, finished set photographs and entrance-door detail. These primary production references guided the concave frontage, tapered buttresses, tiered thatch, clerestory openings, recessed lintels and fossil portal.
- [1993 exterior film still](https://cdn.kinocheck.com/i/w%3D1280/lk6etbz1fd.jpg): cross-check of the Jeep, stairs, pools, foliage and façade in the completed shot.

Reference downloads stay in ignored `art/review/`; they are not shipped as game textures. The scene uses an approximately 59 m wide, 22 m tall reconstruction and the unchanged Jeep. The terrain, camera and approach are composed for gameplay. These dimensions are visual approximations, not transcriptions of production measurements.

## Runtime construction

`src/chase/visitor-center.js` constructs the façade, engaged columns, turquoise window muntins, terrace rails, three roof tiers, fossil entrance, sunburst doors, stairs and stepped water rills. Static architecture is batched by material. `visitor-materials.js` creates seeded stone, straw, gravel, grass, ringed bark and water-normal textures in code.

`visitor-plants.js` instances folded broad leaves, fern pinnae, grass blades and individual palm leaflets. The existing `jungle-branch.png` supplies small distant branch clusters with visible supporting limbs. `visitor-water.js` adds an irregular pond, scene reflections, animated ripples, earthen shore, small stones, notched veined lily pads and flowers. Reflection targets are reduced for coarse-pointer devices. None of the new shrub crowns are spheres.

## Generated fossil relief

Asset: `public/textures/visitor-fossil-relief-v1.png` (1024 × 1536). Created with the built-in OpenAI ImageGen tool using the original entrance photograph as a visual reference. The PNG is copied unchanged from the generated output; the game maps its top and side regions to three separate portal surfaces and uses the same texture for shallow bump relief. The output is newly generated artwork, not a copied film texture.

Generation source: `01a0c175-3dac-7c13-b0da-8d57c0ecb956/exec-de46e6df-c964-4aa1-86a0-f5e69b70eb52.png`.

Exact generation prompt:

> Use case: stylized-concept. Asset type: original photorealistic PBR base-color texture for the fossil-carved entrance portal of a 3D fan recreation of the 1993 Jurassic Park Visitor Center. Input image is visual reference ONLY for the carved pale sandstone relief, not an edit target. Generate a NEW texture, perfectly straight-on orthographic, no perspective, no cast shadows from external objects, no doors, no windows, no signage, no frame, no surroundings. Portrait 1024x1536. Composition: an inverted-U shaped fossil frieze on a uniform warm gray-beige limestone slab, the top horizontal frieze occupies exactly the upper 27% of the image, the left and right vertical friezes occupy the outermost 20% of image width and extend all the way to the bottom. The remaining central lower rectangle is plain uncarved limestone. Across the TOP frieze an intricately sculpted Tyrannosaurus skeleton in shallow stone bas-relief, skull on the right in side profile with open jaws and individual teeth, spine and ribs sweeping left. Along LEFT and RIGHT vertical friezes: separate detailed dinosaur bones, vertebrae, fossil skulls, curled ammonites and leaf impressions, arranged vertically. All objects are carved from the same light gray-beige sandstone as the wall. Fine stone grain, subtle chisel marks and recessed ambient occlusion, sophisticated real movie-set craftsmanship, restrained warm gray palette, neutral soft frontal light. Texture must fill the whole image edge to edge, no border. Avoid saturated orange, dark brown, cartoon bones, black background, text, watermark. This will be mapped onto actual three-dimensional portal panels with the center omitted.
