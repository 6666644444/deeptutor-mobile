// Only JS-visible release metadata is excluded. Dependencies, plugins, native
// modules, signing certificate, endpoint and native build configuration remain.
module.exports = {
  sourceSkips: ["PackageJsonAndroidAndIosScriptsIfNotContainRun", "ExpoConfigExtraSection"],
};
