// B02.11: generate a candidate ruleset only in a synthetic emulator. Never
// overwrite firestore.rules. The account profile is admin-controlled.
export function candidateCutoverRules(source){
 function once(from,to){if(source.split(from).length!==2)throw Error("Rules source changed: "+from);source=source.replace(from,to)}
 once("    // Licenças e franquias",`    function legacyAuthority(userId) {
      let p = /databases/$(database)/documents/users/$(userId);
      return !exists(p) || (
        get(p).data.get('accessPolicy', {}) is map
        && get(p).data.get('accessPolicy', {}).get('checkoutAuthority', 'legacy') == 'legacy'
        && getAfter(p).data.get('accessPolicy', {}).get('checkoutAuthority', 'legacy') == 'legacy'
      );
    }
    // Licenças e franquias`);
 once("allow create, update: if canAccess(userId) && (\n          (id == 'v5'","allow create, update: if canAccess(userId) && legacyAuthority(userId) && (\n          (id == 'v5'");
 once("allow create: if id == 'v5InventoryGuard' && canAccess(userId)","allow create: if id == 'v5InventoryGuard' && canAccess(userId) && legacyAuthority(userId)");
 once("allow update: if id == 'v5InventoryGuard' && canAccess(userId)","allow update: if id == 'v5InventoryGuard' && canAccess(userId) && legacyAuthority(userId)");
 once("allow create: if canAccess(userId) && validCreate(request.resource.data);","allow create: if canAccess(userId) && legacyAuthority(userId) && validCreate(request.resource.data);");
 once("allow update: if canAccess(userId) && validUpdate(request.resource.data, resource.data);","allow update: if canAccess(userId) && legacyAuthority(userId) && validUpdate(request.resource.data, resource.data);");
 once("allow delete: if canAccess(userId)\n          && canEditOperationalRecord", "allow delete: if canAccess(userId) && legacyAuthority(userId)\n          && canEditOperationalRecord");
 return source;
}
