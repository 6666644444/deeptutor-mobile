import ExpoModulesCore
import Network
import Foundation

public class LearningUpdatesModule: Module {
  private let queue = DispatchQueue(label: "DTMUpdateAdapter")
  private var listener: NWListener?
  private var payload: (String, String)?

  public func definition() -> ModuleDefinition {
    Name("LearningUpdates")
    AsyncFunction("prepare") { (manifest: String?, signature: String?, promise: Promise) in
      self.queue.async {
        if let manifest = manifest {
          guard manifest.utf8.count <= 2_000_000, let signature = signature,
            signature.range(of: "^[A-Za-z0-9+/=]{128,1024}$", options: .regularExpression) != nil else {
            promise.reject("INVALID_UPDATE", "Invalid update envelope"); return
          }
          self.payload = (manifest, signature)
        } else { self.payload = nil }
        if self.listener != nil { promise.resolve(true); return }
        do {
          let parameters = NWParameters.tcp
          parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 35197)
          let listener = try NWListener(using: parameters)
          self.listener = listener
          var resolved = false
          listener.stateUpdateHandler = { state in
            if case .ready = state, !resolved { resolved = true; promise.resolve(true) }
            if case .failed = state {
              self.listener = nil
              if !resolved { resolved = true; promise.reject("UPDATE_ADAPTER", "Unable to start update adapter") }
              listener.cancel()
            }
          }
          listener.newConnectionHandler = { connection in
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
            self.queue.asyncAfter(deadline: .now() + 5) { connection.cancel() }
          }
          listener.start(queue: self.queue)
        } catch { self.listener = nil; promise.reject("UPDATE_ADAPTER", "Unable to start update adapter") }
      }
    }
    OnDestroy { self.queue.async { self.listener?.cancel(); self.listener = nil; self.payload = nil } }
  }

  private func receive(_ connection: NWConnection, buffer: Data) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { data, _, complete, error in
      var next = buffer
      if let data = data { next.append(data) }
      guard next.count <= 8192, error == nil else { connection.cancel(); return }
      let request = String(decoding: next, as: UTF8.self)
      if !request.contains("\r\n\r\n") {
        if complete { connection.cancel() } else { self.receive(connection, buffer: next) }
        return
      }
      guard request.hasPrefix("GET /manifest HTTP/"), request.lowercased().contains("\r\nx-dtm-local-adapter: 1\r\n") else { connection.cancel(); return }
      let current = self.payload
      let body = current.map { Data($0.0.utf8) } ?? Data()
      var headers = current == nil ? "HTTP/1.1 204 No Content\r\n" : "HTTP/1.1 200 OK\r\n"
      headers += "expo-protocol-version: 1\r\nexpo-sfv-version: 0\r\nCache-Control: no-store\r\nConnection: close\r\n"
      if let current = current { headers += "Content-Type: application/expo+json\r\nexpo-signature: sig=\"\(current.1)\", keyid=\"main\", alg=\"rsa-v1_5-sha256\"\r\n" }
      headers += "Content-Length: \(body.count)\r\n\r\n"
      var response = Data(headers.utf8); response.append(body)
      connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
  }
}
