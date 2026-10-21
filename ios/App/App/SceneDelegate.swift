import UIKit
import UserNotifications
import WebKit
import Capacitor

/** Homie's background before the page sets its own: what shows behind the keyboard's rounded corners. */
let homieBackground = UIColor { traits in
    traits.userInterfaceStyle == .dark
        ? UIColor(red: 0x12 / 255, green: 0x16 / 255, blue: 0x14 / 255, alpha: 1)
        : UIColor(red: 0xf8 / 255, green: 0xf7 / 255, blue: 0xf2 / 255, alpha: 1)
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = homieBackground
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/** The web view, held to the zoom of a native screen: no pinch, no zoom into a field on focus. */
class MainViewController: CAPBridgeViewController {
    private var navigationGuard: NavigationGuard?

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppearancePlugin())
        view.backgroundColor = homieBackground
        if let webView = webView, let inner = webView.navigationDelegate as? (NSObject & WKNavigationDelegate) {
            let guardian = NavigationGuard(inner: inner, errorURL: bridge?.config.errorPathURL)
            navigationGuard = guardian
            webView.navigationDelegate = guardian
        }
        guard let scrollView = webView?.scrollView else { return }
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 1
        scrollView.bouncesZoom = false
        scrollView.pinchGestureRecognizer?.isEnabled = false
    }
}

/**
 * Sits in front of Capacitor's navigation delegate. Capacitor shows the offline page for any navigation that
 * fails to start, including one that was only cancelled because another replaced it (a link opened twice,
 * a tap while a page loads); those are left alone. A real failure shows the offline page with the address
 * that failed, so Try again can load it rather than reloading the offline page itself.
 */
final class NavigationGuard: NSObject, WKNavigationDelegate {
    private let inner: NSObject & WKNavigationDelegate
    private let errorURL: URL?

    init(inner: NSObject & WKNavigationDelegate, errorURL: URL?) {
        self.inner = inner
        self.errorURL = errorURL
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || inner.responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        inner.responds(to: aSelector) ? inner : nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let failure = error as NSError
        let cancelled = failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled
        let interrupted = failure.domain == "WebKitErrorDomain" && failure.code == 102
        if cancelled || interrupted { return }
        guard let errorURL = errorURL, var page = URLComponents(url: errorURL, resolvingAgainstBaseURL: false) else {
            inner.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
            return
        }
        if let failed = failure.userInfo[NSURLErrorFailingURLStringErrorKey] as? String {
            page.queryItems = [URLQueryItem(name: "from", value: failed)]
        }
        if let url = page.url { webView.load(URLRequest(url: url)) }
    }
}

/** Lets the page paint what's behind the web view in its own background, light or dark as the person chose. */
@objc(AppearancePlugin)
public class AppearancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppearancePlugin"
    public let jsName = "Appearance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setBackground", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBadge", returnType: CAPPluginReturnPromise)
    ]

    /** The red number on the app icon: what's new in the bell. */
    @objc func setBadge(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { _ in call.resolve() }
        } else {
            DispatchQueue.main.async {
                UIApplication.shared.applicationIconBadgeNumber = count
                call.resolve()
            }
        }
    }

    @objc func setBackground(_ call: CAPPluginCall) {
        guard let hex = call.getString("color"), let color = UIColor(homieHex: hex) else {
            call.reject("color")
            return
        }
        DispatchQueue.main.async {
            let controller = self.bridge?.viewController
            controller?.view.backgroundColor = color
            controller?.view.window?.backgroundColor = color
            self.bridge?.webView?.backgroundColor = color
            self.bridge?.webView?.scrollView.backgroundColor = color
            call.resolve()
        }
    }
}

extension UIColor {
    /** "#rrggbb" */
    convenience init?(homieHex: String) {
        let digits = homieHex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: 1
        )
    }
}
