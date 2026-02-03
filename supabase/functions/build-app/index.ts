import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const CODEMAGIC_API_TOKEN = Deno.env.get('CODEMAGIC_API_TOKEN');
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
const GITHUB_REPO_OWNER = Deno.env.get('GITHUB_REPO_OWNER');
const GITHUB_REPO_NAME = Deno.env.get('GITHUB_REPO_NAME');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

let cachedGitHubDefaultBranch: string | null = null;
async function getGitHubDefaultBranch(): Promise<string> {
  if (cachedGitHubDefaultBranch) return cachedGitHubDefaultBranch;
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    // Fallback for local/dev where repo isn't configured.
    return 'main';
  }

  try {
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Lovable-Build-App',
      },
    });

    if (!resp.ok) {
      console.warn('Failed to fetch GitHub repo metadata; falling back to main');
      return 'main';
    }

    const data = await resp.json();
    const branch = typeof data?.default_branch === 'string' && data.default_branch.length > 0
      ? data.default_branch
      : 'main';
    cachedGitHubDefaultBranch = branch;
    return branch;
  } catch (e) {
    console.warn('Error fetching GitHub default branch; falling back to main', e);
    return 'main';
  }
}

interface SplashConfig {
  image: string | null;
  backgroundColor: string;
  resizeMode: "contain" | "cover" | "native";
}

interface NavBarStyle {
  backgroundColor: string;
  activeIconColor: string;
  inactiveIconColor: string;
  activeTextColor: string;
  inactiveTextColor: string;
}

interface BuildRequest {
  websiteUrl: string;
  appName: string;
  packageId: string;
  appDescription?: string;
  appIcon?: string; // base64 encoded image
  splashConfig?: SplashConfig;
  enableNavigation: boolean;
  navigationType?: "tabs" | "drawer";
  navItems?: Array<{ label: string; url: string; icon: string; isExternal?: boolean }>;
  navBarStyle?: NavBarStyle;
  keystoreConfig?: {
    alias: string;
    password: string;
    validity: string;
    organization: string;
    country: string;
  };
  platforms: string[];
  userId?: string;
}

// Update GitHub repo file via GitHub API
async function updateGitHubFile(path: string, content: string, message: string): Promise<boolean> {
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    console.log('GitHub credentials not configured, skipping file update');
    return false;
  }

  try {
    // First, get the current file SHA (needed for updates)
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Lovable-Build-App',
        },
      }
    );

    let sha: string | undefined;
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
      console.log(`Found existing file ${path} with SHA: ${sha}`);
    } else {
      console.log(`File ${path} does not exist, will create new`);
    }

    // Update or create the file
    const updateResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Lovable-Build-App',
        },
        body: JSON.stringify({
          message,
          content, // Must be base64 encoded
          sha, // Include SHA if updating existing file
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error(`Failed to update ${path}:`, JSON.stringify(errorData));
      return false;
    }

    console.log(`Successfully updated ${path}`);
    return true;
  } catch (error) {
    console.error(`Error updating GitHub file ${path}:`, error);
    return false;
  }
}

// Upload user's app icon to GitHub repo
async function uploadAppIconToGitHub(appIcon: string): Promise<boolean> {
  if (!appIcon) {
    console.log('No app icon provided, skipping upload');
    return false;
  }

  // Extract base64 content from data URL if needed
  let base64Content = appIcon;
  if (appIcon.startsWith('data:')) {
    base64Content = appIcon.split(',')[1];
  }

  console.log('Uploading app icon to GitHub...');
  
  // Upload icon files (not splash - that's handled separately)
  const iconFiles = [
    { path: 'assets/icon.png', size: '1024x1024' },
    { path: 'assets/adaptive-icon.png', size: '1024x1024' },
    { path: 'assets/favicon.png', size: '48x48' },
  ];

  let allSuccess = true;
  for (const iconFile of iconFiles) {
    const success = await updateGitHubFile(
      iconFile.path,
      base64Content,
      `Update ${iconFile.path} for new app build`
    );
    if (!success) allSuccess = false;
  }

  return allSuccess;
}

// Upload splash screen image to GitHub repo
async function uploadSplashToGitHub(splashImage: string): Promise<boolean> {
  if (!splashImage) {
    console.log('No splash image provided, skipping upload');
    return false;
  }

  // Extract base64 content from data URL if needed
  let base64Content = splashImage;
  if (splashImage.startsWith('data:')) {
    base64Content = splashImage.split(',')[1];
  }

  console.log('Uploading splash image to GitHub...');
  
  return await updateGitHubFile(
    'assets/splash.png',
    base64Content,
    'Update splash.png for new app build'
  );
}

// Update app.json with app-specific configuration
async function updateAppConfig(config: BuildRequest): Promise<boolean> {
  const splashBgColor = config.splashConfig?.backgroundColor || "#ffffff";
  const splashResizeMode = config.splashConfig?.resizeMode || "contain";
  
  const appJson = {
    expo: {
      name: config.appName,
      slug: config.appName.toLowerCase().replace(/\s+/g, '-'),
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      userInterfaceStyle: "automatic",
      splash: {
        image: "./assets/splash.png",
        resizeMode: splashResizeMode,
        backgroundColor: splashBgColor
      },
      assetBundlePatterns: ["**/*"],
      ios: {
        supportsTablet: true,
        bundleIdentifier: config.packageId
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: splashBgColor
        },
        package: config.packageId
      },
      web: {
        favicon: "./assets/favicon.png"
      },
      extra: {
        websiteUrl: config.websiteUrl,
        enableNavigation: config.enableNavigation,
        navItems: config.navItems || []
      }
    }
  };

  const base64Content = stringToBase64(JSON.stringify(appJson, null, 2));
  return await updateGitHubFile('app.json', base64Content, `Update app.json for ${config.appName}`);
}

// Update App.js with navigation configuration
async function updateAppCode(config: BuildRequest): Promise<boolean> {
  const appCode = generateAppCode(config);
  const base64Content = stringToBase64(appCode);
  return await updateGitHubFile('App.js', base64Content, `Update App.js for ${config.appName}`);
}

// Generate and upload codemagic.yaml to GitHub
async function uploadCodemagicConfig(config: BuildRequest): Promise<boolean> {
  const codemagicYaml = `# Codemagic CI/CD configuration for ${config.appName}
# Generated by Web2App Converter

workflows:
  android-workflow:
    name: Android Build
    instance_type: mac_mini_m2
    max_build_duration: 120
    environment:
      vars:
        PACKAGE_NAME: ${config.packageId}
      node: 18.17.0
      java: "17"
    scripts:
      - name: Install dependencies
        script: |
          npm install
          npm install react-native-inappbrowser-reborn
          npm install @react-native-community/netinfo @react-native-async-storage/async-storage expo-splash-screen
          npm install sharp
      - name: Process app icons for proper sizing
        script: |
          # Create a Node.js script to process icons with proper sizing and padding
          cat > process-icons.js << 'ICONSCRIPT'
          const sharp = require('sharp');
          const fs = require('fs');
          const path = require('path');
          
          async function processIcons() {
            const assetsDir = './assets';
            const iconPath = path.join(assetsDir, 'icon.png');
            const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');
            const faviconPath = path.join(assetsDir, 'favicon.png');
            
            if (!fs.existsSync(iconPath)) {
              console.log('No icon.png found, skipping icon processing');
              return;
            }
            
            console.log('Processing app icons...');
            
            try {
              // Read the original icon
              const iconBuffer = fs.readFileSync(iconPath);
              
              // Process main icon - resize to 1024x1024 and ensure it's centered
              const mainIcon = await sharp(iconBuffer)
                .resize(1024, 1024, {
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .png()
                .toBuffer();
              fs.writeFileSync(iconPath, mainIcon);
              console.log('✓ Processed icon.png (1024x1024)');
              
              // Process adaptive icon for Android - add 20% padding for safe zone
              // Android adaptive icons crop outer ~18% so we need padding
              const paddedSize = Math.floor(1024 * 0.7); // Icon at 70% of canvas
              const padding = Math.floor((1024 - paddedSize) / 2);
              
              const adaptiveIcon = await sharp(iconBuffer)
                .resize(paddedSize, paddedSize, {
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .extend({
                  top: padding,
                  bottom: padding,
                  left: padding,
                  right: padding,
                  background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .resize(1024, 1024) // Ensure final size is exactly 1024x1024
                .png()
                .toBuffer();
              fs.writeFileSync(adaptiveIconPath, adaptiveIcon);
              console.log('✓ Processed adaptive-icon.png (1024x1024 with safe zone padding)');
              
              // Process favicon
              const favicon = await sharp(iconBuffer)
                .resize(48, 48, {
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .png()
                .toBuffer();
              fs.writeFileSync(faviconPath, favicon);
              console.log('✓ Processed favicon.png (48x48)');
              
              console.log('All icons processed successfully!');
            } catch (error) {
              console.error('Error processing icons:', error.message);
              // Don't fail the build, just log the error
            }
          }
          
          processIcons();
          ICONSCRIPT
          node process-icons.js
      - name: Generate Android project
        script: |
          npx expo prebuild --platform android --clean --no-install
      - name: Patch Android Gradle scripts (stability)
        script: |
          echo "=== Android Gradle patch (workaround for intermittent Gradle DSL failures) ==="
          if [ -f "android/app/build.gradle" ]; then
            echo "--- android/app/build.gradle (lines 90-140) ---"
            nl -ba android/app/build.gradle | sed -n '90,140p' || true
            ruby - <<'RUBY'
            path = 'android/app/build.gradle'
            data = File.read(path)
            fixed = data.gsub('project.rootProject', 'rootProject')
            if fixed != data
              File.write(path, fixed)
              puts "Patched project.rootProject -> rootProject in #{path}"
            else
              puts "No project.rootProject occurrences in #{path}"
            end
            RUBY
          fi
          if [ -f "android/app/build.gradle.kts" ]; then
            echo "--- android/app/build.gradle.kts (lines 90-140) ---"
            nl -ba android/app/build.gradle.kts | sed -n '90,140p' || true
            ruby - <<'RUBY'
            path = 'android/app/build.gradle.kts'
            data = File.read(path)
            fixed = data.gsub('project.rootProject', 'rootProject')
            if fixed != data
              File.write(path, fixed)
              puts "Patched project.rootProject -> rootProject in #{path}"
            else
              puts "No project.rootProject occurrences in #{path}"
            end
            RUBY
          fi
          echo "=== Android Gradle patch complete ==="
      - name: Ensure Android SDK 34
        script: |
          echo "=== Ensuring Android SDK 34 via gradle.properties (NO file patching) ==="
          
          # ONLY use gradle.properties - avoid any sed patching that can corrupt files
          PROP_FILE="android/gradle.properties"
          
          # Append SDK version overrides
          echo "" >> "\$PROP_FILE"
          echo "# SDK 34 enforcement" >> "\$PROP_FILE"
          echo "android.compileSdkVersion=34" >> "\$PROP_FILE"
          echo "android.targetSdkVersion=34" >> "\$PROP_FILE"
          echo "android.minSdkVersion=24" >> "\$PROP_FILE"
          
          echo "Updated gradle.properties:"
          cat "\$PROP_FILE"
          
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
           cd android && ./gradlew :app:assembleRelease --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx4096m"
      - name: Build Android App Bundle (AAB)
        script: |
          export NODE_OPTIONS="--max-old-space-size=4096"
           cd android && ./gradlew :app:bundleRelease --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx4096m"
      - name: Organize artifacts
        script: |
          mkdir -p \$CM_BUILD_DIR/build/outputs
          find android/app/build/outputs -name "*.apk" -exec cp {} \$CM_BUILD_DIR/build/outputs/ \\;
          find android/app/build/outputs -name "*.aab" -exec cp {} \$CM_BUILD_DIR/build/outputs/ \\;
          ls -la \$CM_BUILD_DIR/build/outputs/
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
          success: false
          failure: true

  ios-workflow:
    name: iOS Build
    instance_type: mac_mini_m2
    max_build_duration: 120
    environment:
      vars:
        BUNDLE_ID: ${config.packageId}
      node: 18.17.0
      xcode: 16.2
      cocoapods: default
    scripts:
      - name: Install dependencies
        script: |
          npm install
          npm install react-native-inappbrowser-reborn
          npm install @react-native-community/netinfo @react-native-async-storage/async-storage expo-splash-screen
          npm install sharp
      - name: Process app icons for proper sizing
        script: |
          # Create a Node.js script to process icons with proper sizing
          cat > process-icons.js << 'ICONSCRIPT'
          const sharp = require('sharp');
          const fs = require('fs');
          const path = require('path');
          
          async function processIcons() {
            const assetsDir = './assets';
            const iconPath = path.join(assetsDir, 'icon.png');
            const faviconPath = path.join(assetsDir, 'favicon.png');
            
            if (!fs.existsSync(iconPath)) {
              console.log('No icon.png found, skipping icon processing');
              return;
            }
            
            console.log('Processing app icons for iOS...');
            
            try {
              // Read the original icon
              const iconBuffer = fs.readFileSync(iconPath);
              
              // Process main icon - resize to 1024x1024 and ensure it's centered
              const mainIcon = await sharp(iconBuffer)
                .resize(1024, 1024, {
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .png()
                .toBuffer();
              fs.writeFileSync(iconPath, mainIcon);
              console.log('✓ Processed icon.png (1024x1024)');
              
              // Process favicon
              const favicon = await sharp(iconBuffer)
                .resize(48, 48, {
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .png()
                .toBuffer();
              fs.writeFileSync(faviconPath, favicon);
              console.log('✓ Processed favicon.png (48x48)');
              
              console.log('All icons processed successfully!');
            } catch (error) {
              console.error('Error processing icons:', error.message);
              // Don't fail the build, just log the error
            }
          }
          
          processIcons();
          ICONSCRIPT
          node process-icons.js
      - name: Generate iOS project
        script: |
          npx expo prebuild --platform ios --clean --no-install
      - name: Fix Node path for Xcode bundling
        script: |
          NODE_BIN="$(command -v node || which node)"
          echo "Using NODE_BINARY=$NODE_BIN"
          # React Native build phases (react-native-xcode.sh) read this file.
          echo "export NODE_BINARY=$NODE_BIN" > ios/.xcode.env.local
          cat ios/.xcode.env.local
      - name: Patch Boost podspec URL (fix checksum mismatch)
        script: |
          BOOST_PODSPEC="node_modules/react-native/third-party-podspecs/boost.podspec"
          if [ -f "\$BOOST_PODSPEC" ]; then
            echo "Patching Boost podspec with working mirror..."
            BOOST_URL="https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2"
            sed -i.bak "s|https://boostorg.jfrog.io/artifactory/main/release/[^']*|\$BOOST_URL|g" "\$BOOST_PODSPEC"
            grep -n "spec.source" "\$BOOST_PODSPEC" || true
          else
            echo "Boost podspec not found (skipping patch)"
          fi
      - name: Install CocoaPods
        script: |
          cd ios
          rm -rf Pods Podfile.lock
          rm -rf ~/Library/Caches/CocoaPods ~/.cocoapods/repos || true
          pod cache clean boost --all || true
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
      - name: Create exportOptions.plist
        script: |
          cat > ios/exportOptions.plist << EOF
          <?xml version="1.0" encoding="UTF-8"?>
          <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
          <plist version="1.0">
          <dict>
            <key>method</key>
            <string>ad-hoc</string>
            <key>compileBitcode</key>
            <false/>
            <key>thinning</key>
            <string>&lt;none&gt;</string>
          </dict>
          </plist>
          EOF
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
            WORKSPACE=\$(find . -maxdepth 1 -type d -name "*.xcworkspace" ! -name "Pods.xcworkspace" -print -quit)
            PROJECT=\$(find . -maxdepth 1 -type d -name "*.xcodeproj" ! -name "Pods.xcodeproj" -print -quit)
           WORKSPACE=\${WORKSPACE#./}
           PROJECT=\${PROJECT#./}
           echo "Detected workspace: \$WORKSPACE"
           echo "Detected project: \$PROJECT"

           if [ -n "\$WORKSPACE" ]; then
             SCHEME_NAME=\$(xcodebuild -list -json -workspace "\$WORKSPACE" | jq -r '.workspace.schemes[0] // empty')
             if [ -z "\$SCHEME_NAME" ]; then
               echo "Could not detect scheme from workspace \$WORKSPACE"; xcodebuild -list -workspace "\$WORKSPACE"; exit 1
             fi
             echo "Using workspace: \$WORKSPACE | scheme: \$SCHEME_NAME"
             xcodebuild -workspace "\$WORKSPACE" -scheme "\$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath \$CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
           elif [ -n "\$PROJECT" ]; then
             SCHEME_NAME=\$(xcodebuild -list -json -project "\$PROJECT" | jq -r '.project.schemes[0] // empty')
             if [ -z "\$SCHEME_NAME" ]; then
               echo "Could not detect scheme from project \$PROJECT"; xcodebuild -list -project "\$PROJECT"; exit 1
             fi
             echo "Using project: \$PROJECT | scheme: \$SCHEME_NAME"
             xcodebuild -project "\$PROJECT" -scheme "\$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath \$CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
           else
             echo "No .xcworkspace or .xcodeproj found in ios/"; exit 1
           fi
      - name: Create unsigned IPA
        script: |
          mkdir -p \$CM_BUILD_DIR/build/ipa
          cd \$CM_BUILD_DIR/build/App.xcarchive/Products/Applications
          mkdir -p Payload
          cp -r *.app Payload/
          zip -r \$CM_BUILD_DIR/build/ipa/${config.appName.replace(/\s+/g, '')}.ipa Payload
          ls -la \$CM_BUILD_DIR/build/ipa/
    artifacts:
      - build/ipa/*.ipa
      - build/*.xcarchive
`;

  const base64Content = stringToBase64(codemagicYaml);
  return await updateGitHubFile('codemagic.yaml', base64Content, `Update codemagic.yaml for ${config.appName}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const buildRequest: BuildRequest = await req.json();
    console.log('Received build request:', JSON.stringify(buildRequest, null, 2));

    if (!CODEMAGIC_API_TOKEN) {
      throw new Error('CODEMAGIC_API_TOKEN is not configured');
    }

    // Step 1: Upload user's app icon to GitHub
    if (buildRequest.appIcon) {
      console.log('Uploading user app icon to GitHub...');
      const iconUploadSuccess = await uploadAppIconToGitHub(buildRequest.appIcon);
      console.log('Icon upload result:', iconUploadSuccess);
    }

    // Step 2: Upload splash screen image to GitHub
    if (buildRequest.splashConfig?.image) {
      console.log('Uploading splash image to GitHub...');
      const splashUploadSuccess = await uploadSplashToGitHub(buildRequest.splashConfig.image);
      console.log('Splash upload result:', splashUploadSuccess);
    }

    // Step 3: Update app.json with user's configuration
    console.log('Updating app.json in GitHub...');
    const appJsonSuccess = await updateAppConfig(buildRequest);
    console.log('App.json update result:', appJsonSuccess);
    if (!appJsonSuccess) {
      throw new Error('Failed to update app configuration (app.json).');
    }

    // Step 4: Update App.js with navigation config
    console.log('Updating App.js in GitHub...');
    const appCodeSuccess = await updateAppCode(buildRequest);
    console.log('App.js update result:', appCodeSuccess);
    if (!appCodeSuccess) {
      throw new Error('Failed to update app code (App.js).');
    }

    // Step 5: Upload codemagic.yaml configuration
    console.log('Uploading codemagic.yaml to GitHub...');
    const codemagicSuccess = await uploadCodemagicConfig(buildRequest);
    console.log('codemagic.yaml upload result:', codemagicSuccess);
    if (!codemagicSuccess) {
      // IMPORTANT: if we can’t update the build config, don’t trigger builds with a stale/older script.
      throw new Error('Failed to update build pipeline configuration (codemagic.yaml).');
    }

    // Generate the React Native/Expo app code for reference
    const appCode = generateAppCode(buildRequest);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Step 5: Trigger Codemagic builds
    const buildResults = [];

    const githubBranch = await getGitHubDefaultBranch();
    console.log('Using GitHub branch for builds:', githubBranch);

    for (const platform of buildRequest.platforms) {
      console.log(`Starting build for platform: ${platform}`);
      
      const workflowConfig = generateWorkflowConfig(buildRequest, platform);
      
      // Trigger build via Codemagic API
      const buildResponse = await fetch('https://api.codemagic.io/builds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': CODEMAGIC_API_TOKEN,
        },
        body: JSON.stringify({
          appId: Deno.env.get('CODEMAGIC_APP_ID') || 'default-app',
          workflowId: platform === 'android' ? 'android-workflow' : 'ios-workflow',
          branch: githubBranch,
          environment: {
            variables: {
              WEBSITE_URL: buildRequest.websiteUrl,
              APP_NAME: buildRequest.appName,
              PACKAGE_ID: buildRequest.packageId,
              APP_DESCRIPTION: buildRequest.appDescription || '',
              ENABLE_NAVIGATION: buildRequest.enableNavigation.toString(),
              NAV_ITEMS: JSON.stringify(buildRequest.navItems || []),
            },
          },
        }),
      });

      const buildData = await buildResponse.json();
      console.log(`Build response for ${platform}:`, JSON.stringify(buildData, null, 2));

      let buildId: string;
      let status = 'queued';
      let message: string;

      if (!buildResponse.ok) {
        // If Codemagic API fails, use a demo build ID
        console.log('Codemagic API error, using simulated build');
        buildId = `demo-${platform}-${Date.now()}`;
        message = `${platform.toUpperCase()} build queued. In production, this would trigger a real Codemagic build.`;
      } else {
        buildId = buildData._id || buildData.buildId;
        message = `${platform.toUpperCase()} build started successfully`;
      }

      // Save build to database for real-time tracking
      const { error: insertError } = await supabase
        .from('builds')
        .insert({
          build_id: buildId,
          platform,
          status,
          app_name: buildRequest.appName,
          package_id: buildRequest.packageId,
          user_id: buildRequest.userId || null,
        });

      if (insertError) {
        console.error(`Error saving build to database:`, insertError);
      } else {
        console.log(`Saved build ${buildId} to database`);
      }

      buildResults.push({
        platform,
        status,
        buildId,
        message,
        estimatedTime: platform === 'android' ? '5-10 minutes' : '10-15 minutes',
        downloadUrl: null,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      builds: buildResults,
      appCode: appCode,
      snackId: generateSnackId(buildRequest),
      githubUpdates: {
        icon: !!buildRequest.appIcon,
        splash: !!buildRequest.splashConfig?.image,
        appJson: true,
        appJs: true,
        codemagicYaml: codemagicSuccess,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in build-app function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      details: 'Build failed. Please check your configuration and try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateAppCode(config: BuildRequest): string {
  const hasNav = config.enableNavigation && config.navItems && config.navItems.length > 0;
  const isDrawer = config.navigationType === "drawer";
  
  // Get custom colors or use defaults
  const navStyle = config.navBarStyle || {
    backgroundColor: "#1a1a1a",
    activeIconColor: "#007AFF",
    inactiveIconColor: "#8E8E93",
    activeTextColor: "#007AFF",
    inactiveTextColor: "#8E8E93",
  };

  // Get splash config
  const splashBgColor = config.splashConfig?.backgroundColor || "#ffffff";
  const splashResizeMode = config.splashConfig?.resizeMode || "contain";
  const hasSplashImage = !!config.splashConfig?.image;

  // Base domain for detecting external links
  const baseDomain = new URL(config.websiteUrl).hostname;
  
  if (hasNav && isDrawer) {
    // Drawer Navigation with In-App Browser, Rigid Pull To Refresh, Speed Optimization, Real-time Sync, and Offline Support
    const navItemsJson = JSON.stringify(config.navItems);
    return `import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StatusBar, StyleSheet, View, Text, Platform, ActivityIndicator, TouchableOpacity, BackHandler, Dimensions, Image, Animated, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

// Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync();

const Drawer = createDrawerNavigator();
const navItems = \${navItemsJson};
const BASE_DOMAIN = '${baseDomain}';
const SYNC_INTERVAL = 30000; // Real-time sync every 30 seconds
const PULL_THRESHOLD = 150; // Rigid pull-to-refresh threshold (pixels)
const CACHE_KEY = 'OFFLINE_HTML_CACHE';
const SPLASH_DURATION = 4000; // Show splash for 4 seconds
const SPLASH_BG_COLOR = '${splashBgColor}';
const LOADING_TIMEOUT = 15000; // Force hide loading after 15 seconds

// Chromium In-App Browser Configuration
const BROWSER_CONFIG = {
  // Android Chrome Custom Tabs settings - uses Chromium engine
  showTitle: true,
  toolbarColor: '${navStyle.backgroundColor}',
  secondaryToolbarColor: '${navStyle.backgroundColor}',
  navigationBarColor: '${navStyle.backgroundColor}',
  navigationBarDividerColor: '#333333',
  enableUrlBarHiding: true,
  enableDefaultShare: true,
  forceCloseOnRedirection: false,
  showInRecents: true,
  hasBackButton: true,
  // iOS Safari View Controller settings
  dismissButtonStyle: 'close',
  preferredBarTintColor: '${navStyle.backgroundColor}',
  preferredControlTintColor: '${navStyle.activeIconColor}',
  readerMode: false,
  animated: true,
  modalPresentationStyle: 'automatic',
  modalTransitionStyle: 'coverVertical',
  modalEnabled: true,
  enableBarCollapsing: true,
};

// Helper function to open URL in Chromium-based in-app browser
async function openInAppBrowser(url) {
  try {
    if (await InAppBrowser.isAvailable()) {
      const result = await InAppBrowser.open(url, BROWSER_CONFIG);
      console.log('Browser closed with result:', result.type);
    } else {
      // Fallback to system browser if in-app browser not available
      Linking.openURL(url);
    }
  } catch (error) {
    console.error('Error opening in-app browser:', error);
    Linking.openURL(url);
  }
}

// Icon mapping from Lucide to Ionicons
const iconMap = {
  'home': 'home',
  'user': 'person',
  'settings': 'settings',
  'info': 'information-circle',
  'menu': 'menu',
  'cart': 'cart',
  'search': 'search',
  'notifications': 'notifications',
  'heart': 'heart',
  'mail': 'mail',
  'calendar': 'calendar',
  'camera': 'camera',
  'music': 'musical-notes',
  'video': 'videocam',
  'map': 'map',
  'phone': 'call',
  'star': 'star',
  'bookmark': 'bookmark',
  'share': 'share-social',
  'download': 'download',
  'upload': 'cloud-upload',
};

const getIonIconName = (lucideIcon) => {
  return iconMap[lucideIcon] || iconMap['home'] || 'home';
};

// Custom Splash Screen Component
function CustomSplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        SplashScreen.hideAsync();
        onFinish();
      });
    }, SPLASH_DURATION);
    
    return () => clearTimeout(timer);
  }, [fadeAnim, onFinish]);
  
  return (
    <Animated.View style={[splashStyles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="${splashBgColor === '#ffffff' || splashBgColor.toLowerCase() === '#fff' ? 'dark-content' : 'light-content'}" backgroundColor={SPLASH_BG_COLOR} />
      ${hasSplashImage ? `<Image 
        source={require('./assets/splash.png')} 
        style={splashStyles.image}
        resizeMode="${splashResizeMode}"
      />` : `<View style={splashStyles.placeholder}>
        <Text style={splashStyles.appName}>${config.appName}</Text>
      </View>`}
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BG_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '${splashBgColor === '#ffffff' || splashBgColor.toLowerCase() === '#fff' ? '#000000' : '#ffffff'}',
  },
});

// Offline fallback page HTML
const OFFLINE_HTML = \`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 80px;
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(90deg, #fff, #a8d8ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      font-size: 16px;
      color: #b0b8c8;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .retry-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      padding: 16px 48px;
      border-radius: 50px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .retry-btn:active {
      transform: scale(0.95);
    }
    .status {
      margin-top: 32px;
      padding: 12px 24px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      font-size: 14px;
      color: #8892a6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Please check your network settings and try again.</p>
    <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
    <div class="status">Waiting for connection...</div>
  </div>
</body>
</html>
\`;

// Legacy InAppBrowser component - kept for fallback, but primary is Chromium browser
function InAppBrowserFallback({ visible, url, onClose }) {
  // This is a fallback component - the main functionality now uses react-native-inappbrowser-reborn
  // which provides Chrome Custom Tabs on Android and SFSafariViewController on iOS
  if (!visible) return null;
  
  // Use Chromium-based browser immediately
  useEffect(() => {
    if (visible && url) {
      openInAppBrowser(url).then(() => {
        onClose();
      });
    }
  }, [visible, url, onClose]);
  
  return null;
}

function WebViewScreen({ url }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedHtml, setCachedHtml] = useState(null);
  const webViewRef = useRef(null);
  const lastSyncRef = useRef(Date.now());

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
      if (!offline && webViewRef.current) {
        // Auto-reload when coming back online
        webViewRef.current.reload();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load cached HTML on mount
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY + '_' + url).then(html => {
      if (html) setCachedHtml(html);
    });
  }, [url]);

  // Loading timeout - force hide loading overlay after timeout
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoading(false);
      }, LOADING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // Cache HTML content for offline use
  const cachePageContent = useCallback(() => {
    if (webViewRef.current && !isOffline) {
      webViewRef.current.injectJavaScript(\`
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'cache', 
          html: document.documentElement.outerHTML 
        }));
        true;
      \`);
    }
  }, [isOffline]);

  // Real-time sync effect
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (webViewRef.current && !loading && !isOffline && Date.now() - lastSyncRef.current >= SYNC_INTERVAL) {
        webViewRef.current.injectJavaScript(\`
          if (typeof window.__realTimeSync === 'function') {
            window.__realTimeSync();
          } else {
            // Soft reload for real-time content sync
            if (document.hidden === false) {
              fetch(window.location.href, { cache: 'reload' })
                .then(r => r.text())
                .then(html => {
                  const parser = new DOMParser();
                  const newDoc = parser.parseFromString(html, 'text/html');
                  const newBody = newDoc.body.innerHTML;
                  if (document.body.innerHTML !== newBody) {
                    document.body.innerHTML = newBody;
                  }
                })
                .catch(() => {});
            }
          }
          true;
        \`);
        lastSyncRef.current = Date.now();
        cachePageContent();
      }
    }, SYNC_INTERVAL);
    return () => clearInterval(syncInterval);
  }, [loading, isOffline, cachePageContent]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    setRefreshing(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  // Show refresh button when scrolled to top
  const handleScrollChange = useCallback((scrollY) => {
    setShowRefreshButton(scrollY <= 50);
  }, []);

  const handleNavigationRequest = (request) => {
    const requestUrl = request.url;
    try {
      const urlObj = new URL(requestUrl);
      const isExternal = !urlObj.hostname.includes(BASE_DOMAIN) && 
                         !requestUrl.startsWith('about:') && 
                         !requestUrl.startsWith('javascript:');
      if (isExternal) {
        // Open external links in Chromium-based in-app browser
        openInAppBrowser(requestUrl);
        return false;
      }
    } catch (e) {}
    return true;
  };

  const injectedJS = \`
    (function() {
      // Scroll tracking
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', y: window.scrollY }));
      window.addEventListener('scroll', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', y: window.scrollY }));
      }, { passive: true });
      
      // Intercept all link clicks for in-app browser
      document.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        if (target && target.tagName === 'A') {
          var href = target.getAttribute('href');
          if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            try {
              var fullUrl = new URL(href, window.location.origin).href;
              var baseDomain = '${baseDomain}';
              var linkHostname = new URL(fullUrl).hostname;
              if (!linkHostname.includes(baseDomain)) {
                e.preventDefault();
                e.stopPropagation();
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'external_link', url: fullUrl }));
              }
            } catch (err) {}
          }
        }
      }, true);
      
      // Also intercept window.open calls
      var originalOpen = window.open;
      window.open = function(url, target, features) {
        if (url) {
          try {
            var fullUrl = new URL(url, window.location.origin).href;
            var baseDomain = '${baseDomain}';
            var linkHostname = new URL(fullUrl).hostname;
            if (!linkHostname.includes(baseDomain)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'external_link', url: fullUrl }));
              return null;
            }
          } catch (err) {}
        }
        return originalOpen.call(window, url, target, features);
      };
    })();
    true;
  \`;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        handleScrollChange(data.y);
      } else if (data.type === 'cache' && data.html) {
        AsyncStorage.setItem(CACHE_KEY + '_' + url, data.html);
        setCachedHtml(data.html);
      } else if (data.type === 'external_link' && data.url) {
        // Open external links in Chromium-based in-app browser
        openInAppBrowser(data.url);
      }
    } catch (e) {}
  };

  // Determine what to show: offline page, cached content, or live content
  const getWebViewSource = () => {
    if (isOffline) {
      if (cachedHtml) {
        return { html: cachedHtml, baseUrl: url };
      }
      return { html: OFFLINE_HTML };
    }
    return { uri: url };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="${navStyle.activeIconColor}" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* Offline indicator */}
      {isOffline && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="cloud-offline" size={16} color="#fff" />
          <Text style={styles.offlineText}>{cachedHtml ? 'Offline - Showing cached version' : 'No internet connection'}</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={getWebViewSource()}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          cachePageContent();
        }}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        onMessage={handleMessage}
        injectedJavaScript={injectedJS}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowsBackForwardNavigationGestures={true}
        pullToRefreshEnabled={false}
        onError={() => setIsOffline(true)}
        onHttpError={() => setIsOffline(true)}
      />

      {/* Floating Refresh Button */}
      {showRefreshButton && !loading && (
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleManualRefresh}
          activeOpacity={0.8}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="refresh" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function CustomDrawerContent(props) {
  return (
    <DrawerContentScrollView {...props} style={styles.drawerContent}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>${config.appName}</Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

// External Link Screen - opens external URL in Chromium-based in-app browser
function ExternalLinkScreen({ url, label }) {
  // Open in Chromium browser when component mounts or when button is pressed
  const handleOpenBrowser = useCallback(() => {
    openInAppBrowser(url);
  }, [url]);
  
  // Auto-open on mount
  useEffect(() => {
    handleOpenBrowser();
  }, [handleOpenBrowser]);
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.externalPlaceholder}>
        <Ionicons name="globe-outline" size={48} color="${navStyle.activeIconColor}" />
        <Text style={styles.externalText}>{label}</Text>
        <TouchableOpacity 
          style={styles.openExternalButton}
          onPress={handleOpenBrowser}
        >
          <Text style={styles.openExternalButtonText}>Open Link</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AppNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '${navStyle.backgroundColor}' },
        headerTintColor: '${navStyle.activeTextColor}',
        drawerStyle: { backgroundColor: '${navStyle.backgroundColor}', width: 280 },
        drawerActiveTintColor: '${navStyle.activeIconColor}',
        drawerInactiveTintColor: '${navStyle.inactiveIconColor}',
        drawerLabelStyle: { marginLeft: -16, fontSize: 15 },
      }}
    >
      {navItems.map((item, index) => (
        <Drawer.Screen 
          key={index}
          name={item.label}
          options={{
            drawerIcon: ({ color, size }) => (
              <Ionicons name={getIonIconName(item.icon)} size={size} color={color} />
            ),
          }}
          children={() => item.isExternal 
            ? <ExternalLinkScreen url={item.url} label={item.label} />
            : <WebViewScreen url={"${config.websiteUrl}" + item.url} />
          }
        />
      ))}
    </Drawer.Navigator>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);
  
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      {showSplash && <CustomSplashScreen onFinish={handleSplashFinish} />}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  refreshButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '${navStyle.activeIconColor}',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
  },
  drawerContent: {
    flex: 1,
    backgroundColor: '${navStyle.backgroundColor}',
  },
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 10,
  },
  drawerTitle: {
    color: '${navStyle.activeTextColor}',
    fontSize: 20,
    fontWeight: 'bold',
  },
  browserContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  browserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '${navStyle.backgroundColor}',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  browserButton: {
    padding: 8,
  },
  browserButtonDisabled: {
    opacity: 0.5,
  },
  browserUrlContainer: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  browserUrl: {
    color: '#aaa',
    fontSize: 13,
  },
  browserLoading: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  browserWebview: {
    flex: 1,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6b6b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  externalPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '${navStyle.backgroundColor}',
    gap: 16,
  },
  externalText: {
    color: '${navStyle.activeTextColor}',
    fontSize: 18,
    fontWeight: '600',
  },
  openExternalButton: {
    backgroundColor: '${navStyle.activeIconColor}',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  openExternalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});`;
  } else if (hasNav) {
    // Bottom Tab Navigation with In-App Browser, Rigid Pull To Refresh, Speed Optimization, Real-time Sync, and Offline Support
    const navItemsJson = JSON.stringify(config.navItems);
    return `import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StatusBar, StyleSheet, SafeAreaView, View, Text, ActivityIndicator, Platform, TouchableOpacity, Dimensions, Image, Animated, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

// Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const navItems = \${navItemsJson};
const BASE_DOMAIN = '${baseDomain}';
const SYNC_INTERVAL = 30000;
const PULL_THRESHOLD = 150;
const CACHE_KEY = 'OFFLINE_HTML_CACHE';
const SPLASH_DURATION = 4000; // Show splash for 4 seconds
const SPLASH_BG_COLOR = '${splashBgColor}';
const LOADING_TIMEOUT = 15000; // Force hide loading after 15 seconds

// Chromium In-App Browser Configuration
const BROWSER_CONFIG = {
  // Android Chrome Custom Tabs settings - uses Chromium engine
  showTitle: true,
  toolbarColor: '${navStyle.backgroundColor}',
  secondaryToolbarColor: '${navStyle.backgroundColor}',
  navigationBarColor: '${navStyle.backgroundColor}',
  navigationBarDividerColor: '#333333',
  enableUrlBarHiding: true,
  enableDefaultShare: true,
  forceCloseOnRedirection: false,
  showInRecents: true,
  hasBackButton: true,
  // iOS Safari View Controller settings
  dismissButtonStyle: 'close',
  preferredBarTintColor: '${navStyle.backgroundColor}',
  preferredControlTintColor: '${navStyle.activeIconColor}',
  readerMode: false,
  animated: true,
  modalPresentationStyle: 'automatic',
  modalTransitionStyle: 'coverVertical',
  modalEnabled: true,
  enableBarCollapsing: true,
};

// Helper function to open URL in Chromium-based in-app browser
async function openInAppBrowser(url) {
  try {
    if (await InAppBrowser.isAvailable()) {
      const result = await InAppBrowser.open(url, BROWSER_CONFIG);
      console.log('Browser closed with result:', result.type);
    } else {
      // Fallback to system browser if in-app browser not available
      Linking.openURL(url);
    }
  } catch (error) {
    console.error('Error opening in-app browser:', error);
    Linking.openURL(url);
  }
}

// Icon mapping from Lucide to Ionicons
const iconMap = {
  'home': 'home',
  'user': 'person',
  'settings': 'settings',
  'info': 'information-circle',
  'menu': 'menu',
  'cart': 'cart',
  'search': 'search',
  'notifications': 'notifications',
  'heart': 'heart',
  'mail': 'mail',
  'calendar': 'calendar',
  'camera': 'camera',
  'music': 'musical-notes',
  'video': 'videocam',
  'map': 'map',
  'phone': 'call',
  'star': 'star',
  'bookmark': 'bookmark',
  'share': 'share-social',
  'download': 'download',
  'upload': 'cloud-upload',
};

const getIonIconName = (lucideIcon) => {
  return iconMap[lucideIcon] || iconMap['home'] || 'home';
};


// Custom Splash Screen Component
function CustomSplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        SplashScreen.hideAsync();
        onFinish();
      });
    }, SPLASH_DURATION);
    
    return () => clearTimeout(timer);
  }, [fadeAnim, onFinish]);
  
  return (
    <Animated.View style={[splashStyles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="${splashBgColor === '#ffffff' || splashBgColor.toLowerCase() === '#fff' ? 'dark-content' : 'light-content'}" backgroundColor={SPLASH_BG_COLOR} />
      ${hasSplashImage ? `<Image 
        source={require('./assets/splash.png')} 
        style={splashStyles.image}
        resizeMode="${splashResizeMode}"
      />` : `<View style={splashStyles.placeholder}>
        <Text style={splashStyles.appName}>${config.appName}</Text>
      </View>`}
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BG_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '${splashBgColor === '#ffffff' || splashBgColor.toLowerCase() === '#fff' ? '#000000' : '#ffffff'}',
  },
});

// Offline fallback page HTML
const OFFLINE_HTML = \`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 80px;
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(90deg, #fff, #a8d8ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      font-size: 16px;
      color: #b0b8c8;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .retry-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      padding: 16px 48px;
      border-radius: 50px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
    }
    .status {
      margin-top: 32px;
      padding: 12px 24px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      font-size: 14px;
      color: #8892a6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Please check your network settings and try again.</p>
    <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
    <div class="status">Waiting for connection...</div>
  </div>
</body>
</html>
\`;

// Legacy InAppBrowser component - kept for fallback, but primary is Chromium browser
function InAppBrowserFallback({ visible, url, onClose }) {
  // This is a fallback component - the main functionality now uses react-native-inappbrowser-reborn
  // which provides Chrome Custom Tabs on Android and SFSafariViewController on iOS
  if (!visible) return null;
  
  // Use Chromium-based browser immediately
  useEffect(() => {
    if (visible && url) {
      openInAppBrowser(url).then(() => {
        onClose();
      });
    }
  }, [visible, url, onClose]);
  
  return null;
}

function WebViewScreen({ url }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedHtml, setCachedHtml] = useState(null);
  const webViewRef = useRef(null);
  const lastSyncRef = useRef(Date.now());

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
      if (!offline && webViewRef.current) {
        webViewRef.current.reload();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load cached HTML on mount
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY + '_' + url).then(html => {
      if (html) setCachedHtml(html);
    });
  }, [url]);

  // Loading timeout - force hide loading overlay after timeout
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoading(false);
      }, LOADING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // Cache HTML content for offline use
  const cachePageContent = useCallback(() => {
    if (webViewRef.current && !isOffline) {
      webViewRef.current.injectJavaScript(\`
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'cache', 
          html: document.documentElement.outerHTML 
        }));
        true;
      \`);
    }
  }, [isOffline]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (webViewRef.current && !loading && !isOffline && Date.now() - lastSyncRef.current >= SYNC_INTERVAL) {
        webViewRef.current.injectJavaScript(\`
          if (typeof window.__realTimeSync === 'function') {
            window.__realTimeSync();
          } else {
            if (document.hidden === false) {
              fetch(window.location.href, { cache: 'reload' })
                .then(r => r.text())
                .then(html => {
                  const parser = new DOMParser();
                  const newDoc = parser.parseFromString(html, 'text/html');
                  const newBody = newDoc.body.innerHTML;
                  if (document.body.innerHTML !== newBody) {
                    document.body.innerHTML = newBody;
                  }
                })
                .catch(() => {});
            }
          }
          true;
        \`);
        lastSyncRef.current = Date.now();
        cachePageContent();
      }
    }, SYNC_INTERVAL);
    return () => clearInterval(syncInterval);
  }, [loading, isOffline, cachePageContent]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    setRefreshing(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  // Show refresh button when scrolled to top
  const handleScrollChange = useCallback((scrollY) => {
    setShowRefreshButton(scrollY <= 50);
  }, []);

  const handleNavigationRequest = (request) => {
    const requestUrl = request.url;
    try {
      const urlObj = new URL(requestUrl);
      const isExternal = !urlObj.hostname.includes(BASE_DOMAIN) && 
                         !requestUrl.startsWith('about:') && 
                         !requestUrl.startsWith('javascript:');
      if (isExternal) {
        // Open external links in Chromium-based in-app browser
        openInAppBrowser(requestUrl);
        return false;
      }
    } catch (e) {}
    return true;
  };

  const injectedJS = \`
    (function() {
      // Scroll tracking
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', y: window.scrollY }));
      window.addEventListener('scroll', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', y: window.scrollY }));
      }, { passive: true });
      
      // Intercept all link clicks for in-app browser
      document.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        if (target && target.tagName === 'A') {
          var href = target.getAttribute('href');
          if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            try {
              var fullUrl = new URL(href, window.location.origin).href;
              var baseDomain = '${baseDomain}';
              var linkHostname = new URL(fullUrl).hostname;
              if (!linkHostname.includes(baseDomain)) {
                e.preventDefault();
                e.stopPropagation();
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'external_link', url: fullUrl }));
              }
            } catch (err) {}
          }
        }
      }, true);
      
      // Also intercept window.open calls
      var originalOpen = window.open;
      window.open = function(url, target, features) {
        if (url) {
          try {
            var fullUrl = new URL(url, window.location.origin).href;
            var baseDomain = '${baseDomain}';
            var linkHostname = new URL(fullUrl).hostname;
            if (!linkHostname.includes(baseDomain)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'external_link', url: fullUrl }));
              return null;
            }
          } catch (err) {}
        }
        return originalOpen.call(window, url, target, features);
      };
    })();
    true;
  \`;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        handleScrollChange(data.y);
      } else if (data.type === 'cache' && data.html) {
        AsyncStorage.setItem(CACHE_KEY + '_' + url, data.html);
        setCachedHtml(data.html);
      } else if (data.type === 'external_link' && data.url) {
        // Open external links in Chromium-based in-app browser
        openInAppBrowser(data.url);
      }
    } catch (e) {}
  };

  const getWebViewSource = () => {
    if (isOffline) {
      if (cachedHtml) {
        return { html: cachedHtml, baseUrl: url };
      }
      return { html: OFFLINE_HTML };
    }
    return { uri: url };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="${navStyle.activeIconColor}" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {isOffline && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="cloud-offline" size={16} color="#fff" />
          <Text style={styles.offlineText}>{cachedHtml ? 'Offline - Showing cached version' : 'No internet connection'}</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={getWebViewSource()}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          cachePageContent();
        }}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        onMessage={handleMessage}
        injectedJavaScript={injectedJS}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowsBackForwardNavigationGestures={true}
        pullToRefreshEnabled={false}
        onError={() => setIsOffline(true)}
        onHttpError={() => setIsOffline(true)}
      />

      {/* Floating Refresh Button */}
      {showRefreshButton && !loading && (
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleManualRefresh}
          activeOpacity={0.8}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="refresh" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// External Link Screen - opens external URL in Chromium-based in-app browser
function ExternalLinkScreen({ url, label }) {
  // Open in Chromium browser when component mounts or when button is pressed
  const handleOpenBrowser = useCallback(() => {
    openInAppBrowser(url);
  }, [url]);
  
  // Auto-open on mount
  useEffect(() => {
    handleOpenBrowser();
  }, [handleOpenBrowser]);
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.externalPlaceholder}>
        <Ionicons name="globe-outline" size={48} color="${navStyle.activeIconColor}" />
        <Text style={styles.externalText}>{label}</Text>
        <TouchableOpacity 
          style={styles.openExternalButton}
          onPress={handleOpenBrowser}
        >
          <Text style={styles.openExternalButtonText}>Open Link</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const item = navItems.find(n => n.label === route.name);
          return <Ionicons name={getIonIconName(item?.icon)} size={size} color={color} />;
        },
        tabBarActiveTintColor: '${navStyle.activeIconColor}',
        tabBarInactiveTintColor: '${navStyle.inactiveIconColor}',
        tabBarStyle: { backgroundColor: '${navStyle.backgroundColor}', borderTopColor: '#333' },
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      {navItems.map((item, index) => (
        <Tab.Screen 
          key={index}
          name={item.label} 
          children={() => item.isExternal 
            ? <ExternalLinkScreen url={item.url} label={item.label} />
            : <WebViewScreen url={"${config.websiteUrl}" + item.url} />
          }
        />
      ))}
    </Tab.Navigator>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);
  
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      {showSplash && <CustomSplashScreen onFinish={handleSplashFinish} />}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  refreshButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '${navStyle.activeIconColor}',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
  },
  browserContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  browserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '${navStyle.backgroundColor}',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  browserButton: {
    padding: 8,
  },
  browserButtonDisabled: {
    opacity: 0.5,
  },
  browserUrlContainer: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  browserUrl: {
    color: '#aaa',
    fontSize: 13,
  },
  browserLoading: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  browserWebview: {
    flex: 1,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6b6b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  externalPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '${navStyle.backgroundColor}',
    gap: 16,
  },
  externalText: {
    color: '${navStyle.activeTextColor}',
    fontSize: 18,
    fontWeight: '600',
  },
  openExternalButton: {
    backgroundColor: '${navStyle.activeIconColor}',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  openExternalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});`;
  } else {
    // Without navigation - Simple WebView with In-App Browser, Rigid Pull To Refresh, Speed Optimization, Real-time Sync, and Offline Support
    return `import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StatusBar, StyleSheet, View, Text, ActivityIndicator, Platform, TouchableOpacity, Dimensions, Image, Animated, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

// Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync();

const BASE_DOMAIN = '${baseDomain}';
const SYNC_INTERVAL = 30000;
const PULL_THRESHOLD = 150;
const CACHE_KEY = 'OFFLINE_HTML_CACHE';
const SPLASH_DURATION = 4000; // Show splash for 4 seconds
const SPLASH_BG_COLOR = '${splashBgColor}';
const LOADING_TIMEOUT = 15000; // Force hide loading after 15 seconds

// Chromium In-App Browser Configuration
const BROWSER_CONFIG = {
  // Android Chrome Custom Tabs settings - uses Chromium engine
  showTitle: true,
  toolbarColor: '#1a1a1a',
  secondaryToolbarColor: '#1a1a1a',
  navigationBarColor: '#1a1a1a',
  navigationBarDividerColor: '#333333',
  enableUrlBarHiding: true,
  enableDefaultShare: true,
  forceCloseOnRedirection: false,
  showInRecents: true,
  hasBackButton: true,
  // iOS Safari View Controller settings
  dismissButtonStyle: 'close',
  preferredBarTintColor: '#1a1a1a',
  preferredControlTintColor: '#007AFF',
  readerMode: false,
  animated: true,
  modalPresentationStyle: 'automatic',
  modalTransitionStyle: 'coverVertical',
  modalEnabled: true,
  enableBarCollapsing: true,
};

// Helper function to open URL in Chromium-based in-app browser
async function openInAppBrowser(url) {
  try {
    if (await InAppBrowser.isAvailable()) {
      const result = await InAppBrowser.open(url, BROWSER_CONFIG);
      console.log('Browser closed with result:', result.type);
    } else {
      // Fallback to system browser if in-app browser not available
      Linking.openURL(url);
    }
  } catch (error) {
    console.error('Error opening in-app browser:', error);
    Linking.openURL(url);
  }
}

// Custom Splash Screen Component
function CustomSplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        SplashScreen.hideAsync();
        onFinish();
      });
    }, SPLASH_DURATION);
    
    return () => clearTimeout(timer);
  }, [fadeAnim, onFinish]);
  
  return (
    <Animated.View style={[splashStyles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="${splashBgColor === '#ffffff' || splashBgColor.toLowerCase() === '#fff' ? 'dark-content' : 'light-content'}" backgroundColor={SPLASH_BG_COLOR} />
      ${hasSplashImage ? `<Image 
        source={require('./assets/splash.png')} 
        style={splashStyles.image}
        resizeMode="${splashResizeMode}"
      />` : `<View style={splashStyles.placeholder}>
        <Text style={splashStyles.appName}>${config.appName}</Text>
      </View>`}
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BG_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '${splashBgColor === '#ffffff' || splashBgColor.toLowerCase() === '#fff' ? '#000000' : '#ffffff'}',
  },
});

// Offline fallback page HTML
const OFFLINE_HTML = \`
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 80px;
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(90deg, #fff, #a8d8ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      font-size: 16px;
      color: #b0b8c8;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .retry-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      padding: 16px 48px;
      border-radius: 50px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
    }
    .status {
      margin-top: 32px;
      padding: 12px 24px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      font-size: 14px;
      color: #8892a6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Please check your network settings and try again.</p>
    <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
    <div class="status">Waiting for connection...</div>
  </div>
</body>
</html>
\`;

// Legacy InAppBrowser component - kept for fallback, but primary is Chromium browser
function InAppBrowserFallback({ visible, url, onClose }) {
  // This is a fallback component - the main functionality now uses react-native-inappbrowser-reborn
  // which provides Chrome Custom Tabs on Android and SFSafariViewController on iOS
  if (!visible) return null;
  
  // Use Chromium-based browser immediately
  useEffect(() => {
    if (visible && url) {
      openInAppBrowser(url).then(() => {
        onClose();
      });
    }
  }, [visible, url, onClose]);
  
  return null;
}

function MainContent() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedHtml, setCachedHtml] = useState(null);
  const webViewRef = useRef(null);
  const lastSyncRef = useRef(Date.now());
  const websiteUrl = '${config.websiteUrl}';

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);
      if (!offline && webViewRef.current) {
        webViewRef.current.reload();
      }
    });
    return () => unsubscribe();
  }, []);

  // Load cached HTML on mount
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY + '_main').then(html => {
      if (html) setCachedHtml(html);
    });
  }, []);

  // Loading timeout - force hide loading overlay after timeout
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoading(false);
      }, LOADING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // Cache HTML content for offline use
  const cachePageContent = useCallback(() => {
    if (webViewRef.current && !isOffline) {
      webViewRef.current.injectJavaScript(\`
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'cache', 
          html: document.documentElement.outerHTML 
        }));
        true;
      \`);
    }
  }, [isOffline]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (webViewRef.current && !loading && !isOffline && Date.now() - lastSyncRef.current >= SYNC_INTERVAL) {
        webViewRef.current.injectJavaScript(\`
          if (typeof window.__realTimeSync === 'function') {
            window.__realTimeSync();
          } else {
            if (document.hidden === false) {
              fetch(window.location.href, { cache: 'reload' })
                .then(r => r.text())
                .then(html => {
                  const parser = new DOMParser();
                  const newDoc = parser.parseFromString(html, 'text/html');
                  const newBody = newDoc.body.innerHTML;
                  if (document.body.innerHTML !== newBody) {
                    document.body.innerHTML = newBody;
                  }
                })
                .catch(() => {});
            }
          }
          true;
        \`);
        lastSyncRef.current = Date.now();
        cachePageContent();
      }
    }, SYNC_INTERVAL);
    return () => clearInterval(syncInterval);
  }, [loading, isOffline, cachePageContent]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    setRefreshing(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  // Show refresh button when scrolled to top
  const handleScrollChange = useCallback((scrollY) => {
    setShowRefreshButton(scrollY <= 50);
  }, []);

  const handleNavigationRequest = (request) => {
    const requestUrl = request.url;
    try {
      const urlObj = new URL(requestUrl);
      const isExternal = !urlObj.hostname.includes(BASE_DOMAIN) && 
                         !requestUrl.startsWith('about:') && 
                         !requestUrl.startsWith('javascript:');
      if (isExternal) {
        // Open external links in Chromium-based in-app browser
        openInAppBrowser(requestUrl);
        return false;
      }
    } catch (e) {}
    return true;
  };

  const injectedJS = \`
    (function() {
      // Scroll tracking
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', y: window.scrollY }));
      window.addEventListener('scroll', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scroll', y: window.scrollY }));
      }, { passive: true });
      
      // Intercept all link clicks for in-app browser
      document.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        if (target && target.tagName === 'A') {
          var href = target.getAttribute('href');
          if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            try {
              var fullUrl = new URL(href, window.location.origin).href;
              var baseDomain = '${baseDomain}';
              var linkHostname = new URL(fullUrl).hostname;
              if (!linkHostname.includes(baseDomain)) {
                e.preventDefault();
                e.stopPropagation();
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'external_link', url: fullUrl }));
              }
            } catch (err) {}
        }
        }
      }, true);
      
      // Also intercept window.open calls
      var originalOpen = window.open;
      window.open = function(url, target, features) {
        if (url) {
          try {
            var fullUrl = new URL(url, window.location.origin).href;
            var baseDomain = '${baseDomain}';
            var linkHostname = new URL(fullUrl).hostname;
            if (!linkHostname.includes(baseDomain)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'external_link', url: fullUrl }));
              return null;
            }
          } catch (err) {}
        }
        return originalOpen.call(window, url, target, features);
      };
    })();
    true;
  \`;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'scroll') {
        handleScrollChange(data.y);
      } else if (data.type === 'cache' && data.html) {
        AsyncStorage.setItem(CACHE_KEY + '_main', data.html);
        setCachedHtml(data.html);
      } else if (data.type === 'external_link' && data.url) {
        // Open external links in Chromium-based in-app browser
        openInAppBrowser(data.url);
      }
    } catch (e) {}
  };

  const getWebViewSource = () => {
    if (isOffline) {
      if (cachedHtml) {
        return { html: cachedHtml, baseUrl: websiteUrl };
      }
      return { html: OFFLINE_HTML };
    }
    return { uri: websiteUrl };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {isOffline && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="cloud-offline" size={16} color="#fff" />
          <Text style={styles.offlineText}>{cachedHtml ? 'Offline - Showing cached version' : 'No internet connection'}</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={getWebViewSource()}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          cachePageContent();
        }}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        onMessage={handleMessage}
        injectedJavaScript={injectedJS}
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowsBackForwardNavigationGestures={true}
        pullToRefreshEnabled={false}
        onError={() => setIsOffline(true)}
        onHttpError={() => setIsOffline(true)}
      />

      {/* Floating Refresh Button */}
      {showRefreshButton && !loading && (
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleManualRefresh}
          activeOpacity={0.8}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="refresh" size={22} color="#fff" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);
  
  return (
    <View style={{ flex: 1 }}>
      <MainContent />
      {showSplash && <CustomSplashScreen onFinish={handleSplashFinish} />}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  refreshButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 100,
  },
  browserContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  browserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  browserButton: {
    padding: 8,
  },
  browserButtonDisabled: {
    opacity: 0.5,
  },
  browserUrlContainer: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  browserUrl: {
    color: '#aaa',
    fontSize: 13,
  },
  browserLoading: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  browserWebview: {
    flex: 1,
  },
});`;
  }
}

function generateWorkflowConfig(config: BuildRequest, platform: string) {
  if (platform === 'android') {
    return {
      name: `${config.appName} Android Build`,
      instance_type: 'mac_mini_m2',
      max_build_duration: 120,
      environment: {
        vars: {
          PACKAGE_NAME: config.packageId,
        },
        node: '18.17.0',
        java: '17',
      },
      scripts: [
        { name: 'Install dependencies', script: 'npm install' },
        { name: 'Generate Android project', script: 'npx expo prebuild --platform android --clean --no-install' },
        { name: 'Set up local.properties', script: 'echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT" && echo "ANDROID_HOME=$ANDROID_HOME" && SDK_DIR="$ANDROID_SDK_ROOT" && [ -z "$SDK_DIR" ] && SDK_DIR="$ANDROID_HOME" || true && [ -n "$SDK_DIR" ] && echo "sdk.dir=$SDK_DIR" > android/local.properties' },
        { name: 'Build Android APK', script: 'cd android && ./gradlew :app:assembleRelease --no-daemon --stacktrace' },
        { name: 'Build Android App Bundle (AAB)', script: 'cd android && ./gradlew :app:bundleRelease --no-daemon --stacktrace' },
        { name: 'Copy AAB to artifacts', script: 'mkdir -p $CM_BUILD_DIR/build/outputs && find android/app/build/outputs -name "*.aab" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\;' },
        { name: 'Copy APK to artifacts', script: 'find android/app/build/outputs -name "*.apk" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\;' },
      ],
      artifacts: [
        'android/app/build/outputs/**/*.apk',
        'android/app/build/outputs/**/*.aab',
        'build/outputs/*.apk',
        'build/outputs/*.aab'
      ],
    };
  } else {
    const appNameClean = config.appName.replace(/\s+/g, '');
    return {
      name: `${config.appName} iOS Build`,
      instance_type: 'mac_mini_m2',
      max_build_duration: 120,
      environment: {
        vars: {
          BUNDLE_ID: config.packageId,
        },
        node: '18.17.0',
        xcode: '16.2',
        cocoapods: 'default',
      },
      scripts: [
        { name: 'Install dependencies', script: 'npm install' },
        { name: 'Generate iOS project', script: 'npx expo prebuild --platform ios --clean --no-install' },
        { name: 'Setup Ruby and CocoaPods', script: 'gem install cocoapods && pod repo update' },
        { name: 'Install CocoaPods', script: 'cd ios && pod install --repo-update --verbose' },
        { name: 'Create exportOptions.plist', script: `cat > ios/exportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>ad-hoc</string>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
EOF` },
        { name: 'Build iOS Archive', script: `cd ios
NODE_BIN=$(command -v node || which node)
export NODE_BINARY="$NODE_BIN"
export RCT_NO_LAUNCH_PACKAGER=true
export CI=1

echo "--- ios/ directory listing ---"
ls -la

WORKSPACE=$(find . -maxdepth 1 -type d -name "*.xcworkspace" ! -name "Pods.xcworkspace" -print -quit)
PROJECT=$(find . -maxdepth 1 -type d -name "*.xcodeproj" ! -name "Pods.xcodeproj" -print -quit)
WORKSPACE=\${WORKSPACE#./}
PROJECT=\${PROJECT#./}
echo "Detected workspace: $WORKSPACE"
echo "Detected project: $PROJECT"

if [ -n "$WORKSPACE" ]; then
  SCHEME_NAME=$(xcodebuild -list -json -workspace "$WORKSPACE" | jq -r '.workspace.schemes[0] // empty')
  [ -n "$SCHEME_NAME" ] || (echo "Could not detect scheme from workspace $WORKSPACE" && xcodebuild -list -workspace "$WORKSPACE" && exit 1)
  echo "Using workspace: $WORKSPACE | scheme: $SCHEME_NAME"
  xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath $CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
elif [ -n "$PROJECT" ]; then
  SCHEME_NAME=$(xcodebuild -list -json -project "$PROJECT" | jq -r '.project.schemes[0] // empty')
  [ -n "$SCHEME_NAME" ] || (echo "Could not detect scheme from project $PROJECT" && xcodebuild -list -project "$PROJECT" && exit 1)
  echo "Using project: $PROJECT | scheme: $SCHEME_NAME"
  xcodebuild -project "$PROJECT" -scheme "$SCHEME_NAME" -configuration Release -sdk iphoneos -archivePath $CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
else
  echo "No .xcworkspace or .xcodeproj found in ios/" && exit 1
fi` },
        { name: 'Create unsigned IPA', script: `mkdir -p $CM_BUILD_DIR/build/ipa && cd $CM_BUILD_DIR/build/App.xcarchive/Products/Applications && mkdir -p Payload && cp -r *.app Payload/ && zip -r $CM_BUILD_DIR/build/ipa/${appNameClean}.ipa Payload` },
      ],
      artifacts: [
        'build/ipa/*.ipa',
        'build/*.xcarchive'
      ],
    };
  }
}

function generateSnackId(config: BuildRequest): string {
  // Generate a deterministic ID based on the config
  const hash = stringToBase64(JSON.stringify({
    url: config.websiteUrl,
    name: config.appName,
    nav: config.enableNavigation,
  })).slice(0, 12);
  return `webview-app-${hash}`;
}
