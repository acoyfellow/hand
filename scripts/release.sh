#!/bin/sh
set -eu
version="${1:?usage: scripts/release.sh <version>}"
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/dist/release-$version"
rm -rf "$out"
mkdir -p "$out/hand-cursor.app/Contents/MacOS/cursors"
cd "$root"
swiftc -O native/ax.swift -o "$out/ax"
swiftc -O native/cursor.swift -o "$out/hand-cursor.app/Contents/MacOS/hand-cursor"
cp native/cursors/*.png native/cursors/cursors.json "$out/hand-cursor.app/Contents/MacOS/cursors/"
cat > "$out/hand-cursor.app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>hand-cursor</string>
  <key>CFBundleIdentifier</key><string>dev.coey.hand.cursor</string>
  <key>CFBundleName</key><string>hand cursor</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
(cd "$out" && tar -czf "hand-ax-$version-macos-arm64.tar.gz" ax && zip -qry "hand-cursor-$version-macos-arm64.zip" hand-cursor.app)
(cd "$out" && shasum -a 256 "hand-ax-$version-macos-arm64.tar.gz" "hand-cursor-$version-macos-arm64.zip" > SHA256SUMS)
echo "$out"
ls -la "$out" | tail -n +2
