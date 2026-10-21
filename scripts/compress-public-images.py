#!/usr/bin/env python3
"""Recompress public raster images in place.

Photos stay on the same URL when they are already JPEG. Large PNG photos in
assets/forfaits are rewritten as JPEG and references are updated, because a
PNG photo of several megabytes does not shrink usefully.

Logos under assets/suppliers are quantized, not flattened, so transparency
stays. Pillow is optional for the GHL sync: if it is missing, this exits 0
and leaves the file untouched.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO_DIRS = [ROOT / 'assets' / 'forfaits']
LOGO_DIRS = [ROOT / 'assets' / 'suppliers']
PHOTO_MAX = 1600
PHOTO_QUALITY = 74
MIN_BYTES = 180_000
SKIP_DIRS = {'.git', '.agents', 'node_modules'}

try:
    from PIL import Image
except ImportError:
    print('pillow is not installed; image compression skipped', file=sys.stderr)
    sys.exit(0)


def save_jpeg(image: Image.Image, dest: Path) -> None:
    rgb = image.convert('RGB')
    rgb.thumbnail((PHOTO_MAX, PHOTO_MAX), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(dest, 'JPEG', quality=PHOTO_QUALITY, optimize=True, progressive=True)


def recompress_jpeg(path: Path) -> bool:
    original = path.stat().st_size
    if original < MIN_BYTES:
        with Image.open(path) as image:
            if max(image.size) <= PHOTO_MAX:
                return False
    with Image.open(path) as image:
        rgb = image.convert('RGB')
        rgb.thumbnail((PHOTO_MAX, PHOTO_MAX), Image.Resampling.LANCZOS)
        tmp = path.with_suffix(path.suffix + '.tmp')
        rgb.save(tmp, 'JPEG', quality=PHOTO_QUALITY, optimize=True, progressive=True)
    new_size = tmp.stat().st_size
    # Never replace a file with a heavier one, even when the pixel size dropped.
    if new_size >= original:
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(path)
    print(f'jpeg {original // 1024}KB -> {new_size // 1024}KB {path.relative_to(ROOT)}')
    return True


def quantize_logo(path: Path) -> bool:
    original = path.stat().st_size
    if original < MIN_BYTES:
        return False
    with Image.open(path) as image:
        if image.mode not in ('RGBA', 'LA', 'P'):
            converted = image.convert('RGBA')
        else:
            converted = image
        if max(converted.size) > 800:
            converted.thumbnail((800, 800), Image.Resampling.LANCZOS)
        quantized = converted.convert('RGBA').quantize(colors=128, method=Image.Quantize.FASTOCTREE)
        tmp = path.with_suffix(path.suffix + '.tmp')
        quantized.save(tmp, 'PNG', optimize=True)
    new_size = tmp.stat().st_size
    if new_size >= original:
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(path)
    print(f'logo {original // 1024}KB -> {new_size // 1024}KB {path.relative_to(ROOT)}')
    return True


def convert_png_photo(path: Path) -> Path | None:
    dest = path.with_suffix('.jpg')
    if dest.exists() and dest.resolve() != path.resolve():
        # Keep an existing different photo. Do not overwrite it.
        print(f'skip png->jpg, destination exists: {dest.relative_to(ROOT)}')
        return None
    original = path.stat().st_size
    with Image.open(path) as image:
        save_jpeg(image, dest)
    new_size = dest.stat().st_size
    if new_size >= original:
        if dest.resolve() != path.resolve():
            dest.unlink(missing_ok=True)
        return None
    print(f'png {original // 1024}KB -> jpg {new_size // 1024}KB {path.relative_to(ROOT)}')
    return dest


def rewrite_references(replacements: list[tuple[str, str]]) -> None:
    if not replacements:
        return
    suffixes = {'.html', '.js', '.mjs', '.json', '.xml', '.css', '.md', '.txt'}
    for path in ROOT.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in suffixes:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        updated = text
        for old, new in replacements:
            updated = updated.replace(old, new)
        if updated != text:
            path.write_text(updated, encoding='utf-8')
            print(f'references {path.relative_to(ROOT)}')


def compress_tree() -> None:
    replacements: list[tuple[str, str]] = []
    for folder in PHOTO_DIRS:
        if not folder.exists():
            continue
        for path in sorted(folder.iterdir()):
            if not path.is_file():
                continue
            suffix = path.suffix.lower()
            if suffix in {'.jpg', '.jpeg'}:
                recompress_jpeg(path)
            elif suffix == '.png' and path.stat().st_size >= MIN_BYTES:
                dest = convert_png_photo(path)
                if dest is None:
                    continue
                old = path.relative_to(ROOT).as_posix()
                new = dest.relative_to(ROOT).as_posix()
                replacements.append((old, new))
                path.unlink()
    for folder in LOGO_DIRS:
        if not folder.exists():
            continue
        for path in sorted(folder.iterdir()):
            if path.is_file() and path.suffix.lower() == '.png':
                quantize_logo(path)
    rewrite_references(replacements)


def compress_one(path: Path) -> None:
    """Normalize one mirrored upload. Prints the repo-relative path to keep."""
    if not path.exists():
        return
    suffix = path.suffix.lower()
    rel = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else path.name
    if suffix not in {'.jpg', '.jpeg', '.png', '.webp'}:
        print(rel)
        return
    original = path.stat().st_size
    dest = path if suffix in {'.jpg', '.jpeg'} else path.with_suffix('.jpg')
    tmp = dest.with_name(dest.name + '.tmp')
    with Image.open(path) as image:
        rgb = image.convert('RGB')
        rgb.thumbnail((PHOTO_MAX, PHOTO_MAX), Image.Resampling.LANCZOS)
        rgb.save(tmp, 'JPEG', quality=PHOTO_QUALITY, optimize=True, progressive=True)
    if suffix in {'.jpg', '.jpeg'} and tmp.stat().st_size >= original:
        tmp.unlink(missing_ok=True)
        print(rel)
        return
    tmp.replace(dest)
    if dest.resolve() != path.resolve():
        path.unlink(missing_ok=True)
    kept = dest.relative_to(ROOT).as_posix() if dest.is_relative_to(ROOT) else dest.name
    print(kept)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', help='Compress a single mirrored image and exit')
    args = parser.parse_args()
    if args.file:
        compress_one(Path(args.file))
        return
    compress_tree()


if __name__ == '__main__':
    main()
