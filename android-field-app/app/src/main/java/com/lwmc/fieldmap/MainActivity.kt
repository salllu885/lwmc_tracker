package com.lwmc.fieldmap

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val locationPermissionCode = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.setGeolocationEnabled(true)
        webView.settings.allowFileAccess = true

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                // Runtime permission was already requested at startup; if granted, trust
                // every origin -- this WebView only ever loads our own bundled asset page.
                val granted = ActivityCompat.checkSelfPermission(
                    this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                callback?.invoke(origin, granted, false)
            }
        }

        webView.addJavascriptInterface(ExportBridge(), "AndroidBridge")

        requestLocationPermissionIfNeeded()
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun requestLocationPermissionIfNeeded() {
        val fine = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        if (fine != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                locationPermissionCode
            )
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    /** JS bridge: window.AndroidBridge.shareGeoJSON(filename, jsonText) */
    inner class ExportBridge {
        @JavascriptInterface
        fun shareGeoJSON(filename: String, jsonText: String) {
            runOnUiThread {
                try {
                    val dir = File(cacheDir, "exports").apply { mkdirs() }
                    val safeName = filename.replace(Regex("[^A-Za-z0-9_.-]"), "_")
                    val file = File(dir, safeName)
                    FileOutputStream(file).use { it.write(jsonText.toByteArray()) }

                    val uri = FileProvider.getUriForFile(
                        this@MainActivity, "com.lwmc.fieldmap.fileprovider", file
                    )
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "application/geo+json"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_SUBJECT, safeName)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(Intent.createChooser(intent, "Share boundary data"))
                } catch (e: Exception) {
                    webView.evaluateJavascript(
                        "window.onShareError && window.onShareError(${escapeJs(e.message ?: "unknown error")})",
                        null
                    )
                }
            }
        }

        private fun escapeJs(s: String): String =
            "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    }
}
