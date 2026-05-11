import type {
  BeginAuthArgs,
  CompleteAuthArgs,
  ListNewArgs,
  ListNewResult,
  MailAuthMaterial,
  MailAuthTokens,
  MailProvider,
  MarkProcessedArgs,
  RawMessage,
} from '../provider';
import { isPasswordCreds } from '../provider';

const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
];

const DEFAULT_PROCESSED_LABEL = 'Crescent/Processed';

export interface GmailProviderConfig {
  clientId: string;
  clientSecret: string;
  fetcher?: typeof fetch;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

interface GmailMessageMeta {
  id: string;
  threadId: string;
}

interface GmailMessagesListResponse {
  messages?: GmailMessageMeta[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPayloadPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPayloadPart[];
}

interface GmailMessageFull {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayloadPart;
}

interface GmailLabel {
  id: string;
  name: string;
  type?: string;
}

interface GmailLabelsListResponse {
  labels?: GmailLabel[];
}

function decodeBase64Url(value: string): string {
  if (!value) return '';
  const norm = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4);
  return Buffer.from(pad, 'base64').toString('utf8');
}

function findHeader(name: string, headers?: GmailHeader[]): string {
  if (!headers) return '';
  const target = name.toLowerCase();
  const m = headers.find((h) => (h.name || '').toLowerCase() === target);
  return m ? m.value : '';
}

function collectBodies(part?: GmailPayloadPart, out: { mimeType: string; text: string }[] = []): { mimeType: string; text: string }[] {
  if (!part) return out;
  if (part.body?.data) {
    out.push({ mimeType: part.mimeType || '', text: decodeBase64Url(part.body.data) });
  }
  if (part.parts) for (const c of part.parts) collectBodies(c, out);
  return out;
}

function gmailMessageToRaw(msg: GmailMessageFull): RawMessage {
  const headers = msg.payload?.headers;
  const subject = findHeader('subject', headers);
  const from = findHeader('from', headers);
  const bodies = collectBodies(msg.payload);
  const textBody = bodies.find((b) => /text\/plain/i.test(b.mimeType))?.text || '';
  const htmlBody = bodies.find((b) => /text\/html/i.test(b.mimeType))?.text || '';
  const internalMs = msg.internalDate ? Number(msg.internalDate) : Date.now();
  return {
    providerMsgId: msg.id,
    threadId: msg.threadId || '',
    fromAddress: from,
    subject,
    receivedAt: new Date(internalMs),
    textBody,
    htmlBody,
    snippet: msg.snippet || '',
    labels: msg.labelIds || [],
    raw: msg,
  };
}

function buildQuery(rules: { query?: string; fromAllowlist?: string[]; processedLabel?: string }): string {
  const parts: string[] = [];
  if (rules.query && rules.query.trim()) parts.push(`(${rules.query.trim()})`);
  if (rules.fromAllowlist && rules.fromAllowlist.length) {
    const ors = rules.fromAllowlist.map((addr) => `from:${addr}`).join(' OR ');
    parts.push(`(${ors})`);
  }
  const processed = rules.processedLabel || DEFAULT_PROCESSED_LABEL;
  parts.push(`-label:${processed.replace(/\s+/g, '-')}`);
  return parts.join(' ');
}

export class GmailProvider implements MailProvider {
  readonly id = 'gmail' as const;
  private readonly cfg: GmailProviderConfig;
  private readonly fetcher: typeof fetch;

  constructor(cfg: GmailProviderConfig) {
    if (!cfg.clientId || !cfg.clientSecret) {
      throw new Error('GmailProvider requires clientId and clientSecret');
    }
    this.cfg = cfg;
    this.fetcher = cfg.fetcher || fetch;
  }

  beginAuth(args: BeginAuthArgs): string {
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: args.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state: args.state,
    });
    return `${AUTH_BASE}?${params.toString()}`;
  }

  async completeAuth(args: CompleteAuthArgs): Promise<{
    identity: { email: string; displayName: string };
    tokens: MailAuthTokens;
  }> {
    const body = new URLSearchParams({
      code: args.code,
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: 'authorization_code',
    });
    const response = await this.fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`Gmail token exchange failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as TokenResponse;
    if (!data.refresh_token) {
      throw new Error('Gmail did not return a refresh_token; re-prompt with prompt=consent');
    }
    const tokens: MailAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope,
      tokenType: data.token_type,
      idToken: data.id_token,
    };
    const identity = await this.fetchIdentity(tokens);
    return { identity, tokens };
  }

  async refreshTokens(tokens: MailAuthTokens): Promise<MailAuthTokens> {
    if (!tokens.refreshToken) throw new Error('cannot refresh: no refresh_token stored');
    const body = new URLSearchParams({
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    });
    const response = await this.fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`Gmail refresh failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as TokenResponse;
    return {
      ...tokens,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope ?? tokens.scope,
      tokenType: data.token_type ?? tokens.tokenType,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
    };
  }

  async listNew(args: ListNewArgs): Promise<ListNewResult> {
    if (isPasswordCreds(args.tokens)) {
      throw new Error('Gmail provider received password credentials; expected OAuth tokens');
    }
    let tokens: MailAuthTokens = args.tokens;
    if (Date.now() >= tokens.expiresAt - 30_000) {
      tokens = await this.refreshTokens(tokens);
    }
    const q = buildQuery(args.rules);
    const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(q)}&maxResults=50`;
    const list = await this.gmailGet<GmailMessagesListResponse>(url, tokens);
    const messages: RawMessage[] = [];
    let lastId = '';
    for (const meta of list.messages || []) {
      const msg = await this.gmailGet<GmailMessageFull>(
        `${GMAIL_BASE}/messages/${meta.id}?format=full`,
        tokens,
      );
      messages.push(gmailMessageToRaw(msg));
      lastId = meta.id;
    }
    const nextCursor = lastId ? `last:${lastId}` : args.cursor;
    return {
      messages,
      nextCursor,
      refreshedTokens: tokens === args.tokens ? undefined : tokens,
    };
  }

  async markProcessed(args: MarkProcessedArgs): Promise<void> {
    if (isPasswordCreds(args.tokens)) {
      throw new Error('Gmail provider received password credentials; expected OAuth tokens');
    }
    const tokens: MailAuthTokens = args.tokens;
    const labelName = args.rules.processedLabel || DEFAULT_PROCESSED_LABEL;
    const labelId = await this.ensureLabel(labelName, tokens);
    const url = `${GMAIL_BASE}/messages/${args.providerMsgId}/modify`;
    const body = JSON.stringify({
      addLabelIds: [labelId],
      removeLabelIds: ['UNREAD', 'INBOX'],
    });
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: this.authHeaders(tokens, 'application/json'),
      body,
    });
    if (!response.ok) {
      throw new Error(`Gmail markProcessed failed: ${response.status} ${await response.text()}`);
    }
  }

  async revoke(material: MailAuthMaterial): Promise<void> {
    if (isPasswordCreds(material)) return;
    const tokens: MailAuthTokens = material;
    const target = tokens.refreshToken || tokens.accessToken;
    if (!target) return;
    const body = new URLSearchParams({ token: target });
    await this.fetcher(REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  private async fetchIdentity(tokens: MailAuthTokens): Promise<{ email: string; displayName: string }> {
    const response = await this.fetcher(USERINFO_URL, { headers: this.authHeaders(tokens) });
    if (!response.ok) {
      throw new Error(`Gmail userinfo failed: ${response.status}`);
    }
    const data = (await response.json()) as { email?: string; name?: string };
    return { email: data.email || '', displayName: data.name || '' };
  }

  private async gmailGet<T>(url: string, tokens: MailAuthTokens): Promise<T> {
    const response = await this.fetcher(url, { headers: this.authHeaders(tokens) });
    if (!response.ok) {
      throw new Error(`Gmail GET ${url} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  private async ensureLabel(name: string, tokens: MailAuthTokens): Promise<string> {
    const list = await this.gmailGet<GmailLabelsListResponse>(`${GMAIL_BASE}/labels`, tokens);
    const found = (list.labels || []).find((l) => l.name === name);
    if (found) return found.id;
    const response = await this.fetcher(`${GMAIL_BASE}/labels`, {
      method: 'POST',
      headers: this.authHeaders(tokens, 'application/json'),
      body: JSON.stringify({
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    });
    if (!response.ok) {
      throw new Error(`Gmail label create failed: ${response.status} ${await response.text()}`);
    }
    const created = (await response.json()) as GmailLabel;
    return created.id;
  }

  private authHeaders(tokens: MailAuthTokens, contentType?: string): Record<string, string> {
    const h: Record<string, string> = { authorization: `Bearer ${tokens.accessToken}` };
    if (contentType) h['content-type'] = contentType;
    return h;
  }
}
