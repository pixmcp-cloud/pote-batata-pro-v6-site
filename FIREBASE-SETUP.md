# Potê Batata Pro — Firebase
Google Cloud project (created): `pote-batata-livresom-261115`.
Firebase resources: **not enabled yet** due to API 403 PERMISSION_DENIED (possible unaccepted Firebase Terms of Service).

## Owner action
Open https://console.firebase.google.com/?hl=pt-br with `pixmcp@gmail.com`.
Choose **Add Firebase to an existing Google Cloud project**, select `Pote Batata Pro` (`pote-batata-livresom-261115`), accept the Firebase Terms (if prompted), and do not enable paid billing.
Report completion; CLI can then run `firebase projects:addfirebase pote-batata-livresom-261115`.

## Prepared local configuration (not deployed)
- `.firebaserc` specifies the intended project.
- `firebase.json` prepares Google Sign-In and Firestore rules; support email is contato@livresom.com.
- `firestore.rules` isolates user data by Firebase UID, allows the Google-verified administrator `pixmcp@gmail.com`, and denies other paths.

Next, after Firebase is activated:
1. Verify project is on the free Spark plan.
2. Deploy the Google Auth provider and Firestore rules.
3. Provision the Firestore default database with production-deny rules.
4. Register a Firebase Web App and obtain the client-side Firebase config.
5. Integrate Google login and protected role checks into the GitHub Pages app.
6. Test account isolation and admin/regular-user sign-in before replacing the public V6 demo.
7. Enforce FREE/PRO quotas server-side before enabling paid plans.

Note: local preparation does not mean Firebase Authentication or the database is active.
