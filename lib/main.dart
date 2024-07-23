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
  await Permission.storage.request();
  await Permission.photos.request();
  await Permission.notification.request();
  await FlutterDownloader.initialize(debug: true, ignoreSsl: true);

  runApp(MaterialApp(home: new MyApp()));
}

// change com.package
// D:\Projects\FL\tdsauto-webview\android\app\build.gradle
// flutter pub run flutter_launcher_icons:main
var MAIN_HOME_URL = "https://smpitinsancendekia.belajarku.id/app/";
var MAIN_TITLE = "SMART SCHOOL";

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

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
        onWillPop: _onWillPop,
        child: Scaffold(
            //appBar: AppBar(title: Text("Official InAppWebView website")),
            body: SafeArea(
                child: Column(children: <Widget>[
          Expanded(
            child: Stack(
              children: [
                InAppWebView(
                  key: webViewKey,
                  initialUrlRequest: URLRequest(url: WebUri(MAIN_HOME_URL)),
                  //url: Uri.parse("https://browserleaks.com/geo")), //test
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
                  },
                  androidOnPermissionRequest:
                      (controller, origin, resources) async {
                    return PermissionRequestResponse(
                        resources: resources,
                        action: PermissionRequestResponseAction.GRANT);
                  },
                  androidOnGeolocationPermissionsShowPrompt:
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
                    pullToRefreshController.endRefreshing();
                    if (url != null) {
                      await updateCookies(url);
                    }
                    setState(() {
                      this.url = url.toString();
                      urlController.text = this.url;
                    });
                  },
                  onLoadError: (controller, url, code, message) {
                    pullToRefreshController.endRefreshing();
                  },
                  onProgressChanged: (controller, progress) {
                    if (progress == 100) {
                      pullToRefreshController.endRefreshing();
                    }
                    setState(() {
                      this.progress = progress / 100;
                      urlController.text = this.url;
                    });
                  },
                  onUpdateVisitedHistory: (controller, url, androidIsReload) {
                    setState(() {
                      this.url = url.toString();
                      urlController.text = this.url;
                    });
                  },
                  onConsoleMessage: (controller, consoleMessage) {
                    print(consoleMessage);
                  },
                ),
                Align(alignment: Alignment.center, child: _buildProgressBar()),
                progress < 1.0
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

  Widget _buildProgressBar() {
    if (progress != 1.0) {
      return CircularProgressIndicator(
        color: Color.fromRGBO(0, 124, 135, 1),
      );
    }
    return Container();
  }
}
