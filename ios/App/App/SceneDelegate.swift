import UIKit
import UserNotifications
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
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppearancePlugin())
        view.backgroundColor = homieBackground
        guard let scrollView = webView?.scrollView else { return }
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 1
        scrollView.bouncesZoom = false
        scrollView.pinchGestureRecognizer?.isEnabled = false
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
