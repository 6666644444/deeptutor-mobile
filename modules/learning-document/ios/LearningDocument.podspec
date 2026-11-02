Pod::Spec.new do |s|
  s.name='LearningDocument';s.version='0.1.0';s.summary='Native learning document reader'
  s.description='Renders local learning documents with PDFKit.';s.license={:type=>'Apache-2.0'};s.author='DeepTutor Mobile contributors'
  s.homepage='https://github.com/TinyPandaGame/deeptutor-mobile';s.source={:git=>''};s.platforms={:ios=>'16.4'};s.swift_version='5.9'
  s.static_framework=true;s.dependency 'ExpoModulesCore';s.source_files='*.swift';s.frameworks='PDFKit'
end
