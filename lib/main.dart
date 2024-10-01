import 'dart:async';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_downloader/flutter_downloader.dart';
import 'package:permission_handler/permission_handler.dart';

Future main() async {
  WidgetsFlutterBinding.ensureInitialized();
  //await Permission.storage.request();
  //await Permission.photos.request();
  //await Permission.notification.request();
  //await FlutterDownloader.initialize(debug: true, ignoreSsl: true);

  runApp(MaterialApp(home: new MyApp()));
}

// change com.package
// D:\Projects\FL\tdsauto-webview\android\app\build.gradle
// flutter pub run flutter_launcher_icons:main

var MAIN_HOME_URL = "https://goyalla.id?app=1";
var MAIN_TITLE = "Goyalla";

class SplashScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/icon/icon.png',
              width: 200, // Adjust the width as needed
              height: 200, // Adjust the height as needed
            ),
            SizedBox(height: 20),
            Text(MAIN_TITLE, style: TextStyle(fontSize: 20)),
          ],
        ),
      ),
    );
  }
}

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => new _MyAppState();
}

class _MyAppState extends State<MyApp> {
  Future<void> _loadWebView() async {
    await Future.delayed(Duration(seconds: 3)); // Simulate splash screen delay
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _loadWebView(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return SplashScreen();
        } else {
          return WebViewScreen();
        }
      },
    );
  }
}

class WebViewScreen extends StatefulWidget {
  @override
  _WebViewScreenState createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  final GlobalKey webViewKey = GlobalKey();
  Timer? _pageLoadTimer;

  InAppWebViewController? webViewController;

  bool showHomeButton = false; // To control the visibility of the FAB

  InAppWebViewGroupOptions options = InAppWebViewGroupOptions(
      crossPlatform: InAppWebViewOptions(
          cacheEnabled: true,
          useShouldOverrideUrlLoading: true,
          mediaPlaybackRequiresUserGesture: false,
          javaScriptEnabled: true,
          javaScriptCanOpenWindowsAutomatically: true,
          useOnDownloadStart: true),
      android: AndroidInAppWebViewOptions(
        cacheMode: AndroidCacheMode.LOAD_DEFAULT,
        allowFileAccess: true,
        useHybridComposition: true,
        builtInZoomControls: false,
        displayZoomControls: false,
        domStorageEnabled: true,
        databaseEnabled: true,
      ),
      ios: IOSInAppWebViewOptions(
        allowsInlineMediaPlayback: true,
      ));

  late PullToRefreshController pullToRefreshController;
  String url = MAIN_HOME_URL;
  double progress = 0;
  final urlController = TextEditingController();

  String cookiesString = '';

  @override
  void initState() {
    super.initState();

    pullToRefreshController = PullToRefreshController(
      options: PullToRefreshOptions(
        color: Colors.blue,
      ),
      onRefresh: () async {
        if (Platform.isAndroid) {
          webViewController?.reload();
        } else if (Platform.isIOS) {
          webViewController?.loadUrl(
              urlRequest: URLRequest(url: await webViewController?.getUrl()));
        }
      },
    );
  }

  @override
  void dispose() {
    IsolateNameServer.removePortNameMapping('downloader_send_port');
    _pageLoadTimer?.cancel();
    super.dispose();
  }

  Future<void> _startPageLoadTimeout() async {
    _pageLoadTimer?.cancel(); // Cancel any existing timer
<<<<<<< HEAD
    _pageLoadTimer = Timer(Duration(seconds: 30), () {
=======
    _pageLoadTimer = Timer(Duration(seconds: 15), () {
>>>>>>> b4d727ae937931437e2ac480e0a5ffecec3ac202
      if (mounted) {
        setState(() {
          progress = 1.0;
        });
        _showWebPageNotAvailablePopup("The application took too long to load.");
        pullToRefreshController.endRefreshing();
      }
    });
  }

  Future<void> updateCookies(Uri url) async {
    // Convert Uri to WebUri
    WebUri webUrl = WebUri(url.toString());

    List<Cookie> cookies =
        await CookieManager.instance().getCookies(url: webUrl);
    String cookiesString = '';
    for (Cookie cookie in cookies) {
      cookiesString += '${cookie.name}=${cookie.value};';
    }
    print(cookiesString);
  }

  Future<bool> _onWillPop() async {
    if (await webViewController?.canGoBack() ?? false) {
      webViewController?.goBack();
      return Future.value(false);
    } else {
      return await showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: Text('Konfirmasi'),
              content: Text('Anda ingin keluar dari aplikasi?'),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text('Tidak'),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: Text('Ya'),
                ),
              ],
            ),
          ) ??
          false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
        onWillPop: _onWillPop,
        child: Scaffold(
            body: SafeArea(
                child: Column(children: <Widget>[
          Expanded(
            child: Stack(
              children: [
                InAppWebView(
                  key: webViewKey,
                  initialUrlRequest: URLRequest(url: WebUri(MAIN_HOME_URL)),
                  initialOptions: options,
                  pullToRefreshController: pullToRefreshController,
                  onWebViewCreated: (controller) {
                    webViewController = controller;
                  },
                  onDownloadStartRequest: (controller, url) async {
                    var urls = url.url.toString();
                    String file_Name = urls.split('/').last;
                    print("onDownloadStart $urls");
                    print("onDownloadStart $file_Name");

                    await FlutterDownloader.enqueue(
                      url: urls,
                      savedDir: (await getApplicationDocumentsDirectory()).path,
                      fileName: file_Name,
                      showNotification: true,
                      openFileFromNotification: true,
                      saveInPublicStorage: true,
                    ).catchError((error) {
                      print("Download failed: $error");
                    });
                  },
                  onLoadStart: (controller, url) {
                    setState(() {
                      this.url = url.toString();
                      urlController.text = this.url;
                    });
                    _startPageLoadTimeout();
                  },
                  onPermissionRequest: (controller, request) async {
                    return PermissionResponse(
                        resources: request.resources,
                        action: PermissionResponseAction.GRANT);
                  },
                  onGeolocationPermissionsShowPrompt:
                      (InAppWebViewController controller, String origin) async {
                    return GeolocationPermissionShowPromptResponse(
                        origin: origin, allow: true, retain: true);
                  },
                  shouldOverrideUrlLoading:
                      (controller, navigationAction) async {
                    var uri = navigationAction.request.url!;

                    if (![
                      "http",
                      "https",
                      "file",
                      "chrome",
                      "data",
                      "javascript",
                      "about"
                    ].contains(uri.scheme)) {
                      if (await canLaunch(url)) {
                        // Launch the App
                        await launch(
                          url,
                        );
                        // and cancel the request
                        return NavigationActionPolicy.CANCEL;
                      }
                    }

                    return NavigationActionPolicy.ALLOW;
                  },
                  onLoadStop: (controller, url) async {
                    progress = 1.0;
                    pullToRefreshController.endRefreshing();
                    _pageLoadTimer
                        ?.cancel(); // Cancel the timer if load succeeds
                    if (url != null) {
                      await updateCookies(url);
                    }

                    if (url != null) {
                      String currentUrl = url.toString();
                      setState(() {
                        showHomeButton = !currentUrl.contains("goyalla.id");
                      });
                    }

                    setState(() {
                      this.url = url.toString();
                      urlController.text = this.url;
                    });
                  },
                  onReceivedError: (controller, request, error) {
                    progress = 1.0;
                    pullToRefreshController.endRefreshing();

                    _pageLoadTimer
                        ?.cancel(); // Cancel the timer if there's an error
<<<<<<< HEAD
=======

                    if (error.description != "net::ERR_FAILED") {
                      _showWebPageNotAvailablePopup(
                          "Something went wrong. Please try again later.");
                    }
>>>>>>> b4d727ae937931437e2ac480e0a5ffecec3ac202
                  },
                  onProgressChanged: (controller, progress) {
                    if (progress == 1.0) {
                      pullToRefreshController.endRefreshing();
                      _pageLoadTimer
                          ?.cancel(); // Cancel the timer when load completes
                    }
                    setState(() {
                      this.progress = progress / 100;
                      urlController.text = this.url;
                    });
                  },
                  onUpdateVisitedHistory: (controller, url, androidIsReload) {
                    if (url != null) {
                      String currentUrl = url.toString();
                      setState(() {
                        // Check if the URL is within the goyalla.id domain
                        showHomeButton = !currentUrl.contains("goyalla.id");
                      });
                    }

                    setState(() {
                      this.url = url.toString();
                      urlController.text = this.url;
                    });
                  },
                  onConsoleMessage: (controller, consoleMessage) {
                    print(consoleMessage);
                  },
                ),
                if (showHomeButton)
                  Positioned(
                    right: 5, // Positioned to the center right
                    top: MediaQuery.of(context).size.height / 2 -
                        30, // Adjust for centering vertically
                    child: Transform.scale(
                      scale: 0.7, // Makes the button smaller
                      child: FloatingActionButton(
                        onPressed: () {
                          webViewController?.loadUrl(
                            urlRequest: URLRequest(url: WebUri(MAIN_HOME_URL)),
                          );
                        },
                        child: Icon(Icons.home),
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        tooltip: 'Go to Home',
                      ),
                    ),
                  ),
                Align(alignment: Alignment.center, child: _buildProgressBar()),
                progress < 0.6
                    ? LinearProgressIndicator(
                        value: progress,
                        color: Color.fromRGBO(0, 124, 135, 1),
                      )
                    : Container(),
              ],
            ),
          ),
        ]))));
  }

  void _showWebPageNotAvailablePopup(String message) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text("Error"),
          content: Text(message),
          actions: <Widget>[
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: Text("OK"),
            ),
          ],
        );
      },
    );
  }

  Widget _buildProgressBar() {
    if (progress < 0.6) {
      return CircularProgressIndicator(
        color: Color.fromRGBO(0, 124, 135, 1),
      );
    }
    return Container();
  }
}
