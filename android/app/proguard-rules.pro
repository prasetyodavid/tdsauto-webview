# Flutter
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# Google Play Core (referenced by Flutter)
-dontwarn com.google.android.play.core.**

# Flutter InAppWebView
-keep class com.pichillilorenzo.flutter_inappwebview.** { *; }
-keep class androidx.webkit.** { *; }
-dontwarn com.pichillilorenzo.flutter_inappwebview.**
-dontwarn androidx.webkit.**
-dontwarn android.window.BackEvent

# Flutter Downloader
-keep class vn.hunghd.flutterdownloader.** { *; }
-dontwarn vn.hunghd.flutterdownloader.**

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Flutter Local Notifications
-keep class com.dexterous.** { *; }
-dontwarn com.dexterous.**

# Permission Handler
-keep class com.baseflow.permissionhandler.** { *; }
-dontwarn com.baseflow.permissionhandler.**

# URL Launcher
-keep class io.flutter.plugins.urllauncher.** { *; }
-dontwarn io.flutter.plugins.urllauncher.**

# Path Provider
-keep class io.flutter.plugins.pathprovider.** { *; }
-dontwarn io.flutter.plugins.pathprovider.**
