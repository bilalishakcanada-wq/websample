package ba.poso.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ZadatakNativePlugin.class); // before super: the bridge is built there
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        // no edge glow / stretch and no scrollbar track: scrolling looks like a native list, not a web page
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
    }

    /**
     * The category phone notifications arrive in; the user sees it (and can mute it) in the phone's settings.
     * The id is what the send-push-notification Edge Function puts on every Android message.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel("zadatak-updates", "Poruke, ponude i poslovi", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Nove poruke, ponude, prihvaćeni poslovi i plaćanja");
        channel.enableLights(true);
        channel.setLightColor(Color.parseColor("#1F5FFF"));
        channel.enableVibration(true);
        channel.setShowBadge(true);
        manager.createNotificationChannel(channel);
    }
}
