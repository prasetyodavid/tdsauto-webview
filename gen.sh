#!/usr/bin/env bash
set -e

echo "Running Flutter clean..."
flutter clean

echo "Running Flutter pub get..."
flutter pub get

echo "Running Flutter pub run flutter_launcher_icons:main..."
flutter pub run flutter_launcher_icons:main

echo "Running APK Build..."
flutter build apk --release --verbose

echo "APK build completed."

if [ -f "build/app/outputs/apk/release/app-release.apk" ]; then
  mv -f "build/app/outputs/apk/release/app-release.apk" "build/app/outputs/apk/release/SmartAsatidz.apk"
fi

if [ -f "build/app/outputs/flutter-apk/app-release.apk" ]; then
  mv -f "build/app/outputs/flutter-apk/app-release.apk" "build/app/outputs/flutter-apk/SmartAsatidz.apk"
fi

echo "Output directory: build/app/outputs/apk/release and build/app/outputs/flutter-apk"
