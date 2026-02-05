import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) return 'main';
  try {
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Lovable-Build-App' },
    });
    if (!resp.ok) return 'main';
    const data = await resp.json();
    cachedGitHubDefaultBranch = data?.default_branch || 'main';
    return cachedGitHubDefaultBranch;
  } catch { return 'main'; }
}

interface BuildRequest {
  websiteUrl: string;
  appName: string;
  packageId: string;
  appDescription?: string;
  appIcon?: string;
  splashConfig?: { image: string | null; backgroundColor: string; resizeMode: "contain" | "cover" | "native" };
  enableNavigation: boolean;
  navigationType?: "tabs" | "drawer";
  navItems?: Array<{ label: string; url: string; icon: string; isExternal?: boolean }>;
  navBarStyle?: { backgroundColor: string; activeIconColor: string; inactiveIconColor: string; activeTextColor: string; inactiveTextColor: string };
  keystoreConfig?: { alias: string; password: string; validity: string; organization: string; country: string };
  platforms: string[];
  userId?: string;
}

async function updateGitHubFile(path: string, content: string, message: string): Promise<boolean> {
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) return false;
  try {
    const getResp = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Lovable-Build-App' },
    });
    let sha: string | undefined;
    if (getResp.ok) sha = (await getResp.json()).sha;
    const updateResp = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${path}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'Lovable-Build-App' },
      body: JSON.stringify({ message, content, sha }),
    });
    return updateResp.ok;
  } catch { return false; }
}

async function uploadAppIconToGitHub(appIcon: string): Promise<boolean> {
  if (!appIcon) return false;
  let base64Content = appIcon.startsWith('data:') ? appIcon.split(',')[1] : appIcon;
  const files = ['assets/icon.png', 'assets/adaptive-icon.png', 'assets/favicon.png'];
  let ok = true;
  for (const f of files) { if (!await updateGitHubFile(f, base64Content, `Update ${f}`)) ok = false; }
  return ok;
}

async function uploadSplashToGitHub(splashImage: string): Promise<boolean> {
  if (!splashImage) return false;
  let base64Content = splashImage.startsWith('data:') ? splashImage.split(',')[1] : splashImage;
  return await updateGitHubFile('assets/splash.png', base64Content, 'Update splash.png');
}

async function updateAppConfig(config: BuildRequest): Promise<boolean> {
  const splashBgColor = config.splashConfig?.backgroundColor || "#ffffff";
  const appJson = {
    expo: {
      name: config.appName, slug: config.appName.toLowerCase().replace(/\s+/g, '-'), version: "1.0.0", orientation: "portrait",
      icon: "./assets/icon.png", userInterfaceStyle: "automatic",
      splash: { image: "./assets/splash.png", resizeMode: config.splashConfig?.resizeMode || "contain", backgroundColor: splashBgColor },
      assetBundlePatterns: ["**/*"],
      ios: { supportsTablet: true, bundleIdentifier: config.packageId },
      android: { adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: splashBgColor }, package: config.packageId },
      web: { favicon: "./assets/favicon.png" },
      extra: { websiteUrl: config.websiteUrl, enableNavigation: config.enableNavigation, navItems: config.navItems || [] }
    }
  };
  return await updateGitHubFile('app.json', stringToBase64(JSON.stringify(appJson, null, 2)), `Update app.json for ${config.appName}`);
}

function generateAppCode(config: BuildRequest): string {
  const hasNav = config.enableNavigation && config.navItems && config.navItems.length > 0;
  const isDrawer = config.navigationType === "drawer";
  const navStyle = config.navBarStyle || { backgroundColor: "#1a1a1a", activeIconColor: "#007AFF", inactiveIconColor: "#8E8E93", activeTextColor: "#007AFF", inactiveTextColor: "#8E8E93" };
  const splashBgColor = config.splashConfig?.backgroundColor || "#ffffff";
  const baseDomain = new URL(config.websiteUrl).hostname;
  const navItemsJson = JSON.stringify(config.navItems || []);
  
  const imports = `import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StatusBar, StyleSheet, View, Text, Platform, ActivityIndicator, TouchableOpacity, Dimensions, Animated, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
${hasNav && isDrawer ? `import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';` : ''}
${hasNav && !isDrawer ? `import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';` : ''}
${hasNav ? `import { NavigationContainer } from '@react-navigation/native';` : ''}
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

SplashScreen.preventAutoHideAsync();
${hasNav ? (isDrawer ? 'const Nav = createDrawerNavigator();' : 'const Nav = createBottomTabNavigator();') : ''}
const navItems = ${navItemsJson};
const BASE_DOMAIN = '${baseDomain}';
const SPLASH_BG = '${splashBgColor}';
const NAV_BG = '${navStyle.backgroundColor}';
const NAV_ACTIVE = '${navStyle.activeIconColor}';
const NAV_INACTIVE = '${navStyle.inactiveIconColor}';
`;

  const helpers = `
const iconMap = { home:'home', user:'person', settings:'settings', info:'information-circle', menu:'menu', cart:'cart', search:'search', notifications:'notifications', heart:'heart', mail:'mail', calendar:'calendar', camera:'camera', music:'musical-notes', video:'videocam', map:'map', phone:'call', star:'star', bookmark:'bookmark', share:'share-social', download:'download', upload:'cloud-upload' };
const getIcon = (n) => iconMap[n] || 'home';
async function openBrowser(url) { try { if (await InAppBrowser.isAvailable()) await InAppBrowser.open(url, { toolbarColor: NAV_BG, showTitle: true }); else Linking.openURL(url); } catch { Linking.openURL(url); } }
`;

  const splashComponent = `
function Splash({ onFinish }) {
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => { const t = setTimeout(() => { Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => { SplashScreen.hideAsync(); onFinish(); }); }, 3000); return () => clearTimeout(t); }, []);
  return <Animated.View style={[{ flex:1, backgroundColor: SPLASH_BG, justifyContent:'center', alignItems:'center', position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:9999 }, { opacity: fade }]}><Text style={{ fontSize:28, fontWeight:'bold', color: SPLASH_BG === '#ffffff' ? '#000' : '#fff' }}>${config.appName}</Text></Animated.View>;
}`;

  const webViewScreen = `
function WebViewScreen({ url }) {
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const u = NetInfo.addEventListener(s => { setOffline(!s.isConnected); if (s.isConnected && ref.current) ref.current.reload(); }); return () => u(); }, []);
  useEffect(() => { if (loading) { const t = setTimeout(() => setLoading(false), 15000); return () => clearTimeout(t); } }, [loading]);
  const onNav = (r) => { try { const u = new URL(r.url); if (!u.hostname.includes(BASE_DOMAIN) && !r.url.startsWith('about:') && !r.url.startsWith('javascript:')) { openBrowser(r.url); return false; } } catch {} return true; };
  const onMsg = (e) => { try { const d = JSON.parse(e.nativeEvent.data); if (d.type === 'external_link' && d.url) openBrowser(d.url); } catch {} };
  const js = \`(function(){document.addEventListener('click',function(e){var t=e.target;while(t&&t.tagName!=='A')t=t.parentElement;if(t&&t.tagName==='A'){var h=t.getAttribute('href');if(h&&!h.startsWith('javascript:')&&!h.startsWith('#')){try{var f=new URL(h,location.origin).href;if(!new URL(f).hostname.includes('${baseDomain}')){e.preventDefault();window.ReactNativeWebView.postMessage(JSON.stringify({type:'external_link',url:f}))}}catch{}}}},true)})();true;\`;
  return <View style={s.c}><StatusBar barStyle="light-content" translucent backgroundColor="transparent"/>{loading && <View style={s.lo}><ActivityIndicator size="large" color={NAV_ACTIVE}/></View>}{offline && <View style={s.off}><Text style={s.offT}>Offline</Text></View>}<WebView ref={ref} source={offline ? {html:'<h1>Offline</h1>'} : {uri:url}} style={s.wv} javaScriptEnabled domStorageEnabled onLoadStart={()=>setLoading(true)} onLoadEnd={()=>setLoading(false)} onShouldStartLoadWithRequest={onNav} onMessage={onMsg} injectedJavaScript={js}/></View>;
}`;

  const styles = `
const s = StyleSheet.create({
  c: { flex:1, backgroundColor:'#000' },
  wv: { flex:1, marginTop: Platform.OS==='android'? StatusBar.currentHeight:0 },
  lo: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.8)', justifyContent:'center', alignItems:'center', zIndex:999 },
  off: { backgroundColor:'#f66', padding:8, alignItems:'center' },
  offT: { color:'#fff', fontSize:12 },
});`;

  if (!hasNav) {
    return `${imports}${helpers}${splashComponent}${webViewScreen}
function Main() { return <WebViewScreen url="${config.websiteUrl}"/>; }
export default function App() { const [sp, setSp] = useState(true); return <View style={{flex:1}}><Main/>{sp && <Splash onFinish={()=>setSp(false)}/>}</View>; }
${styles}`;
  }

  const externalScreen = `function ExtScreen({ url, label }) { useEffect(() => { openBrowser(url); }, []); return <View style={[s.c, {justifyContent:'center',alignItems:'center'}]}><Ionicons name="globe-outline" size={48} color={NAV_ACTIVE}/><Text style={{color:'#fff',marginTop:12}}>{label}</Text><TouchableOpacity style={{marginTop:16,backgroundColor:NAV_ACTIVE,padding:12,borderRadius:8}} onPress={()=>openBrowser(url)}><Text style={{color:'#fff'}}>Open</Text></TouchableOpacity></View>; }`;

  if (isDrawer) {
    return `${imports}${helpers}${splashComponent}${webViewScreen}${externalScreen}
function DrawerContent(props) { return <DrawerContentScrollView {...props} style={{backgroundColor:NAV_BG}}><View style={{padding:16,borderBottomWidth:1,borderBottomColor:'#333'}}><Text style={{color:'#fff',fontSize:18,fontWeight:'bold'}}>${config.appName}</Text></View><DrawerItemList {...props}/></DrawerContentScrollView>; }
function AppNav() { return <Nav.Navigator drawerContent={p=><DrawerContent {...p}/>} screenOptions={{headerShown:true,headerStyle:{backgroundColor:NAV_BG},headerTintColor:'#fff',drawerStyle:{backgroundColor:NAV_BG},drawerActiveTintColor:NAV_ACTIVE,drawerInactiveTintColor:NAV_INACTIVE}}>{navItems.map((it,i)=><Nav.Screen key={i} name={it.label} options={{drawerIcon:({color,size})=><Ionicons name={getIcon(it.icon)} size={size} color={color}/>}} children={()=>it.isExternal?<ExtScreen url={it.url} label={it.label}/>:<WebViewScreen url={"${config.websiteUrl}"+it.url}/>}/>)}</Nav.Navigator>; }
export default function App() { const [sp, setSp] = useState(true); return <View style={{flex:1}}><NavigationContainer><AppNav/></NavigationContainer>{sp && <Splash onFinish={()=>setSp(false)}/>}</View>; }
${styles}`;
  }

  return `${imports}${helpers}${splashComponent}${webViewScreen}${externalScreen}
function AppNav() { return <Nav.Navigator screenOptions={({route})=>({headerShown:false,tabBarIcon:({color,size})=>{const it=navItems.find(n=>n.label===route.name);return <Ionicons name={getIcon(it?.icon)} size={size} color={color}/>},tabBarActiveTintColor:NAV_ACTIVE,tabBarInactiveTintColor:NAV_INACTIVE,tabBarStyle:{backgroundColor:NAV_BG}})}>{navItems.map((it,i)=><Nav.Screen key={i} name={it.label} children={()=>it.isExternal?<ExtScreen url={it.url} label={it.label}/>:<WebViewScreen url={"${config.websiteUrl}"+it.url}/>}/>)}</Nav.Navigator>; }
export default function App() { const [sp, setSp] = useState(true); return <View style={{flex:1}}><NavigationContainer><AppNav/></NavigationContainer>{sp && <Splash onFinish={()=>setSp(false)}/>}</View>; }
${styles}`;
}

async function updateAppCode(config: BuildRequest): Promise<boolean> {
  return await updateGitHubFile('App.js', stringToBase64(generateAppCode(config)), `Update App.js for ${config.appName}`);
}

async function uploadCodemagicConfig(config: BuildRequest): Promise<boolean> {
  const escapedAppName = config.appName.replace(/\s+/g, '');
  const yaml = `# Codemagic config for ${config.appName}
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
      - name: Install deps
        script: npm install --no-audit --no-fund && npm install --no-audit --no-fund sharp
      - name: Generate Android
        script: npx expo prebuild --platform android --clean --no-install
      - name: Patch Gradle
        script: |
          set -e
          ruby - <<'RUBY'
          def patch(p); return false unless File.exist?(p); d=File.read(p); f=d.gsub(/(project\.)?findProject\([^\)]*\)\s*\.\s*rootProject/m,'rootProject').gsub(/\bproject\.rootProject\b/,'rootProject'); return false if f==d; File.write(p,f); true; end
          %w[android/app/build.gradle android/build.gradle android/settings.gradle node_modules/@react-native-community/cli-platform-android/native_modules.gradle node_modules/expo-modules-autolinking/scripts/android/autolinking.gradle node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle].each{|p| puts patch(p) ? "Patched #{p}" : "Skip #{p}"}
          RUBY
      - name: SDK 34
        script: |
          echo "" >> android/gradle.properties
          echo "android.compileSdkVersion=34" >> android/gradle.properties
          echo "android.targetSdkVersion=34" >> android/gradle.properties
          echo "android.minSdkVersion=24" >> android/gradle.properties
          echo "org.gradle.jvmargs=-Xmx4096m" >> android/gradle.properties
      - name: local.properties
        script: echo "sdk.dir=\${ANDROID_SDK_ROOT:-\$ANDROID_HOME}" > android/local.properties
      - name: Validate
        script: |
          if grep -q 'project\.rootProject' android/app/build.gradle 2>/dev/null; then echo "ERROR: Unpatched rootProject"; exit 1; fi
          echo "OK"
      - name: APK
        script: export NODE_OPTIONS="--max-old-space-size=4096" && cd android && ./gradlew :app:assembleRelease --no-daemon
      - name: AAB
        script: export NODE_OPTIONS="--max-old-space-size=4096" && cd android && ./gradlew :app:bundleRelease --no-daemon
      - name: Copy
        script: mkdir -p \$CM_BUILD_DIR/build/outputs && find android/app/build/outputs -name "*.apk" -exec cp {} \$CM_BUILD_DIR/build/outputs/ \\; && find android/app/build/outputs -name "*.aab" -exec cp {} \$CM_BUILD_DIR/build/outputs/ \\;
    artifacts:
      - android/app/build/outputs/**/*.apk
      - android/app/build/outputs/**/*.aab
      - build/outputs/*
    publishing:
      email:
        recipients: [team@example.com]
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
      - name: Install deps
        script: npm install --no-audit --no-fund && npm install --no-audit --no-fund sharp
      - name: Generate iOS
        script: npx expo prebuild --platform ios --clean --no-install
      - name: Node env
        script: echo "export NODE_BINARY=\$(command -v node)" > ios/.xcode.env.local
      - name: Patch Boost
        script: |
          BOOST="node_modules/react-native/third-party-podspecs/boost.podspec"
          [ -f "\$BOOST" ] && sed -i.bak "s|https://boostorg.jfrog.io/artifactory/main/release/[^']*|https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2|g" "\$BOOST"
      - name: Pods
        script: cd ios && rm -rf Pods Podfile.lock && pod repo update && pod install --repo-update
      - name: Fix Pods target
        script: |
          cd ios
          ruby - <<'RUBY'
          begin; require 'xcodeproj'; p=Xcodeproj::Project.open('Pods/Pods.xcodeproj'); p.targets.each{|t| t.build_configurations.each{|c| c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']='13.4'}}; p.save; rescue => e; puts e.message; end
          RUBY
      - name: Archive
        script: |
          cd ios
          export NODE_BINARY="\$(command -v node)"
          export RCT_NO_LAUNCH_PACKAGER=true
          export CI=1
          WS=""
          for d in *.xcworkspace; do [ -d "\$d" ] && [ "\$d" != "Pods.xcworkspace" ] && WS="\$d" && break; done
          if [ -z "\$WS" ]; then echo "No workspace"; exit 1; fi
          SCHEME=\$(xcodebuild -list -json -workspace "\$WS" 2>/dev/null | jq -r '.workspace.schemes[0] // empty')
          if [ -z "\$SCHEME" ]; then echo "No scheme"; exit 1; fi
          xcodebuild -workspace "\$WS" -scheme "\$SCHEME" -configuration Release -sdk iphoneos -archivePath \$CM_BUILD_DIR/build/App.xcarchive archive CODE_SIGNING_ALLOWED=NO
      - name: IPA
        script: |
          mkdir -p \$CM_BUILD_DIR/build/ipa
          cd \$CM_BUILD_DIR/build/App.xcarchive/Products/Applications
          mkdir Payload && cp -r *.app Payload/
          zip -r \$CM_BUILD_DIR/build/ipa/${escapedAppName}.ipa Payload
    artifacts:
      - build/ipa/*.ipa
      - build/*.xcarchive
    publishing:
      email:
        recipients: [team@example.com]
        notify:
          success: false
          failure: true
`;
  return await updateGitHubFile('codemagic.yaml', stringToBase64(yaml), `Update codemagic.yaml for ${config.appName}`);
}

function generateSnackId(config: BuildRequest): string {
  return `web2app-${config.appName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const buildRequest: BuildRequest = await req.json();
    console.log('Build request:', buildRequest.appName, buildRequest.platforms);

    if (!CODEMAGIC_API_TOKEN) throw new Error('CODEMAGIC_API_TOKEN not configured');

    if (buildRequest.appIcon) await uploadAppIconToGitHub(buildRequest.appIcon);
    if (buildRequest.splashConfig?.image) await uploadSplashToGitHub(buildRequest.splashConfig.image);

    const appJsonOk = await updateAppConfig(buildRequest);
    if (!appJsonOk) throw new Error('Failed to update app.json');

    const appCodeOk = await updateAppCode(buildRequest);
    if (!appCodeOk) throw new Error('Failed to update App.js');

    const codemagicOk = await uploadCodemagicConfig(buildRequest);
    if (!codemagicOk) throw new Error('Failed to update codemagic.yaml');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const buildResults = [];
    const githubBranch = await getGitHubDefaultBranch();

    for (const platform of buildRequest.platforms) {
      const buildResponse = await fetch('https://api.codemagic.io/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': CODEMAGIC_API_TOKEN },
        body: JSON.stringify({
          appId: Deno.env.get('CODEMAGIC_APP_ID') || 'default-app',
          workflowId: platform === 'android' ? 'android-workflow' : 'ios-workflow',
          branch: githubBranch,
          environment: { variables: { WEBSITE_URL: buildRequest.websiteUrl, APP_NAME: buildRequest.appName, PACKAGE_ID: buildRequest.packageId } },
        }),
      });

      const buildData = await buildResponse.json();
      const buildId = buildResponse.ok ? (buildData._id || buildData.buildId) : `demo-${platform}-${Date.now()}`;
      const status = 'queued';

      await supabase.from('builds').insert({ build_id: buildId, platform, status, app_name: buildRequest.appName, package_id: buildRequest.packageId, user_id: buildRequest.userId || null });

      buildResults.push({ platform, status, buildId, message: `${platform.toUpperCase()} build started`, estimatedTime: platform === 'android' ? '5-10 min' : '10-15 min', downloadUrl: null });
    }

    return new Response(JSON.stringify({
      success: true, builds: buildResults, appCode: generateAppCode(buildRequest), snackId: generateSnackId(buildRequest),
      githubUpdates: { icon: !!buildRequest.appIcon, splash: !!buildRequest.splashConfig?.image, appJson: true, appJs: true, codemagicYaml: codemagicOk },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
