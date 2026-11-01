module.exports = {
  expo: {
    name: "DeepTutor 移动版", slug: "deeptutor-mobile", version: "0.1.0",
    orientation: "default", userInterfaceStyle: "light", scheme: "deeptutor-mobile",
    ios: { supportsTablet: true, bundleIdentifier: "org.deeptutormobile.client",
      infoPlist: { CFBundleDevelopmentRegion: "zh_CN", CFBundleLocalizations: ["zh_CN"],
        NSLocalNetworkUsageDescription: "连接你自己的电脑上的 DeepTutor 学习服务。",
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } },
    android: { package: "org.deeptutormobile.client", predictiveBackGestureEnabled: false },
    plugins: ["expo-router", "expo-secure-store", "expo-font",
      ["expo-image-picker", { photosPermission: "选择题目照片用于学习与讲解。", cameraPermission: "拍摄题目，用于识别与讲解。", microphonePermission: false }],
      "./plugins/with-network.cjs"]
  }
};
