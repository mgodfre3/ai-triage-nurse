#!/usr/bin/env python3
"""
setup.py — One-command configuration for AI Triage Nurse.

Reads values from .env and stamps them into every file that contains
placeholders (K8s manifests, Dockerfile, CI workflow, Flux configs).

Usage:
    1. cp .env.example .env
    2. Edit .env with your values
    3. python setup.py
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent

# ---------------------------------------------------------------------------
# Parse .env
# ---------------------------------------------------------------------------

def load_env(path: Path) -> dict[str, str]:
    """Parse a simple KEY=VALUE .env file (ignores comments and blanks)."""
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


# ---------------------------------------------------------------------------
# Replacement map
# ---------------------------------------------------------------------------

def build_replacements(env: dict[str, str]) -> list[tuple[str, str]]:
    """Return (old, new) pairs to apply across the project."""
    org = env.get("GITHUB_ORG", "YOUR_ORG")
    rg = env.get("AZURE_RESOURCE_GROUP", "YOUR_RESOURCE_GROUP")
    chat_model = env.get("FOUNDRY_MODEL_CHAT", "phi-4-mini")
    audio_model = env.get("FOUNDRY_MODEL_AUDIO", "whisper-tiny")
    namespace = env.get("K8S_NAMESPACE", "ai-triage-nurse")
    branch = env.get("FLUX_BRANCH", "main")

    return [
        ("YOUR_ORG", org),
        ("YOUR_RESOURCE_GROUP", rg),
    ]


# ---------------------------------------------------------------------------
# File stamping
# ---------------------------------------------------------------------------

TARGET_GLOBS = [
    "Dockerfile",
    "k8s/*.yaml",
    "k8s/flux/*.yaml",
    ".github/workflows/*.yaml",
]


def stamp_files(replacements: list[tuple[str, str]]) -> int:
    """Apply replacements to all target files. Returns count of files changed."""
    changed = 0
    for pattern in TARGET_GLOBS:
        for filepath in ROOT.glob(pattern):
            original = filepath.read_text(encoding="utf-8")
            updated = original
            for old, new in replacements:
                if old == new:
                    continue
                updated = updated.replace(old, new)
            if updated != original:
                filepath.write_text(updated, encoding="utf-8")
                print(f"  ✅ {filepath.relative_to(ROOT)}")
                changed += 1
    return changed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    env_path = ROOT / ".env"

    if not env_path.exists():
        print("❌ No .env file found.")
        print("   Run:  cp .env.example .env")
        print("   Then edit .env with your values and re-run this script.")
        sys.exit(1)

    env = load_env(env_path)

    # Validate required fields
    missing = []
    for key in ("GITHUB_ORG", "AZURE_RESOURCE_GROUP"):
        val = env.get(key, "")
        if not val or val.startswith("YOUR_"):
            missing.append(key)

    if missing:
        print("❌ The following required values are still placeholders in .env:")
        for k in missing:
            print(f"   • {k}")
        sys.exit(1)

    replacements = build_replacements(env)

    print(f"\n🔧 Stamping config from .env into project files...\n")
    print(f"   GITHUB_ORG            = {env['GITHUB_ORG']}")
    print(f"   AZURE_RESOURCE_GROUP  = {env['AZURE_RESOURCE_GROUP']}")
    print()

    count = stamp_files(replacements)

    if count == 0:
        print("  ℹ️  No files needed updating (already configured).")
    else:
        print(f"\n✅ Updated {count} file(s). Ready to deploy!")
        print("\nNext steps:")
        print("  • git add -A && git commit -m 'chore: configure for deployment'")
        print("  • git push origin main")
        print("  • kubectl apply -k k8s/")


if __name__ == "__main__":
    main()
