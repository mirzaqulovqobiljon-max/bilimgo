package uz.bilimgo.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Android WebView Web Speech API (speechSynthesis) ni qo'llab-quvvatlamaydi —
 * u yerda getVoices() bo'sh, speak() esa jim. Bu klass Android TextToSpeech ni
 * JS ga "AndroidTTS" nomi bilan beradi; web/android-bridge.js uni standart
 * window.speechSynthesis ko'rinishiga o'giradi, shuning uchun web kodi o'zgarmaydi.
 *
 * {@link JavascriptInterface} metodlari WebView ning fon oqimida chaqiriladi.
 */
final class TtsBridge implements TextToSpeech.OnInitListener {

    private static final Locale[] ENGLISH = {Locale.US, Locale.UK, new Locale("en", "AU"), new Locale("en", "IN")};

    private final Activity activity;
    private final WebView webView;
    private final TextToSpeech tts;

    private final Object lock = new Object();
    private volatile boolean initDone;
    private volatile boolean engineOk;
    private final List<Locale> englishLocales = new ArrayList<>();
    private String[] pending; // init tugamasdan kelgan oxirgi so'rov
    private boolean warnedNoEnglish;
    private boolean warnedNoEngine;

    TtsBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.tts = new TextToSpeech(activity.getApplicationContext(), this);
    }

    @Override
    public void onInit(int status) {
        String[] toSpeak;
        synchronized (lock) {
            engineOk = status == TextToSpeech.SUCCESS;
            if (engineOk) {
                for (Locale l : ENGLISH) {
                    int r;
                    try {
                        r = tts.isLanguageAvailable(l);
                    } catch (RuntimeException e) {
                        r = TextToSpeech.LANG_NOT_SUPPORTED;
                    }
                    if (r >= TextToSpeech.LANG_AVAILABLE) englishLocales.add(l);
                }
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { emit(id, "start"); }
                    @Override public void onDone(String id) { emit(id, "end"); }
                    @Override public void onError(String id) { emit(id, "error"); }
                    @Override public void onStop(String id, boolean interrupted) { emit(id, "end"); }
                });
            }
            initDone = true;
            toSpeak = pending;
            pending = null;
        }
        final String json = voicesJson();
        webView.post(() -> webView.evaluateJavascript(
                "window.__bilimgoTts && window.__bilimgoTts.ready(" + JSONObject.quote(json) + ")", null));
        if (toSpeak != null) speak(toSpeak[0], Float.parseFloat(toSpeak[1]), Float.parseFloat(toSpeak[2]), toSpeak[3], toSpeak[4]);
    }

    /** JSON: [{"name":"...","lang":"en-US"}], tayyor bo'lmasa bo'sh qator. */
    @JavascriptInterface
    public String getVoices() {
        return initDone ? voicesJson() : "";
    }

    @JavascriptInterface
    public void speak(String text, float rate, float pitch, String lang, String id) {
        if (text == null || text.trim().isEmpty()) return;
        synchronized (lock) {
            if (!initDone) {
                pending = new String[]{text, String.valueOf(rate), String.valueOf(pitch), lang, id};
                return;
            }
        }
        if (!engineOk) {
            if (!warnedNoEngine) {
                warnedNoEngine = true;
                toast(R.string.tts_unavailable);
            }
            emit(id, "error");
            return;
        }
        Locale loc = pickLocale(lang);
        if (loc == null) {
            if (!warnedNoEnglish) {
                warnedNoEnglish = true;
                toast(R.string.tts_no_english);
                activity.runOnUiThread(() -> {
                    try {
                        Intent i = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(i);
                    } catch (ActivityNotFoundException ignored) {
                    }
                });
            }
            emit(id, "error");
            return;
        }
        tts.setLanguage(loc);
        tts.setSpeechRate(clamp(rate, 0.1f, 4f));
        tts.setPitch(clamp(pitch, 0.1f, 4f));
        Bundle params = new Bundle();
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, sanitizeId(id));
    }

    @JavascriptInterface
    public void stop() {
        synchronized (lock) {
            pending = null;
        }
        if (engineOk) tts.stop();
    }

    void shutdown() {
        try {
            tts.stop();
            tts.shutdown();
        } catch (RuntimeException ignored) {
        }
    }

    private Locale pickLocale(String lang) {
        if (englishLocales.isEmpty()) return null;
        if (lang != null) {
            String want = lang.replace('_', '-');
            for (Locale l : englishLocales) {
                if (l.toLanguageTag().equalsIgnoreCase(want)) return l;
            }
        }
        return englishLocales.get(0);
    }

    private String voicesJson() {
        JSONArray arr = new JSONArray();
        for (Locale l : englishLocales) {
            try {
                JSONObject o = new JSONObject();
                o.put("name", "Android " + l.getDisplayName(Locale.ENGLISH));
                o.put("lang", l.toLanguageTag());
                arr.put(o);
            } catch (org.json.JSONException ignored) {
            }
        }
        return arr.toString();
    }

    private void emit(String id, String type) {
        final String safe = sanitizeId(id);
        if (safe.isEmpty()) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.__bilimgoTts && window.__bilimgoTts.event('" + safe + "','" + type + "')", null));
    }

    private void toast(int res) {
        activity.runOnUiThread(() -> Toast.makeText(activity, res, Toast.LENGTH_LONG).show());
    }

    private static String sanitizeId(String id) {
        return id == null ? "" : id.replaceAll("[^0-9A-Za-z_-]", "");
    }

    private static float clamp(float v, float lo, float hi) {
        if (Float.isNaN(v)) return 1f;
        return Math.max(lo, Math.min(hi, v));
    }
}
