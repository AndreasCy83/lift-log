# Native Billing Integration Steps

- Plugin: @capacitor-community/in-app-purchases
- Product IDs: espresso_tip, protein_shake_tip
- AndroidManifest.xml: set android:launchMode="singleTop" on MainActivity
- Must call consumePurchase() after every successful donation

# Android Auto Backup must stay ON (data-preservation requirement)

FitLogX stores everything locally in WebView localStorage. Android Auto Backup is
intentionally ENABLED so users can restore their profile, workout history,
calendar, body measurements and settings after a reinstall or when moving to a new
Android device. Seeing old data after uninstall/reinstall is Android restoring the
user's own backup - expected behaviour, not a bug.

Required `<application>` attributes in
`android/app/src/main/AndroidManifest.xml` (Capacitor's `cap sync` never rewrites
this file, so the edit persists):

    android:allowBackup="true"
    android:fullBackupContent="@xml/backup_rules"
    android:dataExtractionRules="@xml/data_extraction_rules"

Do NOT set `android:allowBackup="false"` and do NOT exclude user data domains.
The rule files exclude caches only:
- android/app/src/main/res/xml/backup_rules.xml            (API 23-30)
- android/app/src/main/res/xml/data_extraction_rules.xml   (API 31+)

Verify the MERGED manifest still has allowBackup="true":
  cd android && ./gradlew :app:processReleaseManifest
  # then inspect android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml

To test a genuinely empty first launch, do not rely on uninstall/reinstall
(Android may restore). Instead wipe the backup set or use a fresh package name:
  adb shell bmgr wipe com.google.android.gms/.backup.BackupTransportService <appId>
  adb uninstall <appId> && adb install app-release.apk

Clean build sequence (avoids stale web assets in the APK):
  git pull
  npm install --legacy-peer-deps
  rmdir /s /q dist            (PowerShell: Remove-Item -Recurse -Force dist)
  rmdir /s /q android\app\src\main\assets\public
  npm run build
  npx cap sync android
  cd android && gradlew clean assembleRelease

