import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.getyere.app',
  appName: 'Yere',
  webDir: 'dist',
  backgroundColor: '#0e1220',
  ios: {
    scheme: 'Yere',
    contentInset: 'automatic',
    backgroundColor: '#0e1220',
    preferredContentMode: 'mobile',
    allowsLinkPreview: true,
    handleApplicationNotifications: true
  },
  android: {
    backgroundColor: '#0e1220',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    buildOptions: {
      releaseType: 'AAB'
    }
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor'
  },
  plugins: {
    App: {
      disableBackButtonHandler: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#0e1220',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0e1220'
    }
  }
};

export default config;
