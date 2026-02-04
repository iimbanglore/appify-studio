import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
          content: btoa(content),
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
    
    const codemagicYaml = `workflows:
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
          # One deterministic install pass (avoid mutating dependencies mid-build)
          npm install --no-audit --no-fund
          # Used only for icon processing in CI
          npm install --no-audit --no-fund sharp
      - name: Generate Android project
        script: npx expo prebuild --platform android --clean --no-install
      - name: Fix Gradle rootProject crash (permanent)
        script: |
          set -e
          echo "=== Diagnosing Android Gradle rootProject crash ==="
          if [ -f "android/app/build.gradle" ]; then
            echo "--- android/app/build.gradle (lines 110-130) ---"
            nl -ba android/app/build.gradle | sed -n '110,130p' || true
          fi
          echo "--- Searching for '.rootProject' hotspots ---"
          grep -RIn --line-number --fixed-strings ".rootProject" \
            android/app/build.gradle \
            android/app/build.gradle.kts \
            node_modules/@react-native-community/cli-platform-android/native_modules.gradle \
            node_modules/expo-modules-autolinking/scripts/android 2>/dev/null || true

          # Patch the known crash pattern:
          #   (project.)findProject('...').rootProject
          # where findProject can return null -> "Cannot get property 'rootProject' on null object"
          ruby - <<'RUBY'
          def patch_file(path)
            data = File.read(path)
            fixed = data.dup
            fixed.gsub!(/(project\.)?findProject\([^\)]*\)\.rootProject/, 'rootProject')
            fixed.gsub!('project.rootProject', 'rootProject')
            return false if fixed == data
            File.write(path, fixed)
            true
          end

          candidates = [
            'android/app/build.gradle',
            'android/app/build.gradle.kts',
            'node_modules/@react-native-community/cli-platform-android/native_modules.gradle',
            'node_modules/expo-modules-autolinking/scripts/android/autolinking.gradle',
            'node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle',
          ]

          candidates.each do |p|
            next unless File.exist?(p)
            changed = patch_file(p)
            puts(changed ? "Patched #{p}" : "No patch needed in #{p}")
          end
          RUBY

          echo "=== Gradle rootProject crash mitigation complete ==="
      - name: Ensure Android SDK 34
        script: |
          echo "=== Ensuring Android SDK 34 via gradle.properties (NO file patching) ==="
          
          # ONLY use gradle.properties - avoid any sed patching that can corrupt files
          PROP_FILE="android/gradle.properties"
          
          # Append SDK version overrides
          echo "" >> "$PROP_FILE"
          echo "# SDK 34 enforcement" >> "$PROP_FILE"
          echo "android.compileSdkVersion=34" >> "$PROP_FILE"
          echo "android.targetSdkVersion=34" >> "$PROP_FILE"
          echo "android.minSdkVersion=24" >> "$PROP_FILE"
          echo "org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8" >> "$PROP_FILE"
          
          echo "Updated gradle.properties:"
          cat "$PROP_FILE"
          
          echo "=== SDK 34 enforcement complete (via gradle.properties only) ==="
      - name: Set up local.properties
        script: |
          echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
          echo "ANDROID_HOME=$ANDROID_HOME"
          SDK_DIR="$ANDROID_SDK_ROOT"
          if [ -z "$SDK_DIR" ]; then SDK_DIR="$ANDROID_HOME"; fi
          if [ -z "$SDK_DIR" ]; then echo "Missing Android SDK path (ANDROID_SDK_ROOT/ANDROID_HOME)"; exit 1; fi
          echo "sdk.dir=$SDK_DIR" > android/local.properties
      - name: Build Android APK
        script: |
          export NODE_OPTIONS="--max-old-space-size=4096"
          cd android && ./gradlew :app:assembleRelease --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx4096m -Dfile.encoding=UTF-8"
      - name: Build Android App Bundle (AAB)
        script: |
          export NODE_OPTIONS="--max-old-space-size=4096"
          cd android && ./gradlew :app:bundleRelease --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx4096m -Dfile.encoding=UTF-8"
      - name: Copy build outputs
        script: |
          mkdir -p $CM_BUILD_DIR/build/outputs
          find android/app/build/outputs -name "*.apk" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\;
          find android/app/build/outputs -name "*.aab" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\;
          ls -la $CM_BUILD_DIR/build/outputs/
    artifacts:
      - android/app/build/outputs/**/*.apk
      - android/app/build/outputs/**/*.aab
      - build/outputs/*.apk
      - build/outputs/*.aab
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
          npm install
          npm install sharp
      - name: Generate iOS project
        script: npx expo prebuild --platform ios --clean --no-install
      - name: Fix Node path for Xcode bundling
        script: |
          NODE_BIN="$(command -v node || which node)"
          echo "Using NODE_BINARY=$NODE_BIN"
          # React Native build phases (react-native-xcode.sh) read this file.
          echo "export NODE_BINARY=$NODE_BIN" > ios/.xcode.env.local
          cat ios/.xcode.env.local
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
      - name: Fix Pods iOS deployment target
        script: |
          # Some Pods default to iOS 9.0 which Xcode 16 no longer supports.
          # Patch Pods.xcodeproj to a supported target so archive doesn't fail.
          cd ios
          ruby - <<'RUBY'
          begin
            require 'xcodeproj'
            project_path = 'Pods/Pods.xcodeproj'
            target_version = '13.4'
            unless File.exist?(project_path)
              puts "Pods.xcodeproj not found, skipping"
              exit 0
            end

            project = Xcodeproj::Project.open(project_path)
            project.targets.each do |t|
              t.build_configurations.each do |c|
                c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = target_version
              end
            end
            project.save
            puts "Patched Pods deployment target to #{target_version}"
          rescue => e
            puts "Failed to patch Pods deployment target: #{e.class}: #{e.message}"
            # Don't fail the build just because this patch didn't run.
            exit 0
          end
          RUBY
      - name: Build iOS Archive
        script: |
          cd ios
          NODE_BIN=$(command -v node || which node)
          export NODE_BINARY="$NODE_BIN"
          export RCT_NO_LAUNCH_PACKAGER=true
          export CI=1
          echo "--- ios/ directory listing ---"
          ls -la
          echo "--- Searching for Xcode workspace/project ---"
           WORKSPACE=$(find . -maxdepth 1 -type d -name "*.xcworkspace" ! -name "Pods.xcworkspace" -print -quit | sed 's|^\./||')
           PROJECT=$(find . -maxdepth 1 -type d -name "*.xcodeproj" ! -name "Pods.xcodeproj" -print -quit | sed 's|^\./||')
          echo "Detected workspace: $WORKSPACE"
          echo "Detected project: $PROJECT"

          if [ -n "$WORKSPACE" ]; then
            SCHEME_NAME=$(xcodebuild -list -json -workspace "$WORKSPACE" | jq -r '.workspace.schemes[0] // empty')
            if [ -z "$SCHEME_NAME" ]; then
              echo "Could not detect scheme from workspace $WORKSPACE"; xcodebuild -list -workspace "$WORKSPACE"; exit 1
            fi
            echo "Using workspace: $WORKSPACE | scheme: $SCHEME_NAME"
            xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath $CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
          elif [ -n "$PROJECT" ]; then
            SCHEME_NAME=$(xcodebuild -list -json -project "$PROJECT" | jq -r '.project.schemes[0] // empty')
            if [ -z "$SCHEME_NAME" ]; then
              echo "Could not detect scheme from project $PROJECT"; xcodebuild -list -project "$PROJECT"; exit 1
            fi
            echo "Using project: $PROJECT | scheme: $SCHEME_NAME"
            xcodebuild -project "$PROJECT" -scheme "$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath $CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
          else
            echo "No .xcworkspace or .xcodeproj found in ios/"; exit 1
          fi
      - name: Create unsigned IPA
        script: |
          mkdir -p $CM_BUILD_DIR/build/ipa
          cd $CM_BUILD_DIR/build/App.xcarchive/Products/Applications
          mkdir -p Payload
          cp -r *.app Payload/
          zip -r $CM_BUILD_DIR/build/ipa/App.ipa Payload
    artifacts:
      - build/ipa/*.ipa
      - build/*.xcarchive
    publishing:
      email:
        recipients:
          - team@example.com
        notify:
          success: true
          failure: true`;
    results['codemagic.yaml'] = await createGitHubFile('codemagic.yaml', codemagicYaml, 'Update codemagic.yaml with SDK 34 fix');

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
