#!/usr/bin/env python3
"""Publish only the tested IA wallet block into the active default Firestore rules.
Requires an authorized Google Cloud CLI session. No credentials persisted or printed.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import urllib.request

PROJECT = "potobatata-b71f3"
BASE = "https://firebaserules.googleapis.com/v1/"
RELEASE = f"projects/{PROJECT}/releases/cloud.firestore"
PINNED = "2b92b57211daa254bcf04a2fe0c4818b68a20457"
SOURCE = f"https://raw.githubusercontent.com/pixmcp-cloud/pote-batata-pro-v6-site/{PINNED}/firestore.rules"

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def compact(text):
    return re.sub(r"\s+", "", text)

def api(path, method="GET", data=None):
    token = subprocess.check_output(["gcloud", "auth", "print-access-token", "--quiet"], text=True).strip()
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                                 method=method)
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)

def main():
    with urllib.request.urlopen(SOURCE, timeout=30) as response:
        approved = response.read().decode()
    begin = approved.index("      match /aiWallet/{walletId}")
    end = approved.index("      // V1/V2", begin)
    wallet = approved[begin:end]
    current = api(RELEASE)
    ruleset = api(current["rulesetName"])
    files = ruleset["source"]["files"]
    require(len(files) == 1 and files[0]["name"] == "firestore.rules", "Unexpected rule source; abort")
    original = files[0]["content"]
    if compact(wallet) in compact(original):
        print("ALREADY_PUBLISHED", current["rulesetName"])
        return
    require("match /aiWallet/" not in original, "Different wallet rules exist; manual review required")
    for signature in [
        "function isAdmin() { return googleVerified() && request.auth.token.potebatataAdmin == true && request.auth.token.email == 'pixmcp@gmail.com'; }",
        "function canAccess(userId) { return isOwner(userId) || isAdmin(); }",
        "function googleVerified() { return request.auth != null && request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider == 'google.com'; }",
        "function isOwner(userId) { return googleVerified() && request.auth.uid == userId; }",
    ]:
        require(compact(signature) in compact(original), "Authorization helper differs; abort")
    anchors = list(re.finditer(r"(?m)^\s*match\s+/users/\{userId\}\s*\{[^\S\n]*\n", original))
    require(len(anchors) == 1, "Cannot locate unique user match; abort")
    offset = anchors[0].end()
    candidate = original[:offset] + wallet + original[offset:]
    require(candidate[:offset] + candidate[offset+len(wallet):] == original, "Non-wallet content changed")
    backup = pathlib.Path.home() / ("pdv-firestore-backup-" + current["rulesetName"].rsplit("/", 1)[-1] + ".rules")
    backup.write_text(original)
    source = {"files": [{"name": files[0]["name"], "content": candidate}]}
    result = api(f"projects/{PROJECT}:test", "POST", {"source": source})
    require(not any(x.get("severity") == "ERROR" for x in result.get("issues", [])), "Firebase compiler rejected candidate")
    print("VALIDATED", "old=" + current["rulesetName"], "sha256=" + hashlib.sha256(candidate.encode()).hexdigest())
    if "--publish" not in sys.argv:
        print("DRY_RUN_ONLY")
        return
    new = api(f"projects/{PROJECT}/rulesets", "POST", {"source": source})
    require(api(RELEASE)["rulesetName"] == current["rulesetName"], "Release changed concurrently; abort")
    updated = api(RELEASE, "PATCH", {"release": {"name": RELEASE, "rulesetName": new["name"]}, "updateMask": "rulesetName"})
    require(api(RELEASE)["rulesetName"] == new["name"], "Release verification failed")
    published = api(new["name"])["source"]["files"][0]["content"]
    require(published == candidate, "Published content mismatch")
    print("PUBLISHED_AND_VERIFIED", new["name"], "previous=" + current["rulesetName"])

if __name__ == "__main__":
    main()
