import ExpoModulesCore
import Foundation

public class LearningShareModule: Module {
  private func root() throws -> URL {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "LearningShareAppGroup") as? String,
          let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw NSError(domain: "LearningShare", code: 1, userInfo: [NSLocalizedDescriptionKey: "分享接收空间未配置"])
    }
    let url = container.appendingPathComponent("learning-share", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }
  public func definition() -> ModuleDefinition {
    Name("LearningShare")
    AsyncFunction("listAsync") { () -> String in
      let root = try self.root()
      let records = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        .compactMap { url -> [String: Any]? in
          guard let data = try? Data(contentsOf: url.appendingPathComponent("batch.json")),
                var batch = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let files = batch["files"] as? [[String: Any]] else { return nil }
          // Container URLs can change after reinstall/restore. Resolve stored relative names here.
          batch["files"] = files.map { item -> [String: Any] in
            var item = item
            if let local = item["localName"] as? String, !local.contains("/"), !local.contains("..") {
              item["uri"] = url.appendingPathComponent(local).absoluteString
            }
            return item
          }
          return batch
        }
      return String(data: try JSONSerialization.data(withJSONObject: records), encoding: .utf8) ?? "[]"
    }
    AsyncFunction("removeAsync") { (id: String) in
      guard UUID(uuidString: id) != nil else { return }
      try? FileManager.default.removeItem(at: try self.root().appendingPathComponent(id))
    }
    AsyncFunction("clearAsync") {
      let root = try self.root()
      for url in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) {
        try? FileManager.default.removeItem(at: url)
      }
    }
  }
}
