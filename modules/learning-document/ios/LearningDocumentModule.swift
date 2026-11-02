import ExpoModulesCore
import PDFKit

public class LearningDocumentModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LearningDocument")
    View(LearningDocumentView.self) {
      Events("onDocumentState")
      Prop("uri") { (view: LearningDocumentView, value: String) in view.load(value) }
      Prop("page") { (view: LearningDocumentView, value: Int) in view.page=value;view.navigate() }
    }
  }
}
class LearningDocumentView: ExpoView {
  let reader=PDFView();let onDocumentState=EventDispatcher();var page=1;var source=""
  required init(appContext:AppContext?){super.init(appContext:appContext);reader.autoScales=true;reader.displayMode = .singlePage;addSubview(reader)}
  override func layoutSubviews(){super.layoutSubviews();reader.frame=bounds}
  func load(_ value:String){
    guard value != source,let url=URL(string:value),url.isFileURL else{return}
    guard let cache=FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask).first,
      url.standardizedFileURL.path.hasPrefix(cache.path+"/") else{return}
    source=value;reader.document=PDFDocument(url:url);navigate()
    onDocumentState(["pages":reader.document?.pageCount ?? 0,"error":reader.document == nil ? "文档无法显示，请重新加载。":""])
  }
  func navigate(){if let target=reader.document?.page(at:max(0,page-1)){reader.go(to:target)}}
}
