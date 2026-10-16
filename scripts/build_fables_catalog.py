#!/usr/bin/env python3
"""Build the local SmolGPT Fables story index from downloaded Parquet shards.

Usage:
    uv run --with pyarrow scripts/build_fables_catalog.py \
      --input-dir /tmp/codex-fables-parquet

The generated catalog contains metadata only. Story Markdown remains in the
published dataset and is fetched by split and row offset when a story opens.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import pyarrow.parquet as parquet


DATASET = "neonforestmist/smolgpt-markdown-stories"
REVISION = "7d30e5a274e529967733b4f39565ab24d3171375"
SPLITS = ("train", "validation", "test")
FIELDS = ("splitIndex", "rowOffset", "story_id", "title", "scene_count", "words")
COLUMNS = ("story_id", "title", "genre", "scene_count", "words", "split")
SHARD_PATTERN = re.compile(r"^(train|validation|test)-(\d+)-of-(\d+)\.parquet$")


def shard_files(directory: Path) -> dict[str, list[Path]]:
    """Return a validated sequence of numbered shards for every split."""
    grouped: dict[str, list[tuple[int, int, Path]]] = defaultdict(list)
    for path in directory.glob("*.parquet"):
        match = SHARD_PATTERN.fullmatch(path.name)
        if match is None:
            raise ValueError(f"Unexpected Parquet filename: {path.name}")
        split, number, count = match.groups()
        grouped[split].append((int(number), int(count), path))

    result: dict[str, list[Path]] = {}
    for split in SPLITS:
        shards = sorted(grouped.get(split, []))
        if not shards:
            raise ValueError(f"No {split} Parquet shards in {directory}")
        totals = {count for _, count, _ in shards}
        if len(totals) != 1:
            raise ValueError(f"Conflicting {split} shard counts: {totals}")
        expected = next(iter(totals))
        numbers = [number for number, _, _ in shards]
        if numbers != list(range(expected)):
            raise ValueError(f"Incomplete {split} shards: have {numbers}, expected 0..{expected - 1}")
        result[split] = [path for _, _, path in shards]
    return result


def genre_label(genre: str) -> str:
    words = genre.replace("_", " ").replace("-", " ").split()
    return " ".join(word.capitalize() if index == 0 or word not in {"and", "of", "the"} else word
                    for index, word in enumerate(words))


def genre_filename(genre: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", genre.lower()).strip("-")
    if not slug:
        raise ValueError(f"Cannot form a filename for genre {genre!r}")
    return f"{slug}.json"


def build_catalog(input_dir: Path, output_dir: Path) -> dict:
    if not input_dir.is_dir():
        raise FileNotFoundError(f"Parquet directory does not exist: {input_dir}")

    shards = shard_files(input_dir)
    entries: dict[str, list[list[str | int]]] = defaultdict(list)
    split_counts: dict[str, int] = {}
    story_ids: set[str] = set()

    for split_index, split in enumerate(SPLITS):
        row_offset = 0
        for path in shards[split]:
            reader = parquet.ParquetFile(path)
            if not set(COLUMNS).issubset(reader.schema_arrow.names):
                raise ValueError(f"Missing metadata columns in {path}")
            for batch in reader.iter_batches(batch_size=4096, columns=COLUMNS):
                columns = batch.to_pydict()
                for index in range(batch.num_rows):
                    if columns["split"][index] != split:
                        raise ValueError(f"Split mismatch in {path} at row {row_offset}")
                    story_id = columns["story_id"][index]
                    genre = columns["genre"][index]
                    title = columns["title"][index]
                    scene_count = columns["scene_count"][index]
                    words = columns["words"][index]
                    if not (isinstance(story_id, str) and story_id and
                            isinstance(genre, str) and genre and
                            isinstance(title, str) and title and
                            isinstance(scene_count, int) and scene_count > 0 and
                            isinstance(words, int) and words > 0):
                        raise ValueError(f"Invalid metadata in {path} at row {row_offset}")
                    if story_id in story_ids:
                        raise ValueError(f"Duplicate story_id: {story_id}")
                    story_ids.add(story_id)
                    entries[genre].append([
                        split_index, row_offset, story_id, title, scene_count, words
                    ])
                    row_offset += 1
        split_counts[split] = row_offset

    total = sum(split_counts.values())
    if total != 96_000 or len(entries) != 25:
        raise ValueError(f"Incomplete archive: {total} stories across {len(entries)} genres; expected 96000/25")

    output_dir.mkdir(parents=True, exist_ok=True)
    genres = []
    used_filenames: set[str] = set()
    for genre in sorted(entries):
        filename = genre_filename(genre)
        if filename in used_filenames:
            raise ValueError(f"Genre filename collision: {filename}")
        used_filenames.add(filename)
        with (output_dir / filename).open("w", encoding="utf-8") as target:
            json.dump(entries[genre], target, ensure_ascii=False, separators=(",", ":"))
            target.write("\n")
        genres.append({
            "id": genre,
            "label": genre_label(genre),
            "count": len(entries[genre]),
            "file": filename,
        })

    manifest = {
        "schemaVersion": 1,
        "dataset": DATASET,
        "revision": REVISION,
        "splits": list(SPLITS),
        "fields": list(FIELDS),
        "total": total,
        "splitCounts": split_counts,
        "genres": genres,
    }
    with (output_dir / "manifest.json").open("w", encoding="utf-8") as target:
        json.dump(manifest, target, ensure_ascii=False, indent=2)
        target.write("\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=Path("/tmp/codex-fables-parquet"))
    parser.add_argument(
        "--output-dir", type=Path,
        default=Path(__file__).resolve().parent.parent / "assets/ai/fables/catalog",
    )
    args = parser.parse_args()
    manifest = build_catalog(args.input_dir, args.output_dir)
    print(f"Wrote {manifest['total']:,} stories across {len(manifest['genres'])} genres to {args.output_dir}")
    print("Split counts:", manifest["splitCounts"])


if __name__ == "__main__":
    main()
