import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show MethodChannel, rootBundle;
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_downloader/flutter_downloader.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:mime/mime.dart';
import 'package:android_play_install_referrer/android_play_install_referrer.dart';

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
  //await Permission.notification.request();
  //await Permission.camera.request();
  await FlutterDownloader.initialize(debug: true, ignoreSsl: true);

  await _startAssetServer();

  runApp(MaterialApp(home: new MyApp()));
}

// change com.package
// D:\Projects\FL\tdsauto-webview\android\app\build.gradle
// flutter pub run flutter_launcher_icons:main
var MAIN_HOME_URL = "http://wla.simbox.id";
var MAIN_TITLE = "WLA Calculator";
// Local HTML from assets (used when loading offline)
const String LOCAL_INDEX_ASSET = "assets/html/index.html";

/// Bundled HTML entry served by [_startAssetServer].
const String _localWebEntryUrl = 'http://localhost:8080/index.html';

// --- TEMP: set to false (or delete this block) before Play Store release ---
/// Simulates Play [ReferrerDetails.installReferrer]. Applies in **all** build modes
/// (`debug` / `profile` / `release`) when `true`, so profile & release installs still
/// test `ref=` without Play — unlike `kDebugMode`, which is false for profile/release.
const bool _debugUseHardcodedInstallReferrer = false;

/// Same shape as the decoded `referrer=` query (e.g. TikTok paid example).
const String _debugHardcodedInstallReferrer =
    'utm_source=tiktok&utm_medium=paid&utm_campaign=campaign1';
// --- end TEMP ---

String _mainHomeUrlWithRef(String refValue) {
  final uri = Uri.parse(MAIN_HOME_URL);
  final params = Map<String, String>.from(uri.queryParameters);
  params['ref'] = refValue;
  return uri.replace(queryParameters: params).toString();
}

String? _utmCampaignFromInstallReferrer(String raw) {
  if (raw.isEmpty) return null;
  String normalized = raw;
  if (raw.contains('%')) {
    try {
      normalized = Uri.decodeComponent(raw);
    } catch (_) {
      normalized = raw;
    }
  }
  final params = Uri.splitQueryString(normalized);
  final campaign = params['utm_campaign'];
  if (campaign == null || campaign.isEmpty) return null;
  return campaign;
}

/// Play Store `referrer=` is exposed as [ReferrerDetails.installReferrer] (see
/// [android_play_install_referrer](https://pub.dev/documentation/android_play_install_referrer/latest/)).
/// When `utm_campaign` is present, open [MAIN_HOME_URL] with `ref=<campaign>`.
Future<String> resolveInitialWebViewUrl() async {
  try {
    if (_debugUseHardcodedInstallReferrer) {
      final campaign =
          _utmCampaignFromInstallReferrer(_debugHardcodedInstallReferrer);
      if (campaign != null) {
        final url = _mainHomeUrlWithRef(campaign);
        debugPrint('DEBUG install referrer (hardcoded) → $url');
        return url;
      }
      debugPrint(
          'DEBUG: _debugUseHardcodedInstallReferrer is true but utm_campaign '
          'was null/empty for: $_debugHardcodedInstallReferrer');
    }
    if (!Platform.isAndroid) {
      return _localWebEntryUrl;
    }
    try {
      final details = await AndroidPlayInstallReferrer.installReferrer;
      final raw = details.installReferrer;
      if (raw == null || raw.isEmpty) {
        return _localWebEntryUrl;
      }
      final campaign = _utmCampaignFromInstallReferrer(raw);
      if (campaign != null) {
        return _mainHomeUrlWithRef(campaign);
      }
    } catch (e) {
      debugPrint('Install referrer unavailable: $e');
    }
    return _localWebEntryUrl;
  } catch (e, st) {
    debugPrint('resolveInitialWebViewUrl failed: $e\n$st');
    return _localWebEntryUrl;
  }
}

class SplashScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
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
  late final Future<String> _initialWebViewFuture;

  @override
  void initState() {
    super.initState();
    _initialWebViewFuture = _bootWithSplash();
  }

  Future<String> _bootWithSplash() async {
    // Resolve URL first (avoids any Future.wait ordering mistakes), then splash.
    final url = await resolveInitialWebViewUrl();
    debugPrint('Initial WebView URL (after resolve): $url');
    await Future.delayed(const Duration(seconds: 3));
    return url;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _initialWebViewFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return SplashScreen();
        }
        if (snapshot.hasError) {
          debugPrint(
              'Boot future failed (using local entry): ${snapshot.error}\n'
              '${snapshot.stackTrace}');
          return WebViewScreen(initialUrl: _localWebEntryUrl);
        }
        final initialUrl = snapshot.data ?? _localWebEntryUrl;
        if (snapshot.data == null) {
          debugPrint(
              'Boot future completed with null data; using $_localWebEntryUrl');
        }
        return WebViewScreen(initialUrl: initialUrl);
      },
    );
  }
}

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key, required this.initialUrl});

  final String initialUrl;

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

  static const MethodChannel _androidDownloadsChannel =
      MethodChannel('com.wlacalculator.app/downloads');

  /// Android 10+: [MediaStore.Downloads] via platform channel (Play-friendly, no MANAGE_EXTERNAL_STORAGE).
  Future<Map<String, dynamic>> _saveCsvAndroidDownloadsViaMediaStore(
    Uint8List bytes,
    String displayName, {
    bool retried = false,
  }) async {
    try {
      final dynamic raw = await _androidDownloadsChannel.invokeMethod<dynamic>(
        'saveToDownloads',
        <String, dynamic>{
          'displayName': displayName,
          'bytes': bytes,
        },
      );
      if (raw is Map) {
        final Object? okVal = raw['ok'];
        if (okVal == true) {
          return <String, dynamic>{
            'ok': true,
            'path': raw['path']?.toString() ?? '',
            'usedDownloads': true,
          };
        }
        final String err = raw['error']?.toString() ?? 'Save failed';
        if (err == 'storage_permission_required' && !retried) {
          final PermissionStatus st = await Permission.storage.request();
          if (st.isGranted) {
            return _saveCsvAndroidDownloadsViaMediaStore(
              bytes,
              displayName,
              retried: true,
            );
          }
          return <String, dynamic>{
            'ok': false,
            'error':
                'Storage permission denied (needed on Android 9 and below only)',
          };
        }
        return <String, dynamic>{'ok': false, 'error': err};
      }
      return <String, dynamic>{
        'ok': false,
        'error': 'Unexpected response from save channel',
      };
    } catch (e, st) {
      debugPrint('_saveCsvAndroidDownloadsViaMediaStore: $e\n$st');
      return <String, dynamic>{'ok': false, 'error': e.toString()};
    }
  }

  /// Saves CSV from the WebView (base64 UTF-8). Android uses MediaStore Downloads.
  Future<Map<String, dynamic>> _saveCsvToDownloadsFromWeb(List<dynamic> args) async {
    if (args.length < 2) {
      return <String, dynamic>{'ok': false, 'error': 'Missing filename or data'};
    }
    final rawName = args[0]?.toString() ?? 'export.csv';
    final base64Csv = args[1]?.toString() ?? '';
    if (base64Csv.isEmpty) {
      return <String, dynamic>{'ok': false, 'error': 'Empty CSV payload'};
    }

    late final List<int> bytes;
    try {
      bytes = base64Decode(base64Csv);
    } catch (e) {
      return <String, dynamic>{'ok': false, 'error': 'Invalid base64: $e'};
    }

    var safeName = rawName.replaceAll(RegExp(r'[/\\?%*:|"<>]'), '_');
    if (!safeName.toLowerCase().endsWith('.csv')) {
      safeName = '$safeName.csv';
    }

    if (Platform.isAndroid) {
      return _saveCsvAndroidDownloadsViaMediaStore(
        Uint8List.fromList(bytes),
        safeName,
      );
    }

    final Directory? downloads = await getDownloadsDirectory();
    final bool usedPublicDownloads = downloads != null;
    final Directory targetDir =
        downloads ?? await getApplicationDocumentsDirectory();
    final File file = File('${targetDir.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);

    return <String, dynamic>{
      'ok': true,
      'path': file.path,
      'usedDownloads': usedPublicDownloads,
    };
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
                  initialUrlRequest: URLRequest(
                    url: WebUri(widget.initialUrl),
                  ),
                  initialOptions: options,
                  pullToRefreshController: pullToRefreshController,
                  onWebViewCreated: (controller) {
                    webViewController = controller;
                    controller.addJavaScriptHandler(
                      handlerName: 'saveCsvToDownloads',
                      callback: (args) async {
                        try {
                          final Map<String, dynamic> result =
                              await _saveCsvToDownloadsFromWeb(
                                  List<dynamic>.from(args));
                          if (mounted) {
                            final bool ok = result['ok'] == true;
                            final bool usedDl = result['usedDownloads'] == true;
                            final String message = ok
                                ? (usedDl
                                    ? 'Saved to Downloads'
                                    : 'Saved to app folder')
                                : 'Save failed: ${result['error']}';
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(message)),
                            );
                          }
                          return result;
                        } catch (e, st) {
                          debugPrint('saveCsvToDownloads: $e\n$st');
                          final Map<String, dynamic> err = <String, dynamic>{
                            'ok': false,
                            'error': e.toString(),
                          };
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content: Text('Save failed: ${e.toString()}')),
                            );
                          }
                          return err;
                        }
                      },
                    );
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
                        var cameraStatus = await Permission.camera.request();
                        if (cameraStatus.isDenied) {
                          await Permission.camera.request();
                        }
                        return PermissionResponse(
                            action: PermissionResponseAction.GRANT,
                            resources: [
                              PermissionResourceType.CAMERA_AND_MICROPHONE,
                            ]);
                      } catch (e) {
                        return PermissionResponse(
                            action: PermissionResponseAction.PROMPT,
                            resources: [
                              PermissionResourceType.CAMERA_AND_MICROPHONE,
                            ]);
                      }
                    }
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
                /*
                Positioned(
                  right: 5, // Positioned to the center right
                  bottom: 5, // Adjust for centering vertically
                  child: Transform.scale(
                    scale: 0.7, // Makes the button smaller
                    child: FloatingActionButton(
                      onPressed: () {
                        webViewController?.loadFile(
                          assetFilePath: LOCAL_INDEX_ASSET,
                        );
                      },
                      child: Icon(Icons.home),
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                      tooltip: 'Go to Home',
                    ),
                  ),
                ),
                */
                Align(alignment: Alignment.center, child: _buildProgressBar()),
                progress < 1.0
                    ? LinearProgressIndicator(
                        value: progress,
                        color: Color.fromARGB(255, 33, 140, 247),
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
          color: Color.fromARGB(255, 33, 140, 247));
    }
    return Container();
  }
}
