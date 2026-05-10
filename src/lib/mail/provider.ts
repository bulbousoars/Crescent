export type MailProviderId = 'gmail' | 'microsoft' | 'imap';

export interface MailAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
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
  tokens: MailAuthTokens;
  rules: MailRules;
  cursor: string;
}

export interface ListNewResult {
  messages: RawMessage[];
  nextCursor: string;
  refreshedTokens?: MailAuthTokens;
}

export interface MarkProcessedArgs {
  tokens: MailAuthTokens;
  providerMsgId: string;
  rules: MailRules;
}

export interface MailProvider {
  readonly id: MailProviderId;

  beginAuth(args: BeginAuthArgs): string;

  completeAuth(args: CompleteAuthArgs): Promise<{
    identity: MailIdentity;
    tokens: MailAuthTokens;
  }>;

  refreshTokens(tokens: MailAuthTokens): Promise<MailAuthTokens>;

  listNew(args: ListNewArgs): Promise<ListNewResult>;

  markProcessed(args: MarkProcessedArgs): Promise<void>;

  revoke(tokens: MailAuthTokens): Promise<void>;
}
