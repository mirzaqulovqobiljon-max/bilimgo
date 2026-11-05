# JS <-> Android ko'prigi: metodlar nomi saqlanishi shart
-keepclassmembers class uz.bilimgo.app.TtsBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
