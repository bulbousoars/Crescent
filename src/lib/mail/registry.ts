import { GmailProvider } from './providers/gmail';
import type { MailProvider, MailProviderId } from './provider';

export interface ProviderEnv {
  googleClientId?: string;
  googleClientSecret?: string;
}

export function loadProviderEnv(): ProviderEnv {
  return {
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
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
  throw new Error(`provider ${id} not yet implemented`);
}
