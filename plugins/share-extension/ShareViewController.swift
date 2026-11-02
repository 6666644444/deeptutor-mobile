import UIKit
import UniformTypeIdentifiers

// The extension only stages files in the App Group. It never receives login credentials
// or contacts a server. Account confirmation and upload happen in the learning app.
final class ShareViewController: UIViewController {
  private let status = UILabel()
  private let done = UIButton(type: .system)
  private var batchDirectory: URL?
  private var committed = false
  private var cancelled = false
  private let batchID = UUID().uuidString
  private var files: [[String: Any]] = []
  private var errors: [String] = []
  private var totalBytes = 0

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    let title = UILabel()
    title.text = "接收学习资料"
    title.font = .preferredFont(forTextStyle: .title2)
    status.numberOfLines = 0
    status.font = .preferredFont(forTextStyle: .body)
    status.text = "正在读取文件…"
    done.setTitle("保存到待确认列表", for: .normal)
    done.isEnabled = false
    done.addTarget(self, action: #selector(save), for: .touchUpInside)
    let cancel = UIButton(type: .system)
    cancel.setTitle("取消", for: .normal)
    cancel.addTarget(self, action: #selector(close), for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [title, status, done, cancel])
    stack.axis = .vertical
    stack.spacing = 20
    stack.translatesAutoresizingMaskIntoConstraints = false
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scroll)
    scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      scroll.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
      scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scroll.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor, constant: -24),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 24),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -48)
    ])
    Task { @MainActor in await receive() }
  }

  private func receive() async {
    do {
      guard let group = Bundle.main.object(forInfoDictionaryKey: "LearningShareAppGroup") as? String,
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
        throw failure("接收空间尚未配置，请联系家长更新应用。")
      }
      let root = container.appendingPathComponent("learning-share", isDirectory: true)
      try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
      for directory in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.contentModificationDateKey]) {
        if let modified = try? directory.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate,
           Date().timeIntervalSince(modified) > 7 * 86400 { try? FileManager.default.removeItem(at: directory) }
      }
      guard try FileManager.default.contentsOfDirectory(atPath: root.path).count < 10 else {
        throw failure("待接收资料较多，请先打开 DeepTutor 处理已有文件。")
      }
      let directory = root.appendingPathComponent(batchID, isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      batchDirectory = directory
      let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
      if providers.count > 5 { errors.append("一次最多接收 5 个文件，请将其余文件分批分享。") }
      for (index, provider) in providers.prefix(5).enumerated() {
        if cancelled { break }
        do {
          let item = try await copy(provider: provider, index: index, directory: directory)
          guard let size = item["size"] as? Int, totalBytes + size <= 100 * 1024 * 1024 else {
            if let name = item["localName"] as? String { try? FileManager.default.removeItem(at: directory.appendingPathComponent(name)) }
            throw failure("一批资料最多 100 MB，请分批分享。")
          }
          totalBytes += size
          files.append(item)
        } catch { errors.append(error.localizedDescription) }
      }
      if cancelled { try? FileManager.default.removeItem(at: directory); return }
      if files.isEmpty && errors.isEmpty { errors.append("没有收到文件。请在来源 App 下载或导出 PDF、DOCX、TXT 后分享。") }
      status.text = (files.compactMap { $0["name"] as? String } + errors + ["\n文件暂存在本机。请随后打开 DeepTutor，核对当前账号并确认保存。此处不会上传。"]).joined(separator: "\n")
      done.isEnabled = !files.isEmpty
    } catch { status.text = error.localizedDescription }
  }

  private func copy(provider: NSItemProvider, index: Int, directory: URL) async throws -> [String: Any] {
    let preferred = ["com.adobe.pdf", "org.openxmlformats.wordprocessingml.document", "public.plain-text", "public.file-url", "public.data"]
    guard let type = preferred.first(where: { provider.hasItemConformingToTypeIdentifier($0) }) else {
      throw failure("暂支持 PDF、DOCX、TXT 文件；云文档链接需要先下载或导出。")
    }
    let suggestedName = provider.suggestedName
    return try await withCheckedThrowingContinuation { continuation in
      let handle: @Sendable (URL?, Error?) -> Void = { source, error in
        guard let source = source, source.isFileURL else {
          continuation.resume(throwing: self.failure("无法读取文件，请先在来源 App 下载完整文件。")); return
        }
        let scoped = source.startAccessingSecurityScopedResource()
        defer { if scoped { source.stopAccessingSecurityScopedResource() } }
        var target: URL?
        do {
          var name = (suggestedName ?? source.lastPathComponent).components(separatedBy: "/").last ?? "资料"
          if (name as NSString).pathExtension.isEmpty { name = source.lastPathComponent }
          name = String(String.UnicodeScalarView(name.unicodeScalars.filter { !CharacterSet.controlCharacters.contains($0) })).replacingOccurrences(of: "\\", with: "_")
          name = String(name.prefix(180))
          let ext = (name as NSString).pathExtension.lowercased()
          let mime = ["pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "txt": "text/plain"]
          guard let type = mime[ext] else { throw self.failure("\(name)：暂支持 PDF、DOCX、TXT 文件。") }
          let local = "\(index).\(ext)"
          let destination = directory.appendingPathComponent(local)
          target = destination
          FileManager.default.createFile(atPath: destination.path, contents: nil, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
          let input = try FileHandle(forReadingFrom: source)
          let output = try FileHandle(forWritingTo: destination)
          defer { try? input.close(); try? output.close() }
          var count = 0
          while let data = try input.read(upToCount: 65536), !data.isEmpty {
            count += data.count
            guard count <= 25 * 1024 * 1024 else { throw self.failure("\(name)：文件超过 25 MB。") }
            try output.write(contentsOf: data)
          }
          guard count > 0 else { throw self.failure("\(name)：文件是空的。") }
          continuation.resume(returning: ["name": name, "localName": local, "size": count, "type": type])
        } catch {
          if let target { try? FileManager.default.removeItem(at: target) }
          continuation.resume(throwing: error)
        }
      }
      if type == "public.file-url" {
        provider.loadItem(forTypeIdentifier: type, options: nil) { value, error in handle(value as? URL, error) }
      } else {
        provider.loadFileRepresentation(forTypeIdentifier: type, completionHandler: handle)
      }
    }
  }
  nonisolated private func failure(_ message: String) -> NSError {
    NSError(domain: "LearningShare", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
  @objc private func save() {
    guard let directory = batchDirectory, !files.isEmpty else { return }
    do {
      let data = try JSONSerialization.data(withJSONObject: ["id": batchID, "createdAt": Date().timeIntervalSince1970 * 1000, "files": files, "errors": errors])
      try data.write(to: directory.appendingPathComponent("batch.json"), options: .atomic)
      committed = true
      status.text = "已接收。\n请打开 DeepTutor，在待接收资料中核对账号并确认保存。"
      done.isEnabled = false
      let alert = UIAlertController(title: "已接收资料", message: "现在可以打开 DeepTutor 确认保存到当前学习账号。", preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "完成", style: .default) { _ in self.extensionContext?.completeRequest(returningItems: nil) })
      present(alert, animated: true)
    } catch { status.text = "暂未保存，请重新分享。" }
  }
  @objc private func close() {
    cancelled = true
    if !committed, let directory = batchDirectory { try? FileManager.default.removeItem(at: directory) }
    extensionContext?.completeRequest(returningItems: nil)
  }
}
