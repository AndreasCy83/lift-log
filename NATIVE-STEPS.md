# Native Billing Integration Steps

- Plugin: @capacitor-community/in-app-purchases
- Product IDs: espresso_tip, protein_shake_tip
- AndroidManifest.xml: set android:launchMode="singleTop" on MainActivity
- Must call consumePurchase() after every successful donation

# Android Auto Backup must stay OFF (data-persistence fix)

FitLogX stores everything locally in WebView localStorage. Android Auto Backup
would upload that and silently restore it after uninstall/reinstall, so a "clean
install" showed old workout history and profile data.

Required one-time edit in `android/app/src/main/AndroidManifest.xml`, on the
`<application>` tag (Capacitor's `cap sync` never rewrites this file, so the edit
persists):

    android:allowBackup="false"
    android:fullBackupContent="@xml/backup_rules"
    android:dataExtractionRules="@xml/data_extraction_rules"

The referenced rule files are committed at:
- android/app/src/main/res/xml/backup_rules.xml            (API 23-30)
- android/app/src/main/res/xml/data_extraction_rules.xml   (API 31+)

Verify the MERGED manifest (a plugin could re-add allowBackup):
  cd android && ./gradlew :app:processReleaseManifest
  # then inspect android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml
If a dependency re-adds it, keep `tools:replace="android:allowBackup"` and
`xmlns:tools="http://schemas.android.com/tools"` on the manifest root.

Clean build sequence (avoids stale web assets in the APK):
  git pull
  npm install --legacy-peer-deps
  rmdir /s /q dist            (PowerShell: Remove-Item -Recurse -Force dist)
  rmdir /s /q android\app\src\main\assets\public
  npm run build
  npx cap sync android
  cd android && gradlew clean assembleRelease
