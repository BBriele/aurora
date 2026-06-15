"""Lightweight asset checks for CI: JSON validity + translation parity.

Run as a plain script (no Home Assistant required):
    python tests/validate_assets.py
"""

import glob
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INTEGRATION = ROOT / "custom_components" / "aurora"


def main() -> int:
    """Validate all JSON assets parse and strings.json == translations/en.json."""
    failures: list[str] = []

    json_files = glob.glob(str(INTEGRATION / "**" / "*.json"), recursive=True)
    json_files.append(str(ROOT / "hacs.json"))
    for path in sorted(json_files):
        try:
            with open(path, encoding="utf-8") as handle:
                json.load(handle)
        except (OSError, json.JSONDecodeError) as err:
            failures.append(f"invalid JSON: {path}: {err}")

    strings = INTEGRATION / "strings.json"
    en = INTEGRATION / "translations" / "en.json"
    if json.loads(strings.read_text("utf-8")) != json.loads(en.read_text("utf-8")):
        failures.append("strings.json must be identical to translations/en.json")

    if failures:
        for line in failures:
            print(f"FAIL: {line}")
        return 1
    print(f"OK: {len(json_files)} JSON files valid; translations match")
    return 0


if __name__ == "__main__":
    sys.exit(main())
