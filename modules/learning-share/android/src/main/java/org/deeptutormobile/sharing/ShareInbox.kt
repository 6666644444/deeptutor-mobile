package org.deeptutormobile.sharing

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal object ShareInbox {
  private const val MAX_FILE = 25L * 1024 * 1024
  private const val MAX_FILES = 5
  private val types = mapOf("pdf" to "application/pdf", "docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "txt" to "text/plain")
  private fun root(context: Context) = File(context.filesDir, "learning-share").apply { mkdirs() }

  @Synchronized fun receive(context: Context, intent: Intent, cancelled: () -> Boolean = { false }) {
    val root = root(context)
    // Keep a bounded inbox. Never replace a newer batch while an older one is being confirmed.
    root.listFiles()?.filter { it.isDirectory && System.currentTimeMillis() - it.lastModified() > 7L * 86400000 }?.forEach { it.deleteRecursively() }
    if ((root.listFiles()?.count { it.isDirectory } ?: 0) >= 10) throw IllegalStateException("待接收资料较多，请先在 DeepTutor 处理已有文件。")
    val id = UUID.randomUUID().toString()
    val dir = File(root, id).apply { mkdirs() }
    val files = JSONArray()
    val errors = JSONArray()
    val uris = mutableListOf<Uri>()
    @Suppress("DEPRECATION")
    when (intent.action) {
      Intent.ACTION_SEND -> intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.add(it) }
      Intent.ACTION_SEND_MULTIPLE -> intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.addAll(it) }
      Intent.ACTION_VIEW -> intent.data?.let { uris.add(it) }
    }
    if (uris.isEmpty()) intent.clipData?.let { clip ->
      for (i in 0 until minOf(clip.itemCount, MAX_FILES + 1)) clip.getItemAt(i).uri?.let { uris.add(it) }
    }
    if (uris.isEmpty()) errors.put("收到的是文字或链接。请在来源 App 下载或导出文件后，再分享文件。")
    if (uris.distinct().size > MAX_FILES) errors.put("一次最多接收 5 个文件，请将剩余文件分批分享。")
    var batchBytes = 0L
    for ((index, uri) in uris.distinct().take(MAX_FILES).withIndex()) {
      if (cancelled()) break
      var name = "文件 ${index + 1}"
      var destination: File? = null
      try {
        require(uri.scheme == "content") { "请选择由来源 App 分享的文件，不支持这个地址。" }
        var reportedSize: Long? = null
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) {
            val n = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (n >= 0 && !cursor.isNull(n)) name = cursor.getString(n)
            val s = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (s >= 0 && !cursor.isNull(s)) reportedSize = cursor.getLong(s)
          }
        }
        name = name.substringAfterLast('/').substringAfterLast('\\').replace(Regex("[\\p{Cntrl}]"), "_").take(180)
        val extension = name.substringAfterLast('.', "").lowercase()
        val mime = types[extension] ?: throw IllegalArgumentException("暂支持 PDF、DOCX、TXT 文件。")
        require((reportedSize ?: 0) <= MAX_FILE) { "文件超过 25 MB。" }
        val target = File(dir, "$index.$extension")
        destination = target
        var count = 0L
        val stream = context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("无法读取文件，请先在来源 App 下载完整文件。")
        stream.use { input -> target.outputStream().use { output ->
          val buffer = ByteArray(65536)
          while (true) {
            check(!cancelled()) { "已取消接收。" }
            val n = input.read(buffer)
            if (n < 0) break
            count += n
            require(count <= MAX_FILE && batchBytes + count <= 100L * 1024 * 1024) { "文件过大，单个限 25 MB，每批限 100 MB。" }
            output.write(buffer, 0, n)
          }
        } }
        require(count > 0) { "文件是空的。" }
        batchBytes += count
        files.put(JSONObject().put("name", name).put("uri", Uri.fromFile(destination).toString()).put("size", count).put("type", mime))
      } catch (e: Exception) {
        destination?.delete()
        errors.put("$name：${if (e is IllegalArgumentException || e is IllegalStateException) e.message else "暂时无法读取，请在来源 App 下载后重新分享。"}")
      }
    }
    if (cancelled()) { dir.deleteRecursively(); return }
    val value = JSONObject().put("id", id).put("createdAt", System.currentTimeMillis()).put("files", files).put("errors", errors)
    val temp = File(dir, "pending.tmp")
    temp.writeText(value.toString())
    check(temp.renameTo(File(dir, "batch.json"))) { "接收记录未能保存，请重新分享。" }
  }

  @Synchronized fun list(context: Context): String {
    val result = JSONArray()
    root(context).listFiles()?.sortedBy { it.name }?.forEach { dir ->
      val record = File(dir, "batch.json")
      if (record.isFile) try { result.put(JSONObject(record.readText())) } catch (_: Exception) { }
    }
    return result.toString()
  }
  @Synchronized fun remove(context: Context, id: String) {
    require(Regex("^[a-fA-F0-9-]{36}$").matches(id))
    File(root(context), id).deleteRecursively()
  }
  @Synchronized fun clear(context: Context) { root(context).listFiles()?.forEach { it.deleteRecursively() } }
}
