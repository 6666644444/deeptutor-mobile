package org.deeptutormobile.updates

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import kotlin.concurrent.thread

/** Read-only, loopback-only protocol adapter. Expo verifies the signed bytes;
 * this bridge cannot install code or access any learning-service credentials. */
class LearningUpdatesModule : Module() {
  private data class Payload(val manifest: String, val signature: String)
  @Volatile private var payload: Payload? = null
  @Volatile private var server: ServerSocket? = null
  override fun definition() = ModuleDefinition {
    Name("LearningUpdates")
    AsyncFunction("prepare") { manifest: String?, signature: String? ->
      require((manifest == null && signature == null) ||
        (manifest != null && manifest.length <= 2_000_000 && signature != null && signature.matches(Regex("[A-Za-z0-9+/=]{128,1024}"))))
      synchronized(this@LearningUpdatesModule) {
        payload = manifest?.let { Payload(it, signature!!) }
        if (server == null) {
          val listener = ServerSocket(35197, 4, InetAddress.getByName("127.0.0.1"))
          server = listener
          thread(name = "DTMUpdateAdapter", isDaemon = true) {
            while (!listener.isClosed) {
              try { val client = listener.accept(); thread(isDaemon = true) { respond(client) } }
              catch (_: Exception) { if (listener.isClosed) break }
            }
          }
        }
      }
      true
    }
    OnDestroy { synchronized(this@LearningUpdatesModule) { server?.close(); server = null; payload = null } }
  }
  private fun respond(socket: Socket) {
    socket.use {
      try {
        socket.soTimeout = 3000
        val input = socket.getInputStream()
        val request = StringBuilder()
        while (request.length < 8192 && !request.endsWith("\r\n\r\n")) {
          val byte = input.read(); if (byte < 0) return
          request.append(byte.toChar())
        }
        if (!request.startsWith("GET /manifest HTTP/") || !request.toString().lowercase().contains("\r\nx-dtm-local-adapter: 1\r\n")) return
        val current = payload
        val body = current?.manifest?.toByteArray(Charsets.UTF_8) ?: byteArrayOf()
        val headers = buildString {
          append(if (current == null) "HTTP/1.1 204 No Content\r\n" else "HTTP/1.1 200 OK\r\n")
          append("expo-protocol-version: 1\r\nexpo-sfv-version: 0\r\nCache-Control: no-store\r\nConnection: close\r\n")
          if (current != null) append("Content-Type: application/expo+json\r\nexpo-signature: sig=\"${current.signature}\", keyid=\"main\", alg=\"rsa-v1_5-sha256\"\r\n")
          append("Content-Length: ${body.size}\r\n\r\n")
        }
        socket.getOutputStream().apply { write(headers.toByteArray(Charsets.US_ASCII)); write(body); flush() }
      } catch (_: Exception) { /* A failed local exchange leaves the installed version usable. */ }
    }
  }
}
