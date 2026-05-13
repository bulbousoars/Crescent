import { GmailProvider } from './providers/gmail';
import { ImapProvider } from './providers/imap';
import { MicrosoftGraphProvider } from './providers/microsoft';
import type { MailProvider, MailProviderId } from './provider';

export interface ProviderEnv {
  googleClientId?: string;
  googleClientSecret?: string;
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  microsoftTenant?: string;
}

export function loadProviderEnv(): ProviderEnv {
  return {
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    microsoftClientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    microsoftClientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
    microsoftTenant: process.env.MICROSOFT_OAUTH_TENANT,
  };
}

export function getProvider(id: MailProviderId, env: ProviderEnv = loadProviderEnv()): MailProvider {
  if (id === 'gmail') {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new Error('GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set');
    }
    return new GmailProvider({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    });
  }
  if (id === 'microsoft') {
    if (!env.microsoftClientId || !env.microsoftClientSecret) {
      throw new Error('MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET must be set');
    }
    return new MicrosoftGraphProvider({
      clientId: env.microsoftClientId,
      clientSecret: env.microsoftClientSecret,
      tenant: env.microsoftTenant || 'common',
    });
  }
  if (id === 'imap') {
    return new ImapProvider();
  }
  throw new Error(`provider ${id} not yet implemented`);
}
