import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Helper function to encode string to base64 (handles Unicode properly)
function stringToBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
const GITHUB_REPO_OWNER = Deno.env.get('GITHUB_REPO_OWNER');
const GITHUB_REPO_NAME = Deno.env.get('GITHUB_REPO_NAME');

// Create or update a file in GitHub repo
async function createGitHubFile(path: string, content: string, message: string): Promise<boolean> {
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    console.error('GitHub credentials not configured');
    return false;
  }

  try {
    // Check if file exists to get SHA
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Lovable-Init-Template',
        },
      }
    );

    let sha: string | undefined;
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
      console.log(`File ${path} exists, will update (SHA: ${sha})`);
    }

    // Create/update file
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Lovable-Init-Template',
        },
        body: JSON.stringify({
          message,
          content: stringToBase64(content),
          sha,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error(`Failed to create ${path}:`, JSON.stringify(error));
      return false;
    }

    console.log(`Successfully created ${path}`);
    return true;
  } catch (error) {
    console.error(`Error creating ${path}:`, error);
    return false;
  }
}

// Create binary file (for placeholder images)
async function createPlaceholderImage(path: string): Promise<boolean> {
  // 1x1 transparent PNG as placeholder
  const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    return false;
  }

  try {
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Lovable-Init-Template',
        },
      }
    );

    let sha: string | undefined;
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Lovable-Init-Template',
        },
        body: JSON.stringify({
          message: `Add placeholder ${path}`,
          content: transparentPng,
          sha,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`Error creating placeholder ${path}:`, error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting template repo initialization...');
    console.log(`Repo: ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`);

    const results: Record<string, boolean> = {};

    // 1. package.json - Using Expo SDK 51 for Android SDK 34 compatibility
    const packageJson = {
      name: "webview-app-template",
      version: "1.0.0",
      main: "node_modules/expo/AppEntry.js",
      scripts: {
        start: "expo start",
        android: "expo start --android",
        ios: "expo start --ios",
        web: "expo start --web",
        "build:android": "eas build --platform android --profile preview --local",
        "build:ios": "eas build --platform ios --profile preview --local"
      },
      dependencies: {
        "expo": "~51.0.0",
        "expo-status-bar": "~1.12.1",
        "expo-splash-screen": "~0.27.5",
        "react": "18.2.0",
        "react-native": "0.74.5",
        "react-native-webview": "13.8.6",
        "@react-navigation/native": "^6.1.18",
        "@react-navigation/bottom-tabs": "^6.6.1",
        "@react-navigation/drawer": "^6.7.2",
        "react-native-gesture-handler": "~2.16.1",
        "react-native-reanimated": "~3.10.1",
        "react-native-screens": "~3.31.1",
        "react-native-safe-area-context": "4.10.5",
        "@expo/vector-icons": "^14.0.2",
        "@react-native-community/netinfo": "~11.3.1",
        "@react-native-async-storage/async-storage": "1.23.1",
        "react-native-inappbrowser-reborn": "^3.7.0"
      },
      devDependencies: {
        "@babel/core": "^7.24.0"
      },
      private: true
    };
    results['package.json'] = await createGitHubFile('package.json', JSON.stringify(packageJson, null, 2), 'Add package.json');

    // 2. app.json (template - will be updated per build)
    const appJson = {
      expo: {
        name: "WebView App",
        slug: "webview-app",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "automatic",
        splash: {
          image: "./assets/splash.png",
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        },
        assetBundlePatterns: ["**/*"],
        ios: {
          supportsTablet: true,
          bundleIdentifier: "com.app.webview"
        },
        android: {
          adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff"
          },
          package: "com.app.webview"
        },
        web: {
          favicon: "./assets/favicon.png"
        }
      }
    };
    results['app.json'] = await createGitHubFile('app.json', JSON.stringify(appJson, null, 2), 'Add app.json');

    // 3. App.js (template - full-screen WebView)
    const appJs = `import React from 'react';
import { StatusBar, StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const WEBSITE_URL = 'https://example.com';

function WebViewScreen({ url = WEBSITE_URL }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
      />
    </View>
  );
}

export default function App() {
  return <WebViewScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});`;
    results['App.js'] = await createGitHubFile('App.js', appJs, 'Add App.js');

    // 4. babel.config.js
    const babelConfig = `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};`;
    results['babel.config.js'] = await createGitHubFile('babel.config.js', babelConfig, 'Add babel.config.js');

    // 5. .gitignore
    const gitignore = `node_modules/
.expo/
dist/
npm-debug.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
.env`;
    results['.gitignore'] = await createGitHubFile('.gitignore', gitignore, 'Add .gitignore');

    // 6. codemagic.yaml - Using expo prebuild with SDK 49
    // Includes APK, AAB for Android and unsigned IPA for iOS
    // Uses Xcode 16.2 for iOS builds
    const webhookUrl = 'https://viudzmarsxxblbdaxfzu.supabase.co/functions/v1/codemagic-webhook';
    
    const codemagicYaml = `# Codemagic CI/CD configuration
# Auto-generated template for WebView apps
# IMPORTANT: Builds are triggered via API only (push triggers disabled)

workflows:
  android-workflow:
    name: Android Build
    instance_type: mac_mini_m2
    max_build_duration: 120
    environment:
      groups:
        - app_credentials
      vars:
        PACKAGE_NAME: com.app.webview
      node: 18.17.0
      java: "17"
    scripts:
      - name: Install dependencies
        script: |
          npm install --no-audit --no-fund
          npm install --no-audit --no-fund sharp
      - name: Generate Android project
        script: npx expo prebuild --platform android --clean --no-install
      - name: Fix Expo Android plugin resolution
        script: |
          set -e
          SETTINGS_FILE="android/settings.gradle"
          if [ ! -f "$SETTINGS_FILE" ]; then
            echo "ERROR: android/settings.gradle missing after prebuild"
            exit 1
          fi

          ruby - <<'RUBY'
          settings_path = 'android/settings.gradle'
          content = File.read(settings_path)

          expo_include = "includeBuild(new File([\"node\", \"--print\", \"require.resolve('expo/package.json')\"].execute(null, rootDir).text.trim()).getParentFile().toString() + \"/../packages/expo-modules-core/android\")"

          unless content.include?('expo-modules-core/android')
            if content =~ /pluginManagement\s*\{/
              content = content.sub(/pluginManagement\s*\{/, "pluginManagement {\n  #{expo_include}")
            else
              content = "pluginManagement {\n  #{expo_include}\n}\n\n" + content
            end
            File.write(settings_path, content)
            puts 'Patched settings.gradle with expo-modules-core includeBuild'
          else
            puts 'settings.gradle already contains expo-modules-core includeBuild'
          end
          RUBY

          if ! grep -q "expo-modules-core/android" "$SETTINGS_FILE"; then
            echo "ERROR: expo-modules-core includeBuild still missing"
            exit 1
          fi

          PROP_FILE="android/gradle.properties"
          touch "$PROP_FILE"
          if grep -q '^android\.disableAutomaticComponentCreation=' "$PROP_FILE"; then
            sed -i.bak 's/^android\.disableAutomaticComponentCreation=.*/android.disableAutomaticComponentCreation=false/' "$PROP_FILE"
          else
            echo "android.disableAutomaticComponentCreation=false" >> "$PROP_FILE"
          fi
          rm -f "$PROP_FILE.bak"
          echo "✓ Expo Android plugin resolution hardened"
      - name: Fix Gradle rootProject crash (bulletproof)
        script: |
          set -e
          echo "=== DIAGNOSTIC: android/app/build.gradle around line 116 (before patch) ==="
          if [ -f "android/app/build.gradle" ]; then
            nl -ba android/app/build.gradle | sed -n '105,130p' || true
          fi

          ruby - <<'RUBY'
          def patch_text(text, aggressive: false)
            patched = text.dup

            # Multi-line safe patterns
            patched.gsub!(/(project\\.)?findProject\\([^\\)]*\\)\\s*\\.\\s*rootProject/m, 'rootProject')
            patched.gsub!(/(project\\.)?findProject\\([^\\)]*\\)\\s*\\?\\.\\s*rootProject/m, 'rootProject')
            patched.gsub!(/\\bproject\\s*\\.\\s*rootProject\\b/m, 'rootProject')
            patched.gsub!(/\\bproject\\([^\\)]*\\)\\s*\\.\\s*rootProject\\b/m, 'rootProject')

            vars = patched
              .scan(/(?:^|\\s)(?:def\\s+)?([A-Za-z_]\\w*)\\s*=\\s*(?:project\\.)?findProject\\([^\\)]*\\)/m)
              .flatten
              .uniq

            vars.each do |v|
              patched.gsub!(/\\b\#{Regexp.escape(v)}\\s*\\.\\s*rootProject\\b/m, 'rootProject')
              patched.gsub!(/\\b\#{Regexp.escape(v)}\\s*\\.\\s*getRootProject\\(\\)\\b/m, 'rootProject')
            end

            if aggressive
              patched.gsub!(/\\b([A-Za-z_]\\w*)\\s*\\.\\s*rootProject\\b/m) { |m| $1 == 'rootProject' ? m : 'rootProject' }
              patched.gsub!(/\\b([A-Za-z_]\\w*)\\s*\\.\\s*getRootProject\\(\\)\\b/m) { |m| $1 == 'rootProject' ? m : 'rootProject' }
            end

            patched
          end

          def patch_file(path, aggressive: false)
            return false unless File.exist?(path)
            original = File.read(path)
            patched = patch_text(original, aggressive: aggressive)
            return false if patched == original
            File.write(path, patched)
            puts "PATCHED: \#{path}"
            true
          rescue => e
            puts "ERROR patching \#{path}: \#{e.message}"
            false
          end

          candidates = [
            'android/app/build.gradle',
            'android/app/build.gradle.kts',
            'android/build.gradle',
            'android/build.gradle.kts',
            'android/settings.gradle',
            'android/settings.gradle.kts',
            'node_modules/@react-native-community/cli-platform-android/native_modules.gradle',
            'node_modules/expo-modules-autolinking/scripts/android/autolinking.gradle',
            'node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle',
          ]

          puts "Files to scan:";
          candidates.each { |p| puts "  \#{File.exist?(p) ? '✓' : '✗'} \#{p}" }

          patched_count = 0
          candidates.each do |p|
            patched_count += 1 if patch_file(p, aggressive: (p == 'android/app/build.gradle'))
          end

          puts "Total files patched: \#{patched_count}"
          RUBY

          echo "=== DIAGNOSTIC: android/app/build.gradle around line 116 (after patch) ==="
          if [ -f "android/app/build.gradle" ]; then
            nl -ba android/app/build.gradle | sed -n '105,130p' || true
          fi

          echo "=== Preflight: fail if any '.rootProject' remains in android/app/build.gradle ==="
          if [ -f "android/app/build.gradle" ] && grep -nE '\\\\.[[:space:]]*rootProject' android/app/build.gradle; then
            echo "ERROR: Remaining .rootProject references detected (would still risk NPE)."
            exit 1
          fi

          echo "=== Gradle rootProject patching complete ==="
      - name: Configure Android SDK 34
        script: |
          PROP_FILE="android/gradle.properties"
          echo "" >> "$PROP_FILE"
          echo "# SDK 34 enforcement" >> "$PROP_FILE"
          echo "android.compileSdkVersion=34" >> "$PROP_FILE"
          echo "android.targetSdkVersion=34" >> "$PROP_FILE"
          echo "android.minSdkVersion=24" >> "$PROP_FILE"
          echo "org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8" >> "$PROP_FILE"
          cat "$PROP_FILE"
      - name: Set up local.properties
        script: |
          SDK_DIR="\${ANDROID_SDK_ROOT:-\$ANDROID_HOME}"
          if [ -z "$SDK_DIR" ]; then echo "Missing Android SDK path"; exit 1; fi
          echo "sdk.dir=$SDK_DIR" > android/local.properties
      - name: Validate Gradle setup (preflight)
        script: |
          echo "=== Pre-build validation ==="
          if [ ! -f "android/app/build.gradle" ]; then
            echo "ERROR: android/app/build.gradle missing"; exit 1
          fi
          if grep -q 'project\\.rootProject' android/app/build.gradle; then
            echo "ERROR: Unpatched 'project.rootProject' still present in build.gradle"
            grep -n 'project\\.rootProject' android/app/build.gradle
            exit 1
          fi
          if grep -q 'findProject.*\\.rootProject' android/app/build.gradle; then
            echo "ERROR: Unpatched 'findProject(...).rootProject' still present in build.gradle"
            grep -n 'findProject.*\\.rootProject' android/app/build.gradle
            exit 1
          fi
          if grep -qE '\\\\.[[:space:]]*rootProject' android/app/build.gradle; then
            echo "ERROR: Remaining '.rootProject' references still present in build.gradle"
            grep -nE '\\\\.[[:space:]]*rootProject' android/app/build.gradle
            exit 1
          fi
          echo "✓ Gradle files validated - no rootProject null traps detected"
      - name: Build Android APK
        script: |
          export NODE_OPTIONS="--max-old-space-size=4096"
          cd android && ./gradlew :app:assembleRelease --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx4096m"
      - name: Build Android App Bundle
        script: |
          export NODE_OPTIONS="--max-old-space-size=4096"
          cd android && ./gradlew :app:bundleRelease --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx4096m"
      - name: Copy build outputs
        script: |
          mkdir -p $CM_BUILD_DIR/build/outputs
          find android/app/build/outputs -name "*.apk" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\\\;
          find android/app/build/outputs -name "*.aab" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\\\;
          ls -la $CM_BUILD_DIR/build/outputs/
      - name: Capture Android diagnostics on failure
        script: |
          mkdir -p $CM_BUILD_DIR/build/diagnostics
          echo "=== android/app/build.gradle lines 90-140 ===" > $CM_BUILD_DIR/build/diagnostics/android-build-gradle-snippet.txt
          if [ -f "android/app/build.gradle" ]; then
            nl -ba android/app/build.gradle | sed -n '90,140p' >> $CM_BUILD_DIR/build/diagnostics/android-build-gradle-snippet.txt
          else
            echo "FILE NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/android-build-gradle-snippet.txt
          fi
          echo "" >> $CM_BUILD_DIR/build/diagnostics/android-build-gradle-snippet.txt
          echo "=== Full android/app/build.gradle ===" >> $CM_BUILD_DIR/build/diagnostics/android-build-gradle-snippet.txt
          cat android/app/build.gradle >> $CM_BUILD_DIR/build/diagnostics/android-build-gradle-snippet.txt 2>/dev/null || true
          echo "=== gradle.properties ===" > $CM_BUILD_DIR/build/diagnostics/android-gradle-properties.txt
          cat android/gradle.properties >> $CM_BUILD_DIR/build/diagnostics/android-gradle-properties.txt 2>/dev/null || echo "NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/android-gradle-properties.txt
          echo "=== settings.gradle ===" > $CM_BUILD_DIR/build/diagnostics/android-settings-gradle.txt
          cat android/settings.gradle >> $CM_BUILD_DIR/build/diagnostics/android-settings-gradle.txt 2>/dev/null || echo "NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/android-settings-gradle.txt
          echo "=== android/build.gradle ===" > $CM_BUILD_DIR/build/diagnostics/android-root-build-gradle.txt
          cat android/build.gradle >> $CM_BUILD_DIR/build/diagnostics/android-root-build-gradle.txt 2>/dev/null || echo "NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/android-root-build-gradle.txt
          echo "=== package.json ===" > $CM_BUILD_DIR/build/diagnostics/package-json.txt
          cat package.json >> $CM_BUILD_DIR/build/diagnostics/package-json.txt 2>/dev/null || echo "NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/package-json.txt
          echo "Diagnostics captured at $(date)" >> $CM_BUILD_DIR/build/diagnostics/android-build-gradle-snippet.txt
    artifacts:
      - android/app/build/outputs/**/*.apk
      - android/app/build/outputs/**/*.aab
      - build/outputs/*.apk
      - build/outputs/*.aab
      - build/diagnostics/**
    publishing:
      email:
        recipients:
          - team@example.com
        notify:
          success: true
          failure: true

  ios-workflow:
    name: iOS Build
    instance_type: mac_mini_m2
    max_build_duration: 120
    environment:
      groups:
        - app_credentials
      vars:
        BUNDLE_ID: com.app.webview
      node: 18.17.0
      xcode: 16.2
      cocoapods: default
    scripts:
      - name: Install dependencies
        script: |
          npm install --no-audit --no-fund
          npm install --no-audit --no-fund sharp
      - name: Generate iOS project
        script: npx expo prebuild --platform ios --clean --no-install
      - name: Configure Node for Xcode
        script: |
          NODE_BIN="$(command -v node || which node)"
          echo "export NODE_BINARY=$NODE_BIN" > ios/.xcode.env.local
      - name: Patch Boost podspec URL
        script: |
          BOOST_PODSPEC="node_modules/react-native/third-party-podspecs/boost.podspec"
          if [ -f "$BOOST_PODSPEC" ]; then
            BOOST_URL="https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2"
            sed -i.bak "s|https://boostorg.jfrog.io/artifactory/main/release/[^']*|$BOOST_URL|g" "$BOOST_PODSPEC"
          fi
      - name: Install CocoaPods
        script: |
          cd ios
          rm -rf Pods Podfile.lock
          pod repo update
          pod install --repo-update --clean-install
      - name: Fix Pods deployment target
        script: |
          cd ios
          ruby - <<'RUBY'
          begin
            require 'xcodeproj'
            project_path = 'Pods/Pods.xcodeproj'
            unless File.exist?(project_path)
              puts "Pods.xcodeproj not found, skipping"
              exit 0
            end
            project = Xcodeproj::Project.open(project_path)
            project.targets.each do |t|
              t.build_configurations.each do |c|
                c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.4'
              end
            end
            project.save
            puts "Patched Pods deployment target to 13.4"
          rescue => e
            puts "Patch skipped: \#{e.message}"
            exit 0
          end
          RUBY
      - name: Build iOS Archive
        script: |
          cd ios
          export NODE_BINARY="$(command -v node || which node)"
          export RCT_NO_LAUNCH_PACKAGER=true
          export CI=1

          echo "=== iOS directory contents ==="
          ls -la

          echo "=== Detecting Xcode workspace/project ==="
          WORKSPACE=""
          PROJECT=""

          for dir in *.xcworkspace; do
            if [ -d "$dir" ] && [ "$dir" != "Pods.xcworkspace" ]; then
              WORKSPACE="$dir"
              break
            fi
          done

          if [ -z "$WORKSPACE" ]; then
            for dir in *.xcodeproj; do
              if [ -d "$dir" ] && [ "$dir" != "Pods.xcodeproj" ]; then
                PROJECT="$dir"
                break
              fi
            done
          fi

          echo "Detected workspace: $WORKSPACE"
          echo "Detected project: $PROJECT"

          if [ -n "$WORKSPACE" ]; then
            echo "=== Workspace schemes ==="
            xcodebuild -list -workspace "$WORKSPACE" || true
            SCHEME_NAME=$(xcodebuild -list -json -workspace "$WORKSPACE" 2>/dev/null | jq -r '.workspace.schemes[0] // empty')
            if [ -z "$SCHEME_NAME" ]; then
              echo "ERROR: Could not detect scheme from workspace $WORKSPACE"
              exit 1
            fi
            echo "Building with workspace: $WORKSPACE | scheme: $SCHEME_NAME"
            xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath $CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
          elif [ -n "$PROJECT" ]; then
            echo "=== Project schemes ==="
            xcodebuild -list -project "$PROJECT" || true
            SCHEME_NAME=$(xcodebuild -list -json -project "$PROJECT" 2>/dev/null | jq -r '.project.schemes[0] // empty')
            if [ -z "$SCHEME_NAME" ]; then
              echo "ERROR: Could not detect scheme from project $PROJECT"
              exit 1
            fi
            echo "Building with project: $PROJECT | scheme: $SCHEME_NAME"
            xcodebuild -project "$PROJECT" -scheme "$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath $CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
          else
            echo "ERROR: No .xcworkspace or .xcodeproj directory found in ios/"
            echo "Available files/directories:"
            ls -la
            exit 1
          fi
      - name: Create unsigned IPA
        script: |
          mkdir -p $CM_BUILD_DIR/build/ipa
          cd $CM_BUILD_DIR/build/App.xcarchive/Products/Applications
          mkdir -p Payload
          cp -r *.app Payload/
          zip -r $CM_BUILD_DIR/build/ipa/App.ipa Payload
      - name: Capture iOS diagnostics on failure
        script: |
          mkdir -p $CM_BUILD_DIR/build/diagnostics
          echo "=== iOS directory listing ===" > $CM_BUILD_DIR/build/diagnostics/ios-directory.txt
          ls -la ios/ >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt 2>/dev/null || echo "ios/ not found" >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt
          echo "" >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt
          echo "=== .xcworkspace directories ===" >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt
          find ios -maxdepth 1 -name "*.xcworkspace" -type d >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt 2>/dev/null || true
          echo "=== .xcodeproj directories ===" >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt
          find ios -maxdepth 1 -name "*.xcodeproj" -type d >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt 2>/dev/null || true
          echo "=== Workspace schemes ===" > $CM_BUILD_DIR/build/diagnostics/ios-schemes.txt
          cd ios
          for ws in *.xcworkspace; do
            if [ -d "\\$ws" ] && [ "\\$ws" != "Pods.xcworkspace" ]; then
              echo "Workspace: \\$ws" >> $CM_BUILD_DIR/build/diagnostics/ios-schemes.txt
              xcodebuild -list -json -workspace "\\$ws" 2>/dev/null >> $CM_BUILD_DIR/build/diagnostics/ios-schemes.txt || echo "Could not list schemes" >> $CM_BUILD_DIR/build/diagnostics/ios-schemes.txt
            fi
          done
          cd ..
          echo "=== Podfile ===" > $CM_BUILD_DIR/build/diagnostics/ios-podfile.txt
          cat ios/Podfile >> $CM_BUILD_DIR/build/diagnostics/ios-podfile.txt 2>/dev/null || echo "NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/ios-podfile.txt
          echo "=== Podfile.lock (first 50 lines) ===" > $CM_BUILD_DIR/build/diagnostics/ios-podfile-lock.txt
          head -50 ios/Podfile.lock >> $CM_BUILD_DIR/build/diagnostics/ios-podfile-lock.txt 2>/dev/null || echo "NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/ios-podfile-lock.txt
          echo "=== .xcode.env.local ===" > $CM_BUILD_DIR/build/diagnostics/ios-xcode-env.txt
          cat ios/.xcode.env.local >> $CM_BUILD_DIR/build/diagnostics/ios-xcode-env.txt 2>/dev/null || echo "NOT FOUND" >> $CM_BUILD_DIR/build/diagnostics/ios-xcode-env.txt
          echo "Diagnostics captured at $(date)" >> $CM_BUILD_DIR/build/diagnostics/ios-directory.txt
    artifacts:
      - build/ipa/*.ipa
      - build/*.xcarchive
      - build/diagnostics/**
    publishing:
      email:
        recipients:
          - team@example.com
        notify:
          success: true
          failure: true`;
    results['codemagic.yaml'] = await createGitHubFile('codemagic.yaml', codemagicYaml, 'Update codemagic.yaml with bulletproof iOS/Android builds');

    // 7. README.md
    const readme = `# WebView App Template

This is an Expo/React Native template for building WebView wrapper apps.

## How it works

This template is automatically updated by the Lovable App Builder before each build:
- \`app.json\` - Updated with app name, package ID, icons
- \`App.js\` - Updated with website URL and navigation config
- \`assets/\` - Updated with user's custom app icon

## Local Development

\`\`\`bash
npm install
npx expo start
\`\`\`

## Building with Codemagic

Builds are triggered automatically via API when users create apps through the builder.
`;
    results['README.md'] = await createGitHubFile('README.md', readme, 'Add README.md');

    // 8. Create assets folder with placeholder images
    console.log('Creating placeholder assets...');
    results['assets/icon.png'] = await createPlaceholderImage('assets/icon.png');
    results['assets/adaptive-icon.png'] = await createPlaceholderImage('assets/adaptive-icon.png');
    results['assets/favicon.png'] = await createPlaceholderImage('assets/favicon.png');
    results['assets/splash.png'] = await createPlaceholderImage('assets/splash.png');

    const successCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;

    console.log(`Template initialization complete: ${successCount}/${totalCount} files created`);

    return new Response(JSON.stringify({
      success: successCount === totalCount,
      message: `Created ${successCount}/${totalCount} files in ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      results,
      repoUrl: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error initializing template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
