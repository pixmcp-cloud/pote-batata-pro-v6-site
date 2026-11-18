#!/usr/bin/env python3
"""Build Firebase Hosting using the exact tested GitHub Pages asset recipe.

No Floot edits, no secret files, no paid services.
"""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
WORKFLOW = ROOT / ".github" / "workflows" / "deploy.yml"
text = WORKFLOW.read_text(encoding="utf-8")
start = text.index("      - name: Preparar demonstracao e beta Firebase")
end = text.index("          node --check public/premium_motion.js", start)
recipe = text[start:end].splitlines()
public = ROOT / "public"
tracked = subprocess.run(
    ["git", "ls-files", "--", "public"], cwd=ROOT,
    text=True, capture_output=True, check=True
).stdout.strip()
if tracked:
    raise SystemExit("ABORT: public/ contains tracked source files; refusing cleanup")
if public.exists():
    shutil.rmtree(public)
count = 0
for line in recipe:
    command = line.strip()
    if command.startswith("mkdir -p "):
        (ROOT / command.removeprefix("mkdir -p ")).mkdir(parents=True, exist_ok=True)
    elif command.startswith("cp -R "):
        _, _, src, dst = command.split()
        shutil.copytree(ROOT / src, ROOT / dst, dirs_exist_ok=True)
        count += 1
    elif command.startswith("cp "):
        _, src, dst = command.split()
        target = ROOT / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / src, target)
        count += 1
    elif command.startswith("python3 -m pip install"):
        continue  # Developer workstation must have dependencies preinstalled.
    elif command.startswith("python3 "):
        args = command.split()
        subprocess.run([sys.executable, *args[1:]], cwd=ROOT, check=True)
    elif command in ("run: |",) or command.startswith("- name:"):
        continue
    elif command:
        raise SystemExit("ABORT: unfamiliar build command before test stage: " + command)
page = (public / "index.html").read_text(encoding="utf-8")
if "poteAuthGate" not in page or "firebase_integration.js" not in page:
    raise SystemExit("ABORT: generated site lacks authenticated login gate")
for required in ["free_id_policy.mjs", "v2_storage.mjs", "inventory_integrity.mjs", "v2_batch_planner.mjs", "franchise_financial_report.mjs", "legacy_migration_v2.mjs", "migration_preview.mjs", "operation_integrity.mjs", "worker_bridge.mjs", "firebase_integration.js", "garimpo_catalog.json"]:
    if not (public / required).is_file():
        raise SystemExit("ABORT: missing asset " + required)
print(f"FIREBASE_HOSTING_BUILD_OK copies={count} files={len(list(public.rglob('*')))}")
