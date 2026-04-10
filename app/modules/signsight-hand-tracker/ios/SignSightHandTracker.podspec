Pod::Spec.new do |s|
  s.name           = 'SignSightHandTracker'
  s.version        = '1.0.0'
  s.summary        = 'Streaming hand tracking for the SignSight app'
  s.description    = 'Android-first local Expo module that exposes a VisionCamera hand tracking plugin.'
  s.author         = 'OpenAI'
  s.homepage       = 'https://openai.com'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: 'https://example.com/signsight' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
