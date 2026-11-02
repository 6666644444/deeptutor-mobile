Pod::Spec.new do |s|
  s.name = 'LearningShare'
  s.version = '0.1.0'
  s.summary = 'Local learning document inbox'
  s.description = 'Receives documents into a local inbox before account confirmation.'
  s.license = { :type => 'Apache-2.0' }
  s.author = 'DeepTutor Mobile contributors'
  s.homepage = 'https://github.com/TinyPandaGame/deeptutor-mobile'
  s.source = { :git => '' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
end
