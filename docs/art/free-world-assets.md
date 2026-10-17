# Free world surfaces and visual reference, 17 October 2026

The city has a bounded set of real surface materials for the accelerated
renderer. These project assets are served locally from the same origin;
players do not contact an asset vendor or subscribe to an asset API. Material
grain and lighting response add depth to authored geometry. They do not by
themselves create a photorealistic city, improve network latency, or establish
that the whole game meets its production acceptance criteria.

The thirteen shipped images total 2,086,410 bytes (about 1.99 MiB), including a
22,728-byte sky. Source downloads total 39,073,889 bytes and stay in a temporary
import cache, not in player downloads. The material color maps and pure-sky
panorama were visually inspected before the workspace recovery. Reproduction
uses the same source hashes and encoder versions; current verification is
recorded by the importer. These are asset checks, not a GPU/FPS measurement.

## Files and integration

`web/assets/world/materials/manifest.json` records source/output hashes,
bytes, authors, license pages, dimensions and suggested scale. The existing
Kenney model/sprite manifests and license files are not rewritten.

| Runtime stem | Source | Maps | Suggested repeat |
| --- | --- | --- | --- |
| `asphalt` | [Asphalt Floor](https://polyhaven.com/a/asphalt_floor), eye-candy.xyz | Color, OpenGL normal, roughness, each 512 × 512 | 2.3 m |
| `grass` | [Grass 005](https://ambientcg.com/view?id=Grass005), ambientCG / Lennart Demes | Color, OpenGL normal, roughness, each 512 × 512 | 4 m, artistic choice |
| `plaster` | [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall), Amal Kumar | Color, OpenGL normal, roughness, each 512 × 512 | 2 m |
| `wood` | [Laminate Floor 03](https://polyhaven.com/a/laminate_floor_03), Charlotte Baglioni and Dario Barresi | Color, OpenGL normal, roughness, each 512 × 512 | 2.1 m |
| `sky` | [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky), Greg Zaal and Jarod Guest | Tonemapped color, 1024 × 512 | Equirectangular background |

Surface paths are `/assets/world/materials/<stem>-color.webp`,
`<stem>-normal.webp` and `<stem>-roughness.webp`; the sky path is
`/assets/world/materials/sky-color.webp`. Only color maps use sRGB. Normal and
roughness maps are linear data. Surfaces repeat using RepeatWrapping and the
OpenGL normal convention; keep plaster normal intensity modest. The sky is
already tonemapped and is used only for the scene background, avoiding mobile
PMREM preprocessing for this asset.

Use separate texture transforms for different repeat scales, rather than
mutating a single shared texture per building. Lazy-load the active scene's
materials. Canvas fallback and failed texture requests must retain readable
existing colors and controls. Public routes enumerate exact filenames instead
of permitting arbitrary file access. Source JPG/ZIP files are unnecessary at
runtime.

## License and reproducibility

[Poly Haven's asset license](https://polyhaven.com/license) permits commercial
use and redistribution of its CC0 assets.
[ambientCG's license](https://docs.ambientcg.com/license/) explicitly permits
including raw CC0 files in a video game. Neither requires a watermark or a
login-page redirect. Voluntary attribution and license links are saved in
`web/assets/world/materials/LICENSE.txt`. No vendor branding, example renders
or competitor game files are redistributed.

```sh
python tools/assets/import-pbr-materials.py --download --cache /tmp/myrp-pbr-source
python tools/assets/import-pbr-materials.py --verify-only
```

The lock is `tools/assets/pbr-sources.json`. Every cached/downloaded file must
match its pinned SHA-256 and byte count. Only three explicitly named Grass 005
image members are read from the ZIP, with no archive path extraction. Pillow
downsamples and encodes WebP. Normal vectors are renormalized after reduction;
normal/roughness outputs are lossless, and color outputs use quality 82. Original
encodings used Pillow 12.3.0 and NumPy 2.3.5. Later encoders may change output
bytes; review generated manifests alongside any importer change.

## Reference observations

Three publisher screenshots in the [official OneState Google Play listing](https://play.google.com/store/apps/details?id=com.Chillgaming.oneState)
were inspected on 17 October. They show shoulder-height third-person cameras,
adult proportions, visible fabric detail, curbs, vehicles, trees, people and
long cast shadows. Reflected light defines car windows/bodywork rather than a
single flat paint color. A rooftop view keeps the large foreground character
within a continuous city. These are public publisher images, not a claim to
have played OneState or measured its performance. They remain reference
material outside the repository.

[The Sims 4 official features page](https://www.ea.com/games/the-sims/the-sims-4/features)
describes appearance customization, home layouts and furnishings, and visits
to neighborhoods and venues. Its house image caption describes looking into
each room and placing items. The relevant goal is spatial interaction: visible
furniture activities and usable venues, rather than a phone menu replacing
the world. This page does not establish detailed Sims animation timings or
routing algorithms; MY RP must implement and test its own behavior.

For MY RP this means a rotatable close camera, clear character scale, streets
and entrances, tactile surfaces, shadow depth and purposeful activity stages.
Driving, shopping and placing purchases must stay connected to the server's
money and ownership records. Scenery cannot replace those loops, and scanned
materials alone cannot make repeated low-detail silhouettes equivalent to a
bespoke commercial art library. The full Bible still governs release,
including real-device graphics/fallback, account reliability and performance.
