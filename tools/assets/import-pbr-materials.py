#!/usr/bin/env python3
"""Import the bounded CC0 surface/sky set used by the browser world.

  python tools/assets/import-pbr-materials.py --download --cache /tmp/myrp-pbr-source
  python tools/assets/import-pbr-materials.py --verify-only

Pinned sources, same-origin outputs, no vendor API or runtime CDN. Pillow
12.3.0 and NumPy 2.3.5 produced the original checked-in WebP encodings.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile
import numpy as np
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[2]
LOCK = Path(__file__).with_name("pbr-sources.json")
DEST = ROOT / "web/assets/world/materials"
SIZE = 512
MAX_DOWNLOAD_BYTES = 24_000_000
MATERIALS = {
    "asphalt": {"title": "Asphalt Floor", "author": "eye-candy.xyz",
        "page": "https://polyhaven.com/a/asphalt_floor", "provider": "Poly Haven",
        "licensePage": "https://polyhaven.com/license", "recommendedRepeatMetres": 2.3},
    "plaster": {"title": "Painted Plaster Wall", "author": "Amal Kumar",
        "page": "https://polyhaven.com/a/painted_plaster_wall", "provider": "Poly Haven",
        "licensePage": "https://polyhaven.com/license", "recommendedRepeatMetres": 2},
    "wood": {"title": "Laminate Floor 03",
        "author": "Charlotte Baglioni (photography), Dario Barresi (processing)",
        "page": "https://polyhaven.com/a/laminate_floor_03", "provider": "Poly Haven",
        "licensePage": "https://polyhaven.com/license", "recommendedRepeatMetres": 2.1},
    "grass": {"title": "Grass 005", "author": "ambientCG / Lennart Demes",
        "page": "https://ambientcg.com/view?id=Grass005", "provider": "ambientCG",
        "licensePage": "https://docs.ambientcg.com/license/", "recommendedRepeatMetres": 4},
    "sky": {"title": "Kloofendal 48d Partly Cloudy (Pure Sky)",
        "author": "Greg Zaal (original), Jarod Guest (sky edits)",
        "page": "https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky", "provider": "Poly Haven",
        "licensePage": "https://polyhaven.com/license", "projection": "equirectangular",
        "usage": "background only; already tonemapped, not HDR lighting"},
}

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def download(source: dict, cache: Path) -> bytes:
    path = cache / source["file"]
    if not path.exists():
        request = urllib.request.Request(source["url"], headers={"User-Agent": "MYRPAssetImporter/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read(MAX_DOWNLOAD_BYTES + 1)
        if len(data) > MAX_DOWNLOAD_BYTES:
            raise ValueError(f"Source exceeds import limit: {source['file']}")
        if digest(data) != source["sha256"] or len(data) != source["bytes"]:
            raise ValueError(f"Downloaded source differs from lock: {source['file']}")
        path.write_bytes(data)
    data = path.read_bytes()
    if digest(data) != source["sha256"] or len(data) != source["bytes"]:
        raise ValueError(f"Cached source differs from lock: {source['file']}")
    return data

def encode(data: bytes, kind: str, size: tuple[int, int]) -> bytes:
    with Image.open(io.BytesIO(data)) as source:
        image = source.convert("L" if kind == "roughness" else "RGB")
        image = image.resize(size, Image.Resampling.LANCZOS)
    if kind == "normal":
        # Averaging tangent-space normals changes their lengths; normalize them
        # after resizing instead of treating the normal map as a photograph.
        vectors = np.asarray(image, dtype=np.float32) / 127.5 - 1
        lengths = np.maximum(np.linalg.norm(vectors, axis=2, keepdims=True), 1e-8)
        pixels = np.clip((vectors / lengths + 1) * 127.5, 0, 255)
        image = Image.fromarray(np.rint(pixels).astype(np.uint8))
    output = io.BytesIO()
    image.save(output, "WEBP", quality=82 if kind == "color" else 100,
        lossless=kind != "color", method=6, exact=True)
    return output.getvalue()

def verify() -> None:
    manifest = json.loads((DEST / "manifest.json").read_text())
    count = 0
    for material in manifest["materials"]:
        for asset in material["maps"].values():
            path = ROOT / "web" / asset["url"].removeprefix("/")
            data = path.read_bytes()
            if digest(data) != asset["sha256"] or len(data) != asset["bytes"]:
                raise ValueError(f"Local output differs from manifest: {path}")
            with Image.open(io.BytesIO(data)) as image:
                if image.format != "WEBP" or image.size != (asset["width"], asset["height"]):
                    raise ValueError(f"Invalid map encoding: {path}")
            count += 1
    print(json.dumps({"verifiedMaps": count, "bytes": manifest["totalBytes"]}))

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/myrp-pbr-source"))
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    if args.verify_only:
        verify()
        return
    sources = json.loads(LOCK.read_text())
    args.cache.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    records = {name: dict(id=name, **value, maps={}) for name, value in MATERIALS.items()}
    for source in sources:
        if not args.download and not (args.cache / source["file"]).exists():
            raise ValueError("Missing cached source; use --download to opt in to network")
        raw = download(source, args.cache)
        maps = {source["kind"]: (raw, None)}
        if source["kind"] == "archive":
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                maps = {kind: (archive.read(member), member) for kind, member in {
                    "color": "Grass005_1K-JPG_Color.jpg",
                    "normal": "Grass005_1K-JPG_NormalGL.jpg",
                    "roughness": "Grass005_1K-JPG_Roughness.jpg",
                }.items()}
        for kind, (image_data, member) in maps.items():
            size = (1024, 512) if source["alias"] == "sky" else (SIZE, SIZE)
            output = encode(image_data, kind, size)
            filename = f"{source['alias']}-{kind}.webp"
            (DEST / filename).write_bytes(output)
            provenance = dict(source)
            if member:
                provenance.update(member=member, memberSha256=digest(image_data))
            records[source["alias"]]["maps"][kind] = {
                "url": f"/assets/world/materials/{filename}",
                "bytes": len(output), "sha256": digest(output),
                "width": size[0], "height": size[1],
                "colorSpace": "srgb" if kind == "color" else "linear-data",
                "source": provenance,
            }
    manifest = {
        "schemaVersion": 1, "importedAt": "2026-10-17",
        "license": "CC0-1.0", "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "encoding": {"tool": "Pillow", "version": pillow_version, "size": SIZE,
            "skySize": [1024, 512], "colorQuality": 82, "dataMapsLossless": True, "normalConvention": "OpenGL"},
        "sourceLock": "tools/assets/pbr-sources.json", "materials": list(records.values()),
        "totalBytes": sum(asset["bytes"] for record in records.values() for asset in record["maps"].values()),
        "runtimeRequests": "same-origin only; no vendor APIs or CDN requests",
    }
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    verify()

if __name__ == "__main__":
    main()
