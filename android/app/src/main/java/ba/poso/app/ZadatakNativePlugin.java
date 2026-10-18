package ba.poso.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Small bridge for what Capacitor's own plugins don't cover:
 *  - confirmIdentity: the system fingerprint / face / screen-lock dialog before money leaves escrow;
 *  - systemColors: the Android 12+ wallpaper accent (Material You), so the app can tint small details with it;
 *  - pushInfo: whether this build has Firebase (google-services.json), so the site only offers phone
 *    notifications when they can work (registering without Firebase would crash the app);
 *  - openAppSettings: Zadatak's page in the phone settings, for a location or notification permission
 *    that was refused (Android doesn't show the system dialog again after that).
 * The site calls it as window.Capacitor.Plugins.ZadatakNative (src/utils/biometric.js, src/utils/native.js).
 */
@CapacitorPlugin(name = "ZadatakNative")
public class ZadatakNativePlugin extends Plugin {

    // fingerprint/face (any class) or, when none is set up, the phone's PIN/pattern/password
    private static final int AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    @PluginMethod
    public void pushInfo(PluginCall call) {
        // the google-services Gradle plugin adds this string only when google-services.json was in the build
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("available", id != 0);
        call.resolve(result);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Postavke se ne mogu otvoriti", error);
        }
    }

    @PluginMethod
    public void biometricInfo(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        boolean biometric = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS;
        JSObject result = new JSObject();
        result.put("available", manager.canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("kind", biometric ? "biometric" : "passcode");
        call.resolve(result);
    }

    @PluginMethod
    public void confirmIdentity(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        String title = call.getString("title", "Potvrdi da si to ti");
        String reason = call.getString("reason", "");
        AtomicBoolean answered = new AtomicBoolean(false);
        activity.runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        if (!answered.compareAndSet(false, true)) return;
                        JSObject ok = new JSObject();
                        ok.put("ok", true);
                        call.resolve(ok);
                    }

                    @Override
                    public void onAuthenticationError(int code, CharSequence message) {
                        if (!answered.compareAndSet(false, true)) return;
                        JSObject no = new JSObject();
                        no.put("ok", false);
                        no.put("cancelled", code == BiometricPrompt.ERROR_USER_CANCELED
                            || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                            || code == BiometricPrompt.ERROR_CANCELED);
                        no.put("error", String.valueOf(message));
                        call.resolve(no);
                    }
                    // onAuthenticationFailed (a finger that didn't match): the dialog stays open for another try
                });
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setAllowedAuthenticators(AUTHENTICATORS)
                .setConfirmationRequired(false);
            if (!reason.isEmpty()) info.setSubtitle(reason);
            prompt.authenticate(info.build());
        });
    }

    @PluginMethod
    public void systemColors(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            result.put("accent", hex(android.R.color.system_accent1_600));
            result.put("accentLight", hex(android.R.color.system_accent1_100));
            result.put("accentDark", hex(android.R.color.system_accent1_800));
        }
        call.resolve(result);
    }

    private String hex(int colorRes) {
        return String.format("#%06X", 0xFFFFFF & ContextCompat.getColor(getContext(), colorRes));
    }
}
