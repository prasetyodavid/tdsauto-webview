@echo off
echo Building APK...
flutter build apk --release --obfuscate --split-debug-info=build/debug-info
if %errorlevel% neq 0 goto :error

echo.
echo Building AAB...
flutter build appbundle --release --obfuscate --split-debug-info=build/debug-info
if %errorlevel% neq 0 goto :error

echo.
echo Renaming outputs...
copy /Y "build\app\outputs\flutter-apk\app-release.apk" "build\app\outputs\flutter-apk\Prediksiwla.apk" >nul
copy /Y "build\app\outputs\bundle\release\app-release.aab" "build\app\outputs\bundle\release\Prediksiwla.aab" >nul

echo.
echo Build completed successfully!
echo   APK: build\app\outputs\flutter-apk\Prediksiwla.apk
echo   AAB: build\app\outputs\bundle\release\Prediksiwla.aab
goto :eof

:error
echo.
echo Build failed with error code %errorlevel%
exit /b %errorlevel%
