#!/bin/bash

# Uncomment the following lines if you want to clean the project
# echo "Cleaning Flutter project..."
# flutter clean

echo "Running Flutter pub get..."
flutter pub get

echo "Running Flutter pub run flutter_launcher_icons:main..."
flutter pub run flutter_launcher_icons:main

echo "Running APK Build..."
flutter build apk --release --verbose

echo "Opening APK folder..."
xdg-open build/app/outputs/apk/release

echo "Running in Emulator..."
flutter run

echo "All commands executed successfully."
