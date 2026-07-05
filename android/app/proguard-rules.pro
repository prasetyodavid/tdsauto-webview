-dontwarn android.window.BackEvent
-dontwarn android.window.OnBackInvokedCallback
-dontwarn android.window.OnBackInvokedDispatcher

# Also add this to prevent flutter_inappwebview from breaking during minification
-keep class colts.org.apache.** { *; }
-dontwarn colts.org.apache.**
