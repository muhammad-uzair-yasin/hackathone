"""Remove checkerboard / light neutral background from news-globe asset."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "ChatGPT Image May 18, 2026, 09_12_35 AM.png"
OUT = ROOT / "assets" / "news-globe.png"


def dilate(mask: np.ndarray, iterations: int = 6) -> np.ndarray:
    m = mask.copy()
    for _ in range(iterations):
        n = m.copy()
        n[1:, :] |= m[:-1, :]
        n[:-1, :] |= m[1:, :]
        n[:, 1:] |= m[:, :-1]
        n[:, :-1] |= m[:, 1:]
        m = n
    return m


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    spread = maxc.astype(np.int16) - minc.astype(np.int16)
    avg = (r.astype(np.float32) + g + b) / 3.0
    sat = spread / np.maximum(maxc, 1)

    neutral = (spread <= 22) & (avg >= 195) & (a > 0)
    subject = ((sat > 0.10) | (avg < 85)) & (a > 0)
    keep = dilate(subject, iterations=7)
    remove = neutral & ~keep

    px = img.load()
    bg = tuple(int(arr[0, 0, i]) for i in range(3))
    tol = 16

    def close_bg(c: tuple[int, int, int]) -> bool:
        return all(abs(int(c[i]) - bg[i]) <= tol for i in range(3))

    visited: set[tuple[int, int]] = set()
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if (x, y) in visited:
            continue
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        if not close_bg(px[x, y][:3]):
            continue
        visited.add((x, y))
        arr[y, x, 3] = 0
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    arr[remove, 3] = 0
    Image.fromarray(arr, "RGBA").save(OUT)
    opaque = int(np.sum(arr[:, :, 3] > 20))
    print(f"saved {OUT} opaque_pixels={opaque} flood={len(visited)} removed2={int(remove.sum())}")


if __name__ == "__main__":
    main()
