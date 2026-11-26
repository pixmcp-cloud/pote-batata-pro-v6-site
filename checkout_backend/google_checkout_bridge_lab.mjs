// G2: injected existing Firebase modular SDK; no initialization or external network here.
import {createCheckoutClient} from "./checkout_client_lab.mjs";
export function createGoogleCheckoutBridge({auth,sdk,send,subscribePrivate}={}){
 if(!auth||typeof sdk?.GoogleAuthProvider!=="function"||typeof sdk.signInWithPopup!=="function"||typeof sdk.onAuthStateChanged!=="function"||typeof sdk.signOut!=="function")throw Error("invalid_google_sdk");
 const client=createCheckoutClient({auth,signIn:()=>sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider()),send,subscribePrivate,onAuthChanged:cb=>sdk.onAuthStateChanged(auth,cb)});
 return {client,signOut:()=>sdk.signOut(auth)};
}
