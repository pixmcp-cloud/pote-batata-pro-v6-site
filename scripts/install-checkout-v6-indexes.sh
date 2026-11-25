#!/usr/bin/env bash
# PDV MULTIVERSAL — only additive indexes. Run as authorized human administrator.
set -euo pipefail
project=potobatata-b71f3
database='(default)'
if [[ "${1:-}" != "--apply" && "${1:-}" != "--check" ]]; then
  echo 'Usage: bash install-checkout-v6-indexes.sh --check | --apply'
  exit 2
fi
export PDV_INDEX_MODE="$1"
python3 - <<'PY'
import json, os, subprocess, sys
PROJECT = "potobatata-b71f3"
DATABASE = "(default)"
EXPECTED = [
  {
    "collectionGroup": "recordsV5",
    "queryScope": "COLLECTION",
    "fields": [
      {
        "fieldPath": "record.universe",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.group",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.id",
        "order": "ASCENDING"
      }
    ]
  },
  {
    "collectionGroup": "recordsV5",
    "queryScope": "COLLECTION",
    "fields": [
      {
        "fieldPath": "record.universe",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.group",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.item.status",
        "order": "ASCENDING"
      }
    ]
  },
  {
    "collectionGroup": "recordsV5",
    "queryScope": "COLLECTION",
    "fields": [
      {
        "fieldPath": "record.universe",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.group",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.rank",
        "order": "ASCENDING"
      }
    ]
  },
  {
    "collectionGroup": "recordsV5",
    "queryScope": "COLLECTION",
    "fields": [
      {
        "fieldPath": "record.universe",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.group",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "record.item.orderNumber",
        "order": "DESCENDING"
      }
    ]
  },
  {
    "collectionGroup": "publicOrderViews",
    "queryScope": "COLLECTION",
    "fields": [
      {
        "fieldPath": "buyerUid",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "createdAt",
        "order": "DESCENDING"
      }
    ]
  }
]
BASE = ["gcloud", "firestore", "indexes", "composite"]
COMMON = ["--project="+PROJECT, "--database="+DATABASE]
def normalized(fields):
    return [(f["fieldPath"], f.get("order")) for f in fields if f["fieldPath"] != "__name__"]
def inventory():
    result = subprocess.run(BASE+["list"]+COMMON+["--format=json"],check=True,capture_output=True,text=True)
    data=json.loads(result.stdout)
    if not isinstance(data,list): raise RuntimeError("Inventário inesperado")
    return data
def matches(index, all_indexes):
    prefix=f"projects/{PROJECT}/databases/{DATABASE}/collectionGroups/{index['collectionGroup']}/indexes/"
    return [i for i in all_indexes if str(i.get("name","")).startswith(prefix) and i.get("queryScope")==index["queryScope"] and normalized(i.get("fields",[]))==normalized(index["fields"])]
current=inventory()
missing=[]
for index in EXPECTED:
    found=matches(index,current)
    state="READY" if any(i.get("state")=="READY" for i in found) else "CREATING" if any(i.get("state")=="CREATING" for i in found) else "NOT_READY" if found else "MISSING"
    print(index["collectionGroup"],", ".join(f["fieldPath"] for f in index["fields"]),state,flush=True)
    if not found: missing.append(index)
if os.environ["PDV_INDEX_MODE"]=="--check":
    sys.exit(0)
for index in missing:
    args=BASE+["create"]+COMMON+["--collection-group="+index["collectionGroup"],"--query-scope=collection","--async"]
    args+=["--field-config=field-path="+f["fieldPath"]+",order="+f["order"].lower() for f in index["fields"]]
    subprocess.run(args,check=True)
print("Solicitados somente os índices ausentes. Reexecute --check até todos estarem READY.")
PY
