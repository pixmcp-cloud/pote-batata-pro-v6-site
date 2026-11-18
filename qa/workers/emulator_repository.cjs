/* Emulator-only adapter for the Cloudflare Worker repository contract.
 * It exercises the real Firestore SDK's optimistic serializable transaction.
 * The Worker production REST serialization has distinct mocked REST tests.
 * This file must never be bundled into the Worker or used in production. */
const assert=require("node:assert/strict");
function createEmulatorRepository(db,sdk){
 const pathRef=path=>sdk.doc(db,...path.split("/"));
 const canonical=value=>JSON.stringify(value??null);
 const conflict=message=>Object.assign(Error(message),{status:409});
 return {
  async transaction(){
   const baseline=new Map();
   let finished=false;
   return {
    async get(path){
     if(finished)throw Error("Already closed");
     if(baseline.has(path))return baseline.get(path);
     const snap=await sdk.getDoc(pathRef(path));
     const doc=snap.exists()?{data:snap.data(),updateTime:canonical(snap.data())}:null;
     baseline.set(path,doc);
     return doc;
    },
    async commit(writes){
     if(finished)throw Error("Already closed");
     if(!Array.isArray(writes)||writes.length===0)throw Error("No writes");
     const allPaths=[...new Set([...baseline.keys(),...writes.map(w=>w.path)])];
     let done;
     try{done=await sdk.runTransaction(db,async tx=>{
      const snapshots=new Map();
      // Every read is evaluated before the first write, matching real Firestore.
      const docs=await Promise.all(allPaths.map(p=>tx.get(pathRef(p))));
      for(let i=0;i<allPaths.length;i++)snapshots.set(allPaths[i],docs[i]);
      for(const [p,before] of baseline){
       const current=snapshots.get(p);
       if((current.exists()?canonical(current.data()):null)!==(before?.updateTime??null))
        throw conflict("Concurrent modification of "+p);
      }
      for(const write of writes){
       const current=snapshots.get(write.path);
       if(write.precondition.exists===false&&current.exists())
        throw conflict("Existing event ID");
       if(write.precondition.updateTime&&
         canonical(current.data())!==write.precondition.updateTime)
        throw conflict("Stale document version");
      }
      for(const write of writes)tx.set(pathRef(write.path),{
       ...write.data,updatedAt:sdk.serverTimestamp()
      });
      return {commitTime:"simulated"};
     });
     }catch(e){
      const code=String(e?.code||"");
      if(code.includes("aborted")||code.includes("failed-precondition")||
         e?.status===409||e?.status===412){
       const {FirestoreError}=await import("../../workers/antifraud/src/firestore.mjs");
       throw new FirestoreError(409,"TRANSACTION_CONFLICT");
      }
      throw e;
     }
     finished=true;return done;
    },
    async rollback(){finished=true}
   };
  }
 };
}
module.exports={createEmulatorRepository};
