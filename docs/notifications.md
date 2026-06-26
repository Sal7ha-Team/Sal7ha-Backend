# Notifications Setup

The backend stores every booking notification as an in-app inbox message.
Push delivery is enabled when Firebase Cloud Messaging credentials are present.

## Firebase environment variables

Use one of these configurations:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"project_id":"...","client_email":"...","private_key":"..."}
```

or:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Set `FCM_ENABLED=false` to force push delivery off while keeping in-app
notifications enabled.

## Client token registration

After login, the website or mobile app should request notification permission,
get an FCM registration token, then call:

```http
POST /notifications/devices
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "token": "<fcm-registration-token>",
  "platform": "web",
  "client": "website",
  "deviceId": "optional-stable-device-id"
}
```

Mobile apps should send `"platform": "ios"` or `"android"` and
`"client": "mobile"`.

To unregister:

```http
DELETE /notifications/devices
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "token": "<fcm-registration-token>"
}
```

## Booking notification flow

- Customer creates a booking: business owners receive an in-app notification and
  push notification if they have registered a device.
- Business owner changes booking status: the customer receives an in-app
  notification and push notification.
- Customer cancels a booking: business owners receive an in-app notification and
  push notification.
