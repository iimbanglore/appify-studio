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
          branch: 'main',
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
          branch: 'main',
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

    // 1. package.json
    const packageJson = {
      name: "webview-app-template",
      version: "1.0.0",
      main: "node_modules/expo/AppEntry.js",
      scripts: {
        start: "expo start",
        android: "expo start --android",
        ios: "expo start --ios",
        web: "expo start --web"
      },
      dependencies: {
        "expo": "~50.0.0",
        "expo-status-bar": "~1.11.1",
        "react": "18.2.0",
        "react-native": "0.73.2",
        "react-native-webview": "13.6.4",
        "@react-navigation/native": "^6.1.9",
        "@react-navigation/bottom-tabs": "^6.5.11",
        "react-native-screens": "~3.29.0",
        "react-native-safe-area-context": "4.8.2",
        "@expo/vector-icons": "^14.0.0"
      },
      devDependencies: {
        "@babel/core": "^7.20.0"
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

    // 3. App.js (template)
    const appJs = `import React from 'react';
import { StatusBar, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const WEBSITE_URL = 'https://example.com';

function WebViewScreen({ url = WEBSITE_URL }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return <WebViewScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  webview: {
    flex: 1,
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

    // 6. codemagic.yaml
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
      java: 17
    scripts:
      - name: Install dependencies
        script: npm install
      - name: Install Expo CLI
        script: npm install -g expo-cli eas-cli
      - name: Generate native projects
        script: npx expo prebuild --platform android --clean
      - name: Set up local.properties
        script: echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties
      - name: Build Android
        script: |
          cd android
          ./gradlew assembleRelease
    artifacts:
      - android/app/build/outputs/**/*.apk
    publishing:
      email:
        recipients:
          - your-email@example.com
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
        - ios_credentials
      vars:
        BUNDLE_ID: com.app.webview
      node: 18.17.0
      xcode: latest
      cocoapods: default
    scripts:
      - name: Install dependencies
        script: npm install
      - name: Install Expo CLI
        script: npm install -g expo-cli eas-cli
      - name: Generate native projects
        script: npx expo prebuild --platform ios --clean
      - name: Install CocoaPods
        script: |
          cd ios
          pod install
      - name: Build iOS
        script: |
          cd ios
          xcodebuild -workspace *.xcworkspace -scheme App -configuration Release -archivePath build/App.xcarchive archive
    artifacts:
      - ios/build/**/*.ipa
    publishing:
      email:
        recipients:
          - your-email@example.com
        notify:
          success: true
          failure: true`;
    results['codemagic.yaml'] = await createGitHubFile('codemagic.yaml', codemagicYaml, 'Add codemagic.yaml');

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
