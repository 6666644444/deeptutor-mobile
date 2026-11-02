Pod::Spec.new do |s|
  s.name='LearningUpdates';s.version='0.1.0';s.summary='Local signed-update protocol adapter'
  s.description='Adapts signed GitHub release metadata to the Expo Updates protocol on loopback.'
  s.license={:type=>'Apache-2.0'};s.author='DeepTutor Mobile contributors'
  s.homepage='https://github.com/TinyPandaGame/deeptutor-mobile';s.source={:git=>''};s.platforms={:ios=>'16.4'};s.swift_version='5.9'
  s.static_framework=true;s.dependency 'ExpoModulesCore';s.source_files='*.swift';s.frameworks='Network'
end
