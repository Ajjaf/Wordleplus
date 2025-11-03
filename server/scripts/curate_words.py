#!/usr/bin/env python3
"""
Utility for curating the 5-letter word list using frequency data.

Requires ``pip install wordfreq``.

Example:
    python server/scripts/curate_words.py --threshold 3.4
"""
from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List

from wordfreq import zipf_frequency


def load_words(path: Path) -> List[str]:
    return [w.strip().upper() for w in path.read_text().splitlines() if w.strip()]


def save_words(path: Path, words: Iterable[str]) -> None:
    path.write_text("\n".join(words) + "\n", encoding="utf-8")


def export_rejects(path: Path, rejects: Iterable["WordScore"]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["word", "zipf_frequency"])
        for item in rejects:
            writer.writerow([item.word, f"{item.freq:.3f}"])


@dataclass(frozen=True)
class WordScore:
    word: str
    freq: float


def score_words(words: Iterable[str]) -> List[WordScore]:
    scored: List[WordScore] = []
    for word in words:
        freq = zipf_frequency(word.lower(), "en")
        scored.append(WordScore(word=word, freq=freq))
    return scored


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=Path("server/allowed_guesses.txt"),
        type=Path,
        help="Path to the source words file (default: server/allowed_guesses.txt)",
    )
    parser.add_argument(
        "--output",
        default=None,
        type=Path,
        help="Where to write the curated list. Defaults to overwriting --source.",
    )
    parser.add_argument(
        "--rejects",
        default=Path("server/rejected_words.csv"),
        type=Path,
        help="CSV file describing which words were removed and why.",
    )
    parser.add_argument(
        "--guesses-output",
        default=Path("server/allowed_guesses.txt"),
        type=Path,
        help="Where to write the allowed-guess list (default: server/allowed_guesses.txt).",
    )
    parser.add_argument(
        "--threshold",
        default=3.4,
        type=float,
        help="Minimum Zipf frequency (base-10 log of occurrences per billion) required.",
    )
    parser.add_argument(
        "--guesses-threshold",
        default=None,
        type=float,
        help="Optional minimum Zipf frequency for allowed guesses (default: keep all source words).",
    )
    args = parser.parse_args()

    source_path = args.source
    if not source_path.exists():
        raise SystemExit(f"Source file not found: {source_path}")

    scored = score_words(load_words(source_path))

    threshold = args.threshold

    kept = [item for item in scored if item.freq >= threshold]
    dropped = [item for item in scored if item.freq < threshold]

    output_path = args.output or source_path
    # Keep deterministic ordering by sorting alphabetically.
    save_words(output_path, sorted(item.word for item in kept))

    guesses_threshold = (
        float("-inf") if args.guesses_threshold is None else args.guesses_threshold
    )
    if args.guesses_output:
        allowed = sorted(
            item.word for item in scored if item.freq >= guesses_threshold
        )
        save_words(args.guesses_output, allowed)

    if dropped:
        export_rejects(args.rejects, sorted(dropped, key=lambda x: x.freq))

    print(f"Words loaded: {len(scored)}")
    print(f"Kept: {len(kept)} (threshold >= {threshold:.2f})")
    print(f"Removed: {len(dropped)} (details: {args.rejects})")
    print(f"Wrote curated list to: {output_path}")


if __name__ == "__main__":
    main()
