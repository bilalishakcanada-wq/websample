import UIKit
import Capacitor
import LocalAuthentication

/// The app's root screen: Capacitor's bridge plus our own plugin and the iOS edge-swipe back gesture.
class ZadatakBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ZadatakNativePlugin())
        // swipe from the left edge = browser back; the router turns it into the previous screen (or closes a sheet)
        webView?.allowsBackForwardNavigationGestures = true
    }
}

/// window.Capacitor.Plugins.ZadatakNative on iOS (src/utils/biometric.js): Face ID / Touch ID, falling back
/// to the phone's passcode, before money leaves escrow.
@objc(ZadatakNativePlugin)
public class ZadatakNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ZadatakNativePlugin"
    public let jsName = "ZadatakNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "biometricInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "confirmIdentity", returnType: CAPPluginReturnPromise)
    ]

    @objc func biometricInfo(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        let kind: String
        switch context.biometryType {
        case .faceID: kind = "face"
        case .touchID: kind = "fingerprint"
        default: kind = "passcode"
        }
        call.resolve(["available": available, "kind": kind])
    }

    @objc func confirmIdentity(_ call: CAPPluginCall) {
        let context = LAContext()
        context.localizedCancelTitle = "Odustani"
        let reason = call.getString("reason") ?? call.getString("title") ?? "Potvrdi da si to ti"
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
            if success {
                call.resolve(["ok": true])
                return
            }
            let code = (error as? LAError)?.code
            let cancelled = code == .userCancel || code == .appCancel || code == .systemCancel
            call.resolve(["ok": false, "cancelled": cancelled, "error": error?.localizedDescription ?? ""])
        }
    }
}
