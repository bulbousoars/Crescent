export type MailProviderId = 'gmail' | 'microsoft' | 'imap';

export interface MailAuthTokens {
  kind?: 'oauth';
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
}

export interface MailPasswordCredentials {
  kind: 'password';
  user: string;
  password: string;
  host: string;
  port: number;
  secure: boolean;
}

export type MailAuthMaterial = MailAuthTokens | MailPasswordCredentials;

export function isPasswordCreds(m: MailAuthMaterial): m is MailPasswordCredentials {
  return (m as MailPasswordCredentials).kind === 'password';
}

export interface MailRules {
  query?: string;
  fromAllowlist?: string[];
  processedLabel?: string;
}

export interface RawMessage {
  providerMsgId: string;
  threadId: string;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  textBody: string;
  htmlBody: string;
  snippet: string;
  labels: string[];
  raw?: unknown;
}

export interface MailIdentity {
  email: string;
  displayName: string;
}

export interface BeginAuthArgs {
  redirectUri: string;
  state: string;
}

export interface CompleteAuthArgs {
  code: string;
  redirectUri: string;
}

export interface ListNewArgs {
  tokens: MailAuthMaterial;
  rules: MailRules;
  cursor: string;
}

export interface ListNewResult {
  messages: RawMessage[];
  nextCursor: string;
  refreshedTokens?: MailAuthMaterial;
}

export interface MarkProcessedArgs {
  tokens: MailAuthMaterial;
  providerMsgId: string;
  rules: MailRules;
}

export interface MailProvider {
  readonly id: MailProviderId;

  beginAuth?(args: BeginAuthArgs): string;

  completeAuth?(args: CompleteAuthArgs): Promise<{
    identity: MailIdentity;
    tokens: MailAuthTokens;
  }>;

  refreshTokens?(tokens: MailAuthTokens): Promise<MailAuthTokens>;

  testCredentials?(creds: MailPasswordCredentials): Promise<MailIdentity>;

  listNew(args: ListNewArgs): Promise<ListNewResult>;

  markProcessed(args: MarkProcessedArgs): Promise<void>;

  revoke(tokens: MailAuthMaterial): Promise<void>;
}
