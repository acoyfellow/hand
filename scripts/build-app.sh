#!/bin/sh
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/dist"
app="$out/hand.app"
version=$(cd "$root" && bun -e 'console.log(require("./package.json").version)')
identity="${HAND_SIGN_IDENTITY:--}"
rm -rf "$app" "$out/hand.dmg" "$out/dmg"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/bin" "$out/dmg"

xcrun swiftc -O -parse-as-library "$root/native/app/HandApp.swift" "$root/native/app/SignIn.swift" -o "$app/Contents/MacOS/hand-setup"
xcrun swiftc -O "$root/native/ax.swift" -o "$app/Contents/Resources/bin/ax"
xcrun swiftc -O "$root/native/cursor.swift" -o "$app/Contents/Resources/bin/hand-cursor"
cp -R "$root/native/cursors" "$app/Contents/Resources/bin/cursors"
(cd "$root" && bun build --compile src/cli.ts --outfile "$app/Contents/Resources/bin/hand" > /dev/null)
codesign --remove-signature "$app/Contents/Resources/bin/hand" 2> /dev/null || true

iconset="$out/hand.iconset"
rm -rf "$iconset" && mkdir -p "$iconset"
for size in 16 32 128 256 512; do
  sips -z $size $size "$root/site/public/brand/icon-512.png" --out "$iconset/icon_${size}x${size}.png" > /dev/null
  double=$((size * 2))
  [ $double -le 512 ] && sips -z $double $double "$root/site/public/brand/icon-512.png" --out "$iconset/icon_${size}x${size}@2x.png" > /dev/null
done
cp "$root/site/public/brand/icon-512.png" "$iconset/icon_512x512@2x.png"
iconutil -c icns "$iconset" -o "$app/Contents/Resources/hand.icns"
rm -rf "$iconset"

cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>hand</string>
  <key>CFBundleDisplayName</key><string>hand</string>
  <key>CFBundleIdentifier</key><string>dev.coey.hand</string>
  <key>CFBundleExecutable</key><string>hand-setup</string>
  <key>CFBundleIconFile</key><string>hand</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppleEventsUsageDescription</key><string>hand presses keys and menu items in the apps your agent asks it to use.</string>
</dict>
</plist>
PLIST

for binary in "$app/Contents/Resources/bin/ax" "$app/Contents/Resources/bin/hand-cursor" "$app/Contents/Resources/bin/hand"; do
  codesign --force --options runtime --timestamp=none -s "$identity" -i dev.coey.hand "$binary"
done
codesign --force --options runtime --timestamp=none -s "$identity" "$app"
codesign --verify --deep --strict "$app"

cp -R "$app" "$out/dmg/"
ln -s /Applications "$out/dmg/Applications"
hdiutil create -quiet -volname "hand" -srcfolder "$out/dmg" -ov -format UDZO "$out/hand.dmg"
rm -rf "$out/dmg"
echo "built $out/hand.dmg ($(du -h "$out/hand.dmg" | cut -f1)), signed with ${identity}"
