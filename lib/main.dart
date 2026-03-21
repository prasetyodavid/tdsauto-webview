import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_downloader/flutter_downloader.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:mime/mime.dart';

HttpServer? _assetServer;

Future<void> _startAssetServer() async {
  _assetServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 8080);
  _assetServer!.listen((HttpRequest request) async {
    var path = request.uri.path;
    if (path.isEmpty || path == '/') {
      path = '/index.html';
    }
    final assetKey = 'assets/html$path';

    try {
      final data = await rootBundle.load(assetKey);
      final bytes = data.buffer.asUint8List();
      final isJs = path.endsWith('.js');
      final mimeType = lookupMimeType(path) ??
          (isJs ? 'application/javascript' : 'text/plain');

      if (isJs) {
        request.response.headers.contentType =
            ContentType('application', 'javascript');
      } else {
        request.response.headers.contentType = ContentType.parse(mimeType);
      }
      request.response.add(bytes);
      await request.response.close();
    } catch (e) {
      print('Asset server: failed to load $assetKey: $e');
      request.response.statusCode = HttpStatus.notFound;
      request.response.headers.contentType = ContentType.text;
      request.response.write('404 - asset not found: $assetKey');
      await request.response.close();
    }
  });
}

Future main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Permission.storage.request();
  //await Permission.photos.request();
  //await Permission.videos.request();
  await Permission.manageExternalStorage.request();
  //await Permission.notification.request();
  //await Permission.camera.request();
  await FlutterDownloader.initialize(debug: true, ignoreSsl: true);

  await _startAssetServer();

  runApp(MaterialApp(home: new MyApp()));
}

// change com.package
// D:\Projects\FL\tdsauto-webview\android\app\build.gradle
// flutter pub run flutter_launcher_icons:main
var MAIN_HOME_URL = "https://wla.wuaze.com";
var MAIN_TITLE = "Prediksi WLA";
// Local HTML from assets (used when loading offline)
const String LOCAL_INDEX_ASSET = "assets/html/index.html";

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
            //SizedBox(height: 20),
            //Text(MAIN_TITLE, style: TextStyle(fontSize: 20)),
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

  static const Color _appBg = Color(0xFF121212);
  static const Color _panelBg = Color(0xFF1E1E1E);
  static const Color _borderGray800 = Color(0xFF1F2937);

  static const Color _goldA = Color(0xFFFACC15);
  static const Color _goldB = Color(0xFFF97316);

  static const String _localBaseUrl = 'http://localhost:8080';

  final UnmodifiableListView<UserScript> _hideWebNativeNavScripts =
      UnmodifiableListView<UserScript>([
    UserScript(
      injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
      source: '''
        (function() {
          var sidebar = document.getElementById('sidebar');
          if (sidebar) { sidebar.style.display = 'none'; }
          var overlay = document.getElementById('sidebarOverlay');
          if (overlay) { overlay.style.display = 'none'; }

          var headers = document.querySelectorAll('header');
          headers.forEach(function(h) {
            var cls = h.getAttribute('class') || '';
            if (cls.indexOf('bg-[#1e1e1e]') !== -1) {
              h.style.display = 'none';
            }
          });
        })();
      ''',
    )
  ]);

  Future<void> _navigateToPath(String path) async {
    final controller = webViewController;
    if (controller == null) return;

    final normalizedPath =
        path.startsWith('/') ? path : '/$path'; // ensure leading slash
    final targetUrl = '$_localBaseUrl$normalizedPath';

    await controller.loadUrl(
      urlRequest: URLRequest(url: WebUri(targetUrl)),
    );
  }

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
            appBar: PreferredSize(
              preferredSize: const Size.fromHeight(52),
              child: Builder(
                builder: (context) => PrediksiWlaTopBar(
                  onMenuPressed: () => Scaffold.of(context).openDrawer(),
                  onHomePressed: () => _navigateToPath('/index.html'),
                  onLinkJpPressed: () async {
                    final controller = webViewController;
                    if (controller == null) return;
                    await controller.loadUrl(
                      urlRequest: URLRequest(url: WebUri(MAIN_HOME_URL)),
                    );
                  },
                ),
              ),
            ),
            drawer: PrediksiWlaDrawer(
              panelBg: _panelBg,
              borderGray800: _borderGray800,
              goldA: _goldA,
              goldB: _goldB,
              onNavigate: (path) => _navigateToPath(path),
            ),
            backgroundColor: _appBg,
            body: SafeArea(
              top: false,
              child: Column(children: <Widget>[
                Expanded(
                  child: Stack(
                    children: [
                      InAppWebView(
                        key: webViewKey,
                        initialUrlRequest: URLRequest(
                          url: WebUri('$_localBaseUrl/index.html'),
                        ),
                        initialOptions: options,
                        initialUserScripts: _hideWebNativeNavScripts,
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
                            savedDir:
                                (await getApplicationDocumentsDirectory()).path,
                            fileName: file_Name,
                            showNotification: true,
                            openFileFromNotification: true,
                            saveInPublicStorage: true,
                          ).catchError((error) {
                            print("Download failed: $error");
                            return null;
                          });
                        },
                        onReceivedServerTrustAuthRequest:
                            (controller, challenge) async {
                          return ServerTrustAuthResponse(
                              action: ServerTrustAuthResponseAction.PROCEED);
                        },
                        onLoadStart: (controller, url) {
                          setState(() {
                            this.url = url.toString();
                            urlController.text = this.url;
                          });
                        },
                        onPermissionRequest: (controller, request) async {
                          // checking this to get permission on specific URL
                          if (true) {
                            try {
                              var cameraStatus =
                                  await Permission.camera.request();
                              if (cameraStatus.isDenied) {
                                await Permission.camera.request();
                              }
                              return PermissionResponse(
                                  action: PermissionResponseAction.GRANT,
                                  resources: [
                                    PermissionResourceType
                                        .CAMERA_AND_MICROPHONE,
                                  ]);
                            } catch (e) {
                              return PermissionResponse(
                                  action: PermissionResponseAction.PROMPT,
                                  resources: [
                                    PermissionResourceType
                                        .CAMERA_AND_MICROPHONE,
                                  ]);
                            }
                          }
                        },
                        androidOnGeolocationPermissionsShowPrompt:
                            (InAppWebViewController controller,
                                String origin) async {
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
                        onUpdateVisitedHistory:
                            (controller, url, androidIsReload) {
                          setState(() {
                            this.url = url.toString();
                            urlController.text = this.url;
                          });
                        },
                        onConsoleMessage: (controller, consoleMessage) {
                          print(consoleMessage);
                        },
                      ),
                      Align(
                          alignment: Alignment.center,
                          child: _buildProgressBar()),
                      progress < 1.0
                          ? LinearProgressIndicator(
                              value: progress,
                              color: const Color.fromRGBO(233, 78, 7, 1),
                            )
                          : Container(),
                    ],
                  ),
                ),
              ]),
            )));
  }

  Widget _buildProgressBar() {
    if (progress != 1.0) {
      return CircularProgressIndicator(color: Color.fromRGBO(233, 78, 7, 1));
    }
    return Container();
  }
}

class PrediksiWlaTopBar extends StatelessWidget {
  final VoidCallback onMenuPressed;
  final VoidCallback onHomePressed;
  final VoidCallback onLinkJpPressed;

  const PrediksiWlaTopBar({
    super.key,
    required this.onMenuPressed,
    required this.onHomePressed,
    required this.onLinkJpPressed,
  });

  @override
  Widget build(BuildContext context) {
    const panelBg = Color(0xFF1E1E1E);
    const borderGray800 = Color(0xFF1F2937);
    const goldA = Color(0xFFFACC15);
    const goldB = Color(0xFFF97316);

    return Container(
      decoration: BoxDecoration(
        color: panelBg,
        border: Border(bottom: BorderSide(color: borderGray800)),
        boxShadow: const [
          BoxShadow(
            blurRadius: 10,
            color: Colors.black54,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: 52,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: onMenuPressed,
                    icon: const Icon(Icons.menu, color: Color(0xFFF97316)),
                    tooltip: 'Menu',
                  ),
                  const SizedBox(width: 4),
                  InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: onHomePressed,
                    child: Row(
                      children: [
                        const Text(
                          'PREDIKSI',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                            letterSpacing: -0.3,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 0),
                        ShaderMask(
                          shaderCallback: (bounds) {
                            return const LinearGradient(
                              colors: [goldA, goldB],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ).createShader(bounds);
                          },
                          blendMode: BlendMode.srcIn,
                          child: const Text(
                            'WLA',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              fontStyle: FontStyle.italic,
                              letterSpacing: -0.3,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: onLinkJpPressed,
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [goldA, goldB],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(
                        color: goldB.withOpacity(0.25),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Text(
                    'LINK JP',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 1.1,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PrediksiWlaDrawer extends StatefulWidget {
  final Color panelBg;
  final Color borderGray800;
  final Color goldA;
  final Color goldB;
  final void Function(String path) onNavigate;

  const PrediksiWlaDrawer({
    super.key,
    required this.panelBg,
    required this.borderGray800,
    required this.goldA,
    required this.goldB,
    required this.onNavigate,
  });

  @override
  State<PrediksiWlaDrawer> createState() => _PrediksiWlaDrawerState();
}

class _PrediksiWlaDrawerState extends State<PrediksiWlaDrawer> {
  bool _bukuMimpiOpen = false;

  Widget _drawerIcon(IconData icon, {required Color iconBg}) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: iconBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 20, color: Colors.grey[300]),
    );
  }

  Widget _navItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(
          children: [
            _drawerIcon(icon, iconBg: const Color(0xFF2A2A2A)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _submenuItem({
    required String title,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 6),
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Color(0xFF9CA3AF),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: 288,
      backgroundColor: widget.panelBg,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: widget.borderGray800),
                ),
              ),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () {
                  Navigator.of(context).pop();
                  widget.onNavigate('/index.html');
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'PREDIKSI',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        fontStyle: FontStyle.italic,
                        letterSpacing: -0.3,
                        color: Colors.white,
                      ),
                    ),
                    ShaderMask(
                      shaderCallback: (bounds) {
                        return LinearGradient(
                          colors: [widget.goldA, widget.goldB],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ).createShader(bounds);
                      },
                      blendMode: BlendMode.srcIn,
                      child: const Text(
                        'WLA',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          fontStyle: FontStyle.italic,
                          letterSpacing: -0.3,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(top: 8),
                children: [
                  // Buku Mimpi (submenu)
                  InkWell(
                    onTap: () => setState(() {
                      _bukuMimpiOpen = !_bukuMimpiOpen;
                    }),
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Row(
                        children: [
                          _drawerIcon(Icons.menu_book_outlined,
                              iconBg: const Color(0xFF2A2A2A)),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Text(
                              'Buku Mimpi',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey,
                              ),
                            ),
                          ),
                          Transform.rotate(
                            angle: _bukuMimpiOpen ? math.pi : 0,
                            child: const Icon(
                              Icons.keyboard_arrow_down,
                              color: Color(0xFFF97316),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  AnimatedCrossFade(
                    firstChild: const SizedBox.shrink(),
                    secondChild: Column(
                      children: [
                        _submenuItem(
                          title: 'Buku Mimpi 2D',
                          onTap: () {
                            Navigator.of(context).pop();
                            widget.onNavigate('/buku-mimpi-2d.html');
                          },
                        ),
                        _submenuItem(
                          title: 'Buku Mimpi 3D',
                          onTap: () {
                            Navigator.of(context).pop();
                            widget.onNavigate('/buku-mimpi-3d.html');
                          },
                        ),
                        _submenuItem(
                          title: 'Buku Mimpi 4D',
                          onTap: () {
                            Navigator.of(context).pop();
                            widget.onNavigate('/buku-mimpi-4d.html');
                          },
                        ),
                      ],
                    ),
                    crossFadeState: _bukuMimpiOpen
                        ? CrossFadeState.showSecond
                        : CrossFadeState.showFirst,
                    duration: const Duration(milliseconds: 200),
                  ),

                  const Divider(color: Color(0xFF1F2937), thickness: 1),

                  _navItem(
                    icon: Icons.search,
                    title: 'Paito',
                    onTap: () {
                      Navigator.of(context).pop();
                      widget.onNavigate('/index.html');
                    },
                  ),
                  _navItem(
                    icon: Icons.table_chart,
                    title: 'Tabel Shio',
                    onTap: () {
                      Navigator.of(context).pop();
                      widget.onNavigate('/tabel-shio.html');
                    },
                  ),
                  _navItem(
                    icon: Icons.auto_graph,
                    title: 'Generator 4D',
                    onTap: () {
                      Navigator.of(context).pop();
                      widget.onNavigate('/generator4d.html');
                    },
                  ),
                  _navItem(
                    icon: Icons.dashboard_customize,
                    title: 'BBFS',
                    onTap: () {
                      Navigator.of(context).pop();
                      widget.onNavigate('/bbfs.html');
                    },
                  ),
                  _navItem(
                    icon: Icons.watch_later_outlined,
                    title: 'Jadwal',
                    onTap: () {
                      Navigator.of(context).pop();
                      widget.onNavigate('/jadwal.html');
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
