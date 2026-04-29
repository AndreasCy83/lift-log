# Native Billing Integration Steps

- Plugin: @capacitor-community/in-app-purchases
- Product IDs: espresso_tip, protein_shake_tip
- AndroidManifest.xml: set android:launchMode="singleTop" on MainActivity
- Must call consumePurchase() after every successful donation
