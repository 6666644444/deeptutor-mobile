const {
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
const plist = require("@expo/plist");

const TARGET = "LearningShareExtension";
module.exports = function withLearningShare(config) {
  const bundle = config.ios.bundleIdentifier;
  const group = `group.${bundle}.learning-share`;
  config = withEntitlementsPlist(config, (c) => {
    c.modResults["com.apple.security.application-groups"] = [
      ...new Set([
        ...(c.modResults["com.apple.security.application-groups"] || []),
        group,
      ]),
    ];
    return c;
  });
  config = withInfoPlist(config, (c) => {
    c.modResults.LearningShareAppGroup = group;
    return c;
  });
  config = withDangerousMod(config, [
    "ios",
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, TARGET);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(
        path.join(__dirname, "share-extension", "ShareViewController.swift"),
        path.join(dir, "ShareViewController.swift"),
      );
      fs.writeFileSync(
        path.join(dir, "Info.plist"),
        plist.default.build({
          CFBundleDisplayName: "DeepTutor 学习",
          CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
          CFBundleExecutable: "$(EXECUTABLE_NAME)",
          CFBundleName: "$(PRODUCT_NAME)",
          CFBundlePackageType: "XPC!",
          CFBundleShortVersionString: config.version || "0.4.0",
          CFBundleVersion: config.ios.buildNumber || "1",
          LearningShareAppGroup: group,
          NSExtension: {
            NSExtensionPointIdentifier: "com.apple.share-services",
            NSExtensionPrincipalClass:
              "$(PRODUCT_MODULE_NAME).ShareViewController",
            NSExtensionAttributes: {
              NSExtensionActivationRule: {
                NSExtensionActivationSupportsFileWithMaxCount: 5,
              },
            },
          },
        }),
      );
      fs.writeFileSync(
        path.join(dir, "Share.entitlements"),
        plist.default.build({
          "com.apple.security.application-groups": [group],
        }),
      );
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    const project = c.modResults;
    const nativeTargets = project.pbxNativeTargetSection();
    let entry = Object.entries(nativeTargets).find(
      ([key, value]) =>
        !key.endsWith("_comment") && value.name?.replaceAll('"', "") === TARGET,
    );
    let uuid;
    if (entry) uuid = entry[0];
    else {
      const target = project.addTarget(
        TARGET,
        "app_extension",
        TARGET,
        `${bundle}.ShareExtension`,
      );
      uuid = target.uuid;
      const groupRef = project.addPbxGroup(
        ["ShareViewController.swift", "Info.plist", "Share.entitlements"],
        TARGET,
        TARGET,
      );
      project.addToPbxGroup(
        groupRef.uuid,
        project.getFirstProject().firstProject.mainGroup,
      );
      project.addBuildPhase(
        [`${TARGET}/ShareViewController.swift`],
        "PBXSourcesBuildPhase",
        "Sources",
        uuid,
      );
      project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", uuid);
      project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", uuid);
    }
    const target = project.pbxNativeTargetSection()[uuid];
    const configs =
      project.pbxXCConfigurationList()[target.buildConfigurationList]
        .buildConfigurations;
    for (const item of configs) {
      Object.assign(
        project.pbxXCBuildConfigurationSection()[item.value].buildSettings,
        {
          INFOPLIST_FILE: `${TARGET}/Info.plist`,
          CODE_SIGN_ENTITLEMENTS: `${TARGET}/Share.entitlements`,
          PRODUCT_BUNDLE_IDENTIFIER: `${bundle}.ShareExtension`,
          SWIFT_VERSION: "5.9",
          IPHONEOS_DEPLOYMENT_TARGET: "16.4",
          TARGETED_DEVICE_FAMILY: '"1,2"',
          APPLICATION_EXTENSION_API_ONLY: "YES",
          GENERATE_INFOPLIST_FILE: "NO",
          CODE_SIGN_STYLE: "Automatic",
          CURRENT_PROJECT_VERSION: config.ios.buildNumber || "1",
          MARKETING_VERSION: config.version || "0.4.0",
        },
      );
    }
    return c;
  });
  return config;
};
