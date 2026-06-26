import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';

type FirebaseCredential = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type FcmSendResult = {
  configured: boolean;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  errors: Array<{ token: string; message: string }>;
};

@Injectable()
export class FirebaseCloudMessagingService {
  private readonly logger = new Logger(FirebaseCloudMessagingService.name);
  private accessToken?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return this.credential() !== null;
  }

  async sendToTokens(
    tokens: string[],
    payload: PushPayload,
  ): Promise<FcmSendResult> {
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    const credential = this.credential();

    if (uniqueTokens.length === 0 || !credential) {
      return {
        configured: credential !== null,
        successCount: 0,
        failureCount: uniqueTokens.length,
        invalidTokens: [],
        errors: [],
      };
    }

    const accessToken = await this.getAccessToken(credential);
    const result: FcmSendResult = {
      configured: true,
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      errors: [],
    };

    for (const token of uniqueTokens) {
      try {
        await this.sendOne(credential.projectId, accessToken, token, payload);
        result.successCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.failureCount += 1;
        result.errors.push({ token, message });
        if (this.isInvalidTokenError(message)) {
          result.invalidTokens.push(token);
        }
      }
    }

    return result;
  }

  private async sendOne(
    projectId: string,
    accessToken: string,
    token: string,
    payload: PushPayload,
  ) {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: this.stringifyData(payload.data),
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
            webpush: {
              notification: {
                title: payload.title,
                body: payload.body,
              },
              fcm_options: payload.data?.url
                ? { link: String(payload.data.url) }
                : undefined,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FCM ${response.status}: ${text}`);
    }
  }

  private async getAccessToken(credential: FirebaseCredential) {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.accessToken.expiresAt - 60 > now) {
      return this.accessToken.value;
    }

    const assertion = this.createJwtAssertion(credential, now);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firebase auth ${response.status}: ${text}`);
    }

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) {
      throw new Error('Firebase auth did not return an access token');
    }

    this.accessToken = {
      value: body.access_token,
      expiresAt: now + Number(body.expires_in ?? 3600),
    };
    return this.accessToken.value;
  }

  private createJwtAssertion(credential: FirebaseCredential, now: number) {
    const header = this.base64Url({ alg: 'RS256', typ: 'JWT' });
    const claims = this.base64Url({
      iss: credential.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    });
    const unsigned = `${header}.${claims}`;
    const signature = createSign('RSA-SHA256')
      .update(unsigned)
      .sign(credential.privateKey, 'base64url');
    return `${unsigned}.${signature}`;
  }

  private credential(): FirebaseCredential | null {
    if (this.config.get<string>('FCM_ENABLED') === 'false') {
      return null;
    }

    const serviceAccountJson = this.config.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    if (serviceAccountJson) {
      const parsed = this.parseServiceAccountJson(serviceAccountJson);
      if (parsed) return parsed;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.normalizePrivateKey(
      this.config.get<string>('FIREBASE_PRIVATE_KEY'),
    );

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return { projectId, clientEmail, privateKey };
  }

  private parseServiceAccountJson(value: string): FirebaseCredential | null {
    const candidates = [value, Buffer.from(value, 'base64').toString('utf8')];

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as Record<string, string>;
        const projectId = parsed.project_id;
        const clientEmail = parsed.client_email;
        const privateKey = this.normalizePrivateKey(parsed.private_key);
        if (projectId && clientEmail && privateKey) {
          return { projectId, clientEmail, privateKey };
        }
      } catch {}
    }

    this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    return null;
  }

  private normalizePrivateKey(value?: string) {
    return value?.replace(/\\n/g, '\n');
  }

  private stringifyData(data?: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(data ?? {})
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    );
  }

  private isInvalidTokenError(message: string) {
    return (
      message.includes('UNREGISTERED') ||
      message.includes('registration-token-not-registered') ||
      message.includes('Requested entity was not found')
    );
  }

  private base64Url(value: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
