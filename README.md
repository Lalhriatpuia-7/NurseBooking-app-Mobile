# CareConnect Mobile

Expo SDK 57 / React Native app for Android and iOS. It connects to the existing Node API; MongoDB remains the source of truth for accounts and bookings.

## Included workflows

- Customer and nurse registration/sign-in with secure token storage
- Nurse discovery, booking, availability, rate, UPI QR payment, payment reference reporting, nurse receipt confirmation, and earnings
- Customer/nurse live tracking on native maps for a confirmed booking
- Optional background location sharing with explicit permission and a persistent Android foreground-service notification
- Treatment notes stored only in an encrypted SQLCipher database on the customer's device; customer-approved export/import for nurse sharing
- Profile editing and image upload
- Admin nurse verification and account enable/disable

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to a reachable API URL. On a physical phone, use the development computer's LAN IP, such as `http://192.168.1.10:5000/api`; `localhost` points at the phone itself. Android Emulator commonly uses `http://10.0.2.2:5000/api`.
3. Set `GOOGLE_MAPS_API_KEY` for Android native maps in development builds. Restrict it to the Android package and signing SHA-1. Apple Maps is used on iOS without a Google key.
4. Start an Android/iOS development build. SQLCipher and background location require a native build and do not fully work in Expo Go.

```powershell
npm install
npm run start
```

The API must be reachable from the device and allow the app's network origin/configuration. Production API URLs must use HTTPS.

## Native builds

Create or link an Expo EAS project, then configure the `EXPO_PUBLIC_API_URL` and `GOOGLE_MAPS_API_KEY` EAS environment variables for the development, preview, and production environments. Set the EAS project ID in app config after linking.

```powershell
npm run build:development
npm run build:preview
npm run build:production
```

Google Maps keys must be restricted to the package/bundle identifiers and signing certificates. Apple Maps uses the platform SDK. Complete Apple Developer and Google Play signing, privacy disclosures, health-data review, and store submissions with the organization's accounts.

## Privacy and platform behavior

Live tracking requires explicit foreground sharing. Background sharing is a separate opt-in and can be interrupted when the OS stops or force-quits the app. A development/native build is required to test it. Google Play and App Store review may require additional justification for background-location permissions.

Treatment notes are not sent to the API. They are encrypted locally with SQLCipher; the key is stored in the device secure store. Exports are readable JSON files, so only share them with an intended nurse. SQLCipher has not been tested here on a signed device build.

Direct UPI receipts are not automatically verifiable. The nurse must check the transaction in their bank/UPI app and confirm receipt in CareConnect. For commercial marketplace use, use appropriate merchant/sub-merchant onboarding through an authorized acquirer/payment aggregator.