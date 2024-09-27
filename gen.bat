@echo off
echo Cleaning Flutter project...
cmd /c flutter clean

echo Running Flutter pub get...
cmd /c flutter pub get

echo Running Flutter pub run flutter_launcher_icons:main...
cmd /c flutter pub run flutter_launcher_icons:main

echo Running APK Build...
cmd /c flutter build apk --release

REM Open the folder containing the APK
start "" "build\app\outputs\apk\release"
echo Opening APK folder...

echo Running in Emulator...
cmd /c flutter run

echo All commands executed successfully.
pause
