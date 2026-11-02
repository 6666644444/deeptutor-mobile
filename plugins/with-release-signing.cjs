const { withAppBuildGradle } = require("expo/config-plugins");

// Values are loaded only by Gradle. No signing material is written into the
// generated project, Expo config, JavaScript bundle, or exported iOS project.
const block = `
// BEGIN DTM RELEASE SIGNING
// C++ assertions may embed __FILE__ even after symbol stripping. Keep public
// binaries independent of the developer's local checkout and home directory.
android.defaultConfig.externalNativeBuild.cmake.cppFlags.addAll([
    "-ffile-prefix-map=" + rootDir.parentFile.absolutePath + "=/src",
    "-ffile-prefix-map=" + System.getProperty("user.home") + "=/build-home"
])
def dtmSigningFile = System.getenv("DTM_SIGNING_PROPERTIES")
def dtmReleaseRequested = gradle.startParameter.taskNames.any { it.toLowerCase().contains("release") }
if (dtmSigningFile) {
    def dtmSigning = new Properties()
    new File(dtmSigningFile).withInputStream { dtmSigning.load(it) }
    ["storeFile", "storePassword", "keyAlias", "keyPassword"].each { name ->
        if (!dtmSigning.getProperty(name)) throw new GradleException("Missing release signing property: " + name)
    }
    android.signingConfigs.create("dtmRelease") {
        storeFile file(dtmSigning.getProperty("storeFile"))
        storePassword dtmSigning.getProperty("storePassword")
        keyAlias dtmSigning.getProperty("keyAlias")
        keyPassword dtmSigning.getProperty("keyPassword")
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.dtmRelease
} else if (dtmReleaseRequested) {
    throw new GradleException("Release requires DTM_SIGNING_PROPERTIES; debug signing is never published.")
}
// END DTM RELEASE SIGNING
`;
module.exports = config => withAppBuildGradle(config, result => {
  if (result.modResults.language !== "groovy") throw Error("Release signing expects the Expo Groovy template.");
  result.modResults.contents = result.modResults.contents.replace(/\n\/\/ BEGIN DTM RELEASE SIGNING[\s\S]*?\/\/ END DTM RELEASE SIGNING\n?/g, "") + block;
  return result;
});
