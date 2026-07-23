#!/usr/bin/env bash
set -e

echo "Running Flutter pub get..."
flutter pub get

echo "Running Flutter pub run flutter_launcher_icons:main..."
flutter pub run flutter_launcher_icons:main

echo "Running APK Build..."
flutter build apk --release --verbose

echo "APK build completed."
echo "Output directory: build/app/outputs/apk/release"
