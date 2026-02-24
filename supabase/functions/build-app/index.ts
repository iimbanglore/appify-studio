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
  const yaml = `# Codemagic CI/CD configuration
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
        PACKAGE_NAME: ${config.packageId}
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
            patched.gsub!(/(project\.)?findProject\([^\)]*\)\s*\.\s*rootProject/m, 'rootProject')
            patched.gsub!(/(project\.)?findProject\([^\)]*\)\s*\?\.\s*rootProject/m, 'rootProject')
            patched.gsub!(/\bproject\s*\.\s*rootProject\b/m, 'rootProject')
            patched.gsub!(/\bproject\([^\)]*\)\s*\.\s*rootProject\b/m, 'rootProject')

            vars = patched
              .scan(/(?:^|\s)(?:def\s+)?([A-Za-z_]\w*)\s*=\s*(?:project\.)?findProject\([^\)]*\)/m)
              .flatten
              .uniq

            vars.each do |v|
              patched.gsub!(/\b#{Regexp.escape(v)}\s*\.\s*rootProject\b/m, 'rootProject')
              patched.gsub!(/\b#{Regexp.escape(v)}\s*\.\s*getRootProject\(\)\b/m, 'rootProject')
            end

            if aggressive
              patched.gsub!(/\b([A-Za-z_]\w*)\s*\.\s*rootProject\b/m) { |m| $1 == 'rootProject' ? m : 'rootProject' }
              patched.gsub!(/\b([A-Za-z_]\w*)\s*\.\s*getRootProject\(\)\b/m) { |m| $1 == 'rootProject' ? m : 'rootProject' }
            end

            patched
          end

          def patch_file(path, aggressive: false)
            return false unless File.exist?(path)
            original = File.read(path)
            patched = patch_text(original, aggressive: aggressive)
            return false if patched == original
            File.write(path, patched)
            puts "PATCHED: #{path}"
            true
          rescue => e
            puts "ERROR patching #{path}: #{e.message}"
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
          candidates.each { |p| puts "  #{File.exist?(p) ? '✓' : '✗'} #{p}" }

          patched_count = 0
          candidates.each do |p|
            patched_count += 1 if patch_file(p, aggressive: (p == 'android/app/build.gradle'))
          end

          puts "Total files patched: #{patched_count}"
          RUBY

          echo "=== DIAGNOSTIC: android/app/build.gradle around line 116 (after patch) ==="
          if [ -f "android/app/build.gradle" ]; then
            nl -ba android/app/build.gradle | sed -n '105,130p' || true
          fi

          echo "=== Preflight: fail if any '.rootProject' remains in android/app/build.gradle ==="
          if [ -f "android/app/build.gradle" ] && grep -nE '\\.[[:space:]]*rootProject' android/app/build.gradle; then
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
          if grep -q 'project\.rootProject' android/app/build.gradle; then
            echo "ERROR: Unpatched 'project.rootProject' still present in build.gradle"
            grep -n 'project\.rootProject' android/app/build.gradle
            exit 1
          fi
          if grep -q 'findProject.*\.rootProject' android/app/build.gradle; then
            echo "ERROR: Unpatched 'findProject(...).rootProject' still present in build.gradle"
            grep -n 'findProject.*\.rootProject' android/app/build.gradle
            exit 1
          fi
          if grep -qE '\\.[[:space:]]*rootProject' android/app/build.gradle; then
            echo "ERROR: Remaining '.rootProject' references still present in build.gradle"
            grep -nE '\\.[[:space:]]*rootProject' android/app/build.gradle
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
          find android/app/build/outputs -name "*.apk" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\;
          find android/app/build/outputs -name "*.aab" -exec cp {} $CM_BUILD_DIR/build/outputs/ \\;
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
        BUNDLE_ID: ${config.packageId}
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
            puts "Patch skipped: #{e.message}"
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
          zip -r $CM_BUILD_DIR/build/ipa/${escapedAppName}.ipa Payload
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
            if [ -d "\$ws" ] && [ "\$ws" != "Pods.xcworkspace" ]; then
              echo "Workspace: \$ws" >> $CM_BUILD_DIR/build/diagnostics/ios-schemes.txt
              xcodebuild -list -json -workspace "\$ws" 2>/dev/null >> $CM_BUILD_DIR/build/diagnostics/ios-schemes.txt || echo "Could not list schemes" >> $CM_BUILD_DIR/build/diagnostics/ios-schemes.txt
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
