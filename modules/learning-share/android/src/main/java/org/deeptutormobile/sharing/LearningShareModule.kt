package org.deeptutormobile.sharing

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LearningShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LearningShare")
    AsyncFunction("listAsync") { ShareInbox.list(requireNotNull(appContext.reactContext)) }
    AsyncFunction("removeAsync") { id: String -> ShareInbox.remove(requireNotNull(appContext.reactContext), id) }
    AsyncFunction("clearAsync") { ShareInbox.clear(requireNotNull(appContext.reactContext)) }
  }
}
