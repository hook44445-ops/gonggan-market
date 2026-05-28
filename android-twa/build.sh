#!/usr/bin/env bash
# 공간마켓 TWA (Trusted Web Activity) Build Script
# Prerequisites: Android SDK (sdkmanager, adb), Java 21+, Node.js 18+
#
# STEP 0: Set your actual Vercel deployment URL
VERCEL_URL="gonggan-market.vercel.app"   # ← change if your domain is different
PACKAGE_ID="com.gongganmarket.app"
KEYSTORE="gonggan-release.keystore"
KEY_ALIAS="gonggan-market"
KEY_PASS="GongganMarket2026!"
STORE_PASS="GongganMarket2026!"

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "▶ Installing Bubblewrap CLI..."
npm install -g @bubblewrap/cli

echo "▶ Initialising Bubblewrap with manifest from $VERCEL_URL..."
bubblewrap init --manifest "https://$VERCEL_URL/manifest.json"

# Patch twa-manifest.json with signing config
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('twa-manifest.json','utf8'));
m.signing = { keystore: '$KEYSTORE', keyAlias: '$KEY_ALIAS', keyFullName: m.signing?.keyFullName ?? '' };
m.packageId = '$PACKAGE_ID';
m.host = '$VERCEL_URL';
fs.writeFileSync('twa-manifest.json', JSON.stringify(m, null, 2));
console.log('twa-manifest.json patched');
"

echo "▶ Building release APK..."
bubblewrap build --skipPwaValidation

echo ""
echo "✅ Build complete. APK is in ./app/build/outputs/apk/release/"
echo ""
echo "NEXT STEPS FOR GOOGLE PLAY:"
echo "  1. Open Google Play Console → Create app → Internal testing"
echo "  2. Upload the .aab file from ./app/build/outputs/bundle/release/"
echo "  3. Add testers → download from the internal track to verify TWA works"
echo "  4. Promote to Production when ready"
