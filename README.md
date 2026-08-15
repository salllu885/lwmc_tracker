# Field Issue Tracker — Android build

This is the Vite + React + Capacitor project scaffolded from the approved prototype
(`field-issue-tracker.jsx`), following the packaging steps in
`field-issue-tracker-build-brief.md`. It swaps the browser file input and
`navigator.geolocation` for the native `@capacitor/camera` and
`@capacitor/geolocation` plugins, and swaps the prototype's demo `window.storage`
for real `localStorage` persistence so data survives app restarts.

## Get the APK without installing anything locally

This repo includes `.github/workflows/build-apk.yml`, a GitHub Actions workflow
that installs Node.js and the Android SDK in the cloud, builds the app, and
produces a downloadable debug APK. No local Node.js, Android Studio, or SDK
required — just a free GitHub account.

1. Create a free account at https://github.com/signup (if you don't have one).
2. Create a new empty repository (e.g. `field-issue-tracker`) at
   https://github.com/new — don't initialize it with a README.
3. From this folder, push the code:
   ```
   git remote add origin https://github.com/<your-username>/field-issue-tracker.git
   git branch -M main
   git push -u origin main
   ```
4. On GitHub, open the repo's **Actions** tab. The `Build Android APK` workflow
   runs automatically on push (or click **Run workflow** to trigger it manually).
5. When it finishes (a few minutes), open the completed run and download the
   `field-issue-tracker-debug-apk` artifact from the **Artifacts** section at
   the bottom of the page. Unzip it to get `app-debug.apk`.
6. Transfer the APK to an Android phone, enable "Install from unknown sources",
   and tap to install.

## Building locally instead (needs Android Studio)

If you later have a machine with Android Studio installed:
```
npm install
npm run build
npx cap sync android
npx cap open android
```
Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

For wider distribution, sign the APK with a release key via Android Studio's
**Build → Generate Signed Bundle/APK**.
