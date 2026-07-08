import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.beyondthehorizons.vhapp',
  appName: 'Beyond the Horizons',
  // webDir points to the offline-fallback bundle; the live app loads from server.url below.
  webDir: 'mobile/www',
  server: {
    // Always load the production site — this is a remote-shell (WebView) app.
    url: 'https://www.vh-beyondthehorizons.org/vocab',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F0F0F',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0F0F0F',
      showSpinner: false,
    },
  },
};

export default config;
