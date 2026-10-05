import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';

  // Local runs (expo start / expo run) stay lenient so a developer can iterate without keys.
  // Any EAS build, in any profile, must resolve config from the build environment.
  const easProfile = process.env.EAS_BUILD_PROFILE;
  if (easProfile) {
    const missing = [
      !apiUrl && 'EXPO_PUBLIC_API_URL',
      easProfile === 'production' && !apiUrl.startsWith('https://') && 'EXPO_PUBLIC_API_URL (HTTPS required)',
      !googleMapsApiKey && 'GOOGLE_MAPS_API_KEY'
    ].filter(Boolean);
    if (missing.length) throw new Error(`The "${easProfile}" EAS build requires ${missing.join(' and ')}.`);
  }

  return {
    ...config,
    name: 'CareConnect',
    slug: 'careconnect-mobile',
    scheme: 'careconnect',
    version: '1.0.0',
    orientation: 'portrait',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.careconnect.nurses',
      supportsTablet: true,
      config: { ...config.ios?.config, usesNonExemptEncryption: false }
    },
    android: {
      ...config.android,
      package: 'com.careconnect.nurses'
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      ['expo-sqlite', { useSQLCipher: true }],
      ['expo-image-picker', {
        photosPermission: 'Allow CareConnect to use a photo you choose for your profile.',
        cameraPermission: false,
        microphonePermission: false
      }],
      ['expo-location', {
        locationWhenInUsePermission: 'Allow CareConnect to share your live location during an active appointment.',
        locationAlwaysAndWhenInUsePermission: 'Allow CareConnect to continue sharing your location during an appointment when you switch apps.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true
      }],
      ['react-native-maps', { androidGoogleMapsApiKey: googleMapsApiKey }]
    ],
    experiments: { ...config.experiments, typedRoutes: true }
  };
};