plugins {
    id("com.android.application")
}

// Web manbasi: ../web/bilimgo.html — ilovaga yig'ishda avtomatik moslashtiriladi
// (Google Fonts o'rniga lokal shrift, Android ko'prigi skripti qo'shiladi).
val webSrc = rootProject.layout.projectDirectory.dir("web")
val webOut = layout.buildDirectory.dir("generated/webassets")

val prepareWebAssets by tasks.registering(Copy::class) {
    description = "web/ papkasidan ilova assets/www ni tayyorlaydi"
    into(webOut.map { it.dir("www") })
    from(webSrc) {
        include("android-bridge.js", "fonts/**")
    }
    from(webSrc.file("bilimgo.html")) {
        rename { "index.html" }
        filteringCharset = "UTF-8"
        filter { line: String ->
            when {
                line.contains("fonts.googleapis.com/css2") ->
                    "<link rel=\"stylesheet\" href=\"fonts/nunito.css\">\n<script src=\"android-bridge.js\"></script>"
                line.contains("rel=\"preconnect\"") && line.contains("fonts.googleapis.com") -> ""
                else -> line
            }
        }
    }
    doLast {
        val html = webOut.get().file("www/index.html").asFile.readText()
        check(html.contains("android-bridge.js")) { "index.html ga android-bridge.js qo'shilmadi — bilimgo.html dagi shrift qatorini tekshiring" }
        check(!html.contains("fonts.googleapis.com")) { "index.html da hali ham Google Fonts havolasi bor" }
    }
}

android {
    namespace = "uz.bilimgo.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "uz.bilimgo.app"
        minSdk = 24
        targetSdk = 35
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "1.0.0"
    }

    signingConfigs {
        create("release") {
            val ks = System.getenv("KEYSTORE_FILE")
            if (!ks.isNullOrBlank() && file(ks).exists()) {
                storeFile = file(ks)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            val rel = signingConfigs.getByName("release")
            // Kalit berilmagan bo'lsa ham o'rnatiladigan APK chiqsin (debug kalit bilan).
            signingConfig = if (rel.storeFile != null) rel else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(webOut)
    lint {
        abortOnError = false
    }
}

tasks.named("preBuild") { dependsOn(prepareWebAssets) }

dependencies {
    // androidx kutubxonalari turli kotlin-stdlib-jdk7/jdk8 versiyalarini olib keladi — bitta versiyaga tekislaymiz
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.8.22"))
    implementation("androidx.activity:activity:1.9.3")
    implementation("androidx.core:core:1.13.1")
    implementation("androidx.webkit:webkit:1.12.1")
}
