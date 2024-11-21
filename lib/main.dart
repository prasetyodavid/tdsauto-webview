import 'dart:async';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_downloader/flutter_downloader.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_kiosk_mode/flutter_kiosk_mode.dart';

Future main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Permission.storage.request();
  await Permission.photos.request();
  await Permission.videos.request();
  await Permission.manageExternalStorage.request();
  await Permission.notification.request();
  await Permission.camera.request();
  await FlutterDownloader.initialize(debug: true, ignoreSsl: true);

  runApp(MaterialApp(home: new MyApp()));
}

// change com.package
// D:\Projects\FL\tdsauto-webview\android\app\build.gradle
// flutter pub run flutter_launcher_icons:main
var MAIN_HOME_URL = "https://bk.smamuha1kra.belajarku.id/apk/";
var MAIN_TITLE = "SMART BK";

final GlobalKey webViewKey = GlobalKey();
late InAppWebViewController webViewController;

double progress = 0;
String url = "";
late TextEditingController urlController;
bool isKioskMode = true;
bool _isLocked = isKioskMode;

final TextEditingController passwordController = TextEditingController();
final _flutterKioskMode = FlutterKioskMode.instance();

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
    await _flutterKioskMode.start();
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

  void _toggleKioskMode(BuildContext context) {
    if (isKioskMode) {
      _exitKioskMode(context);
    } else {
      _startKioskMode(context);
    }
  }

  InAppWebViewController? webViewController;
  InAppWebViewGroupOptions options = InAppWebViewGroupOptions(
      crossPlatform: InAppWebViewOptions(
          useShouldOverrideUrlLoading: true,
          mediaPlaybackRequiresUserGesture: false,
          useOnDownloadStart: true),
      android: AndroidInAppWebViewOptions(
        useHybridComposition: true,
        builtInZoomControls: false,
        displayZoomControls: false,
      ),
      ios: IOSInAppWebViewOptions(
        allowsInlineMediaPlayback: true,
      ));

  late PullToRefreshController pullToRefreshController;
  String url = "";
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
    super.dispose();
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

  void _startKioskMode(context) async {
    await _flutterKioskMode.start();
    setState(() {
      isKioskMode = true;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Aplikasi terkunci')),
    );
  }

  void _exitKioskMode(context) async {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Buka kunci"),
        content: TextField(
          obscureText: true,
          decoration: InputDecoration(labelText: "Password"),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text("Batal"),
          ),
          TextButton(
            onPressed: () async {
              // Check password here
              if ("exit123" == "exit123") {
                await _flutterKioskMode.stop();
                setState(() {
                  isKioskMode = false;
                });

                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Kunci terbuka')),
                );

                Navigator.of(context).pop();
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text("Salah Password!")),
                );
              }
            },
            child: Text("Konfirmasi"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              InAppWebView(
                key: webViewKey,
                initialUrlRequest: URLRequest(url: WebUri(MAIN_HOME_URL)),
                initialOptions: InAppWebViewGroupOptions(),
                pullToRefreshController: pullToRefreshController,
                onWebViewCreated: (controller) {
                  webViewController = controller;
                },
                onLoadStop: (controller, url) {
                  pullToRefreshController.endRefreshing();
                  setState(() {
                    this.url = url.toString();
                  });
                },
                onProgressChanged: (controller, progress) {
                  setState(() {
                    this.progress = progress / 100;
                  });
                },
              ),
              if (isKioskMode)
                Align(
                  alignment: Alignment.center,
                  child: _buildProgressBar(),
                ),
              Positioned(
                bottom: 20,
                right: 20,
                child: FloatingActionButton(
                  onPressed: () => _toggleKioskMode(context),
                  child: Icon(isKioskMode
                      ? Icons.lock
                      : Icons.lock_open), // Toggle icon
                ),
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgressBar() {
    if (progress != 1.0) {
      return CircularProgressIndicator(
        color: Color.fromRGBO(0, 124, 135, 1),
      );
    }
    return Container();
  }
}
