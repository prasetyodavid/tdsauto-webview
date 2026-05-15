package com.tetradigit.app

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream

class MainActivity : FlutterActivity() {

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            CHANNEL,
        ).setMethodCallHandler { call, result ->
            if (call.method != "saveToDownloads") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            val displayName = call.argument<String>("displayName")
            val bytes = call.argument<ByteArray>("bytes")
            if (displayName.isNullOrBlank() || bytes == null) {
                result.success(
                    mapOf("ok" to false, "error" to "Missing displayName or bytes"),
                )
                return@setMethodCallHandler
            }
            try {
                val pathOrUri = saveBytesToDownloads(displayName, bytes)
                result.success(mapOf("ok" to true, "path" to pathOrUri))
            } catch (e: SecurityException) {
                result.success(
                    mapOf("ok" to false, "error" to "storage_permission_required"),
                )
            } catch (e: Exception) {
                result.success(
                    mapOf("ok" to false, "error" to (e.message ?: e.toString())),
                )
            }
        }
    }

    /**
     * API 29+: [MediaStore.Downloads] with [IS_PENDING] — no broad storage permission.
     * Older APIs: public Downloads dir with [WRITE_EXTERNAL_STORAGE] when granted.
     */
    private fun saveBytesToDownloads(displayName: String, bytes: ByteArray): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = contentResolver
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                put(MediaStore.MediaColumns.MIME_TYPE, "text/csv")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
            val itemUri =
                resolver.insert(collection, values)
                    ?: throw IllegalStateException("MediaStore insert returned null")
            resolver.openOutputStream(itemUri)?.use { out -> out.write(bytes) }
                ?: throw IllegalStateException("Could not open output stream")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(itemUri, values, null, null)
            return itemUri.toString()
        }

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            throw SecurityException("storage_permission_required")
        }

        val dir =
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!dir.exists() && !dir.mkdirs()) {
            throw IllegalStateException("Could not create Downloads directory")
        }
        val file = File(dir, displayName)
        FileOutputStream(file).use { it.write(bytes) }
        return file.absolutePath
    }

    companion object {
        private const val CHANNEL = "com.wlacalculator.app/downloads"
    }
}
