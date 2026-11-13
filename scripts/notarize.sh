#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
profile="${HAND_NOTARY_PROFILE:-hand-notary}"
dmg="$root/dist/hand.dmg"
test -n "${HAND_SIGN_IDENTITY:-}" || { echo "set HAND_SIGN_IDENTITY to a Developer ID Application identity (security find-identity -v -p codesigning)"; exit 1; }
sh "$root/scripts/build-app.sh"
codesign --force --timestamp -s "$HAND_SIGN_IDENTITY" "$dmg"
xcrun notarytool submit "$dmg" --keychain-profile "$profile" --wait
xcrun stapler staple "$dmg"
spctl --assess --type open --context context:primary-signature -v "$dmg"
