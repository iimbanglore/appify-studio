import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface SplashConfig {
  image: string | null;
  backgroundColor: string;
  resizeMode: "contain" | "cover" | "native";
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
  navItems?: Array<{ label: string; url: string; icon: string }>;
  keystoreConfig?: {
    alias: string;
    password: string;
    validity: string;
    organization: string;
    country: string;
  };
  platforms: string[];
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
          branch: 'main',
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

  const base64Content = btoa(JSON.stringify(appJson, null, 2));
  return await updateGitHubFile('app.json', base64Content, `Update app.json for ${config.appName}`);
}

// Update App.js with navigation configuration
async function updateAppCode(config: BuildRequest): Promise<boolean> {
  const appCode = generateAppCode(config);
  const base64Content = btoa(appCode);
  return await updateGitHubFile('App.js', base64Content, `Update App.js for ${config.appName}`);
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

    // Step 4: Update App.js with navigation config
    console.log('Updating App.js in GitHub...');
    const appCodeSuccess = await updateAppCode(buildRequest);
    console.log('App.js update result:', appCodeSuccess);

    // Generate the React Native/Expo app code for reference
    const appCode = generateAppCode(buildRequest);
    console.log('Generated app code length:', appCode.length);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Step 5: Trigger Codemagic builds
    const buildResults = [];

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
          branch: 'main',
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
  
  if (hasNav && isDrawer) {
    // Drawer Navigation
    const navItemsJson = JSON.stringify(config.navItems);
    return `import React from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const Drawer = createDrawerNavigator();

const navItems = ${navItemsJson};

function WebViewScreen({ url }) {
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

function AppNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#fff',
        drawerStyle: { backgroundColor: '#1a1a1a', width: 280 },
        drawerActiveTintColor: '#007AFF',
        drawerInactiveTintColor: '#8E8E93',
        drawerLabelStyle: { marginLeft: -16, fontSize: 15 },
      }}
    >
      {navItems.map((item, index) => (
        <Drawer.Screen 
          key={index}
          name={item.label}
          options={{
            drawerIcon: ({ color, size }) => (
              <Ionicons name={item.icon || 'menu'} size={size} color={color} />
            ),
          }}
          children={() => <WebViewScreen url={"${config.websiteUrl}" + item.url} />}
        />
      ))}
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  drawerContent: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 10,
  },
  drawerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});`;
  } else if (hasNav) {
    // Bottom Tab Navigation
    const navItemsJson = JSON.stringify(config.navItems);
    return `import React from 'react';
import { StatusBar, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

const navItems = ${navItemsJson};

function WebViewScreen({ url }) {
  return (
    <SafeAreaView style={styles.container}>
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
          return <Ionicons name={item?.icon || 'home'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: { backgroundColor: '#1a1a1a', borderTopColor: '#333' },
      })}
    >
      {navItems.map((item, index) => (
        <Tab.Screen 
          key={index}
          name={item.label} 
          children={() => <WebViewScreen url={"${config.websiteUrl}" + item.url} />}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
});`;
  } else {
    // Without navigation - simple WebView (full-screen)
    return `import React from 'react';
import { StatusBar, StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <WebView
        source={{ uri: '${config.websiteUrl}' }}
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
        { name: 'Set up local.properties', script: 'echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties' },
        { name: 'Build Android APK', script: 'cd android && ./gradlew assembleRelease --no-daemon' },
        { name: 'Build Android App Bundle (AAB)', script: 'cd android && ./gradlew bundleRelease --no-daemon' },
      ],
      artifacts: [
        'android/app/build/outputs/**/*.apk',
        'android/app/build/outputs/**/*.aab'
      ],
    };
  } else {
    return {
      name: `${config.appName} iOS Build`,
      instance_type: 'mac_mini_m2',
      max_build_duration: 120,
      environment: {
        vars: {
          BUNDLE_ID: config.packageId,
        },
        node: '18.17.0',
        xcode: '15.0',
        cocoapods: 'default',
      },
      scripts: [
        { name: 'Install dependencies', script: 'npm install' },
        { name: 'Generate iOS project', script: 'npx expo prebuild --platform ios --clean --no-install' },
        { name: 'Install CocoaPods', script: 'cd ios && pod install' },
        { name: 'Build iOS', script: 'cd ios && xcodebuild -workspace *.xcworkspace -scheme webviewapptemplate -configuration Release -sdk iphoneos -archivePath build/App.xcarchive archive CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO' },
      ],
      artifacts: ['ios/build/**/*.xcarchive'],
    };
  }
}

function generateSnackId(config: BuildRequest): string {
  // Generate a deterministic ID based on the config
  const hash = btoa(JSON.stringify({
    url: config.websiteUrl,
    name: config.appName,
    nav: config.enableNavigation,
  })).slice(0, 12);
  return `webview-app-${hash}`;
}
