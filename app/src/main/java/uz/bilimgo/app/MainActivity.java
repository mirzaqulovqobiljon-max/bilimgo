package uz.bilimgo.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/**
 * BilimGo — offline ishlaydigan web ilovani (assets/www/index.html) WebView ichida ochadi.
 *
 * Sahifa https://appassets.androidplatform.net/ manzilidan yuklanadi (WebViewAssetLoader):
 * bu barqaror "origin" beradi, shuning uchun localStorage dagi natijalar yo'qolmaydi.
 */
public class MainActivity extends ComponentActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final String HOST = "appassets.androidplatform.net";
    private static final long EXIT_WINDOW_MS = 2000;

    private WebView webView;
    private TtsBridge tts;
    private long lastBackAt;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15 (API 35) da edge-to-edge majburiy — tizim panellari uchun joyni o'zimiz qoldiramiz.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // localStorage — o'quvchi natijalari
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // AudioContext ovoz effektlari
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);                     // tizim shrift o'lchami dizaynni buzmasin
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        tts = new TtsBridge(this, webView);
        webView.addJavascriptInterface(tts, "AndroidTTS");

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                // Tashqi havolalar brauzerda ochiladi
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                android.util.Log.d("BilimGo", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);

        // Holat (progress) localStorage da saqlanadi, shuning uchun har safar toza yuklash yetarli.
        webView.loadUrl(START_URL);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Avval sahifaning o'ziga beramiz: oyna yopish / darsdan chiqish / bosh sahifaga qaytish.
                webView.evaluateJavascript("(window.__bilimgoBack ? window.__bilimgoBack() : false)", result -> {
                    if ("true".equals(result)) return;
                    long now = SystemClock.elapsedRealtime();
                    if (now - lastBackAt < EXIT_WINDOW_MS) {
                        finish();
                    } else {
                        lastBackAt = now;
                        Toast.makeText(MainActivity.this, R.string.press_back_again, Toast.LENGTH_SHORT).show();
                    }
                });
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        tts.stop();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        tts.shutdown();
        webView.removeJavascriptInterface("AndroidTTS");
        webView.destroy();
        super.onDestroy();
    }
}
