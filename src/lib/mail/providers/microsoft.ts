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

const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface MicrosoftGraphProviderConfig {
  clientId: string;
  clientSecret: string;
  /** Azure AD tenant: `common`, `organizations`, `consumers`, or a tenant GUID */
  tenant: string;
  fetcher?: typeof fetch;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

interface GraphMessageLite {
  id: string;
  subject?: string;
  receivedDateTime?: string;
  conversationId?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  bodyPreview?: string;
  isRead?: boolean;
}

interface GraphListResponse {
  value?: GraphMessageLite[];
}

interface GraphMessageFull extends GraphMessageLite {
  body?: { contentType?: string; content?: string };
}

interface GraphFolder {
  id: string;
  displayName?: string;
}

interface GraphFoldersResponse {
  value?: GraphFolder[];
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || 'Crescent-Processed';
}

function graphMessageToRaw(msg: GraphMessageFull): RawMessage {
  const ct = (msg.body?.contentType || '').toLowerCase();
  const content = msg.body?.content || '';
  const isHtml = ct.includes('html');
  return {
    providerMsgId: msg.id,
    threadId: msg.conversationId || '',
    fromAddress: msg.from?.emailAddress?.address || '',
    subject: msg.subject || '',
    receivedAt: new Date(msg.receivedDateTime || Date.now()),
    textBody: isHtml ? '' : content,
    htmlBody: isHtml ? content : '',
    snippet: msg.bodyPreview || '',
    labels: [],
    raw: msg,
  };
}

function fromMatchesAllowlist(fromAddr: string, allowlist: string[] | undefined): boolean {
  if (!allowlist?.length) return true;
  const lower = fromAddr.toLowerCase();
  return allowlist.some((a) => lower === a.trim().toLowerCase());
}

export class MicrosoftGraphProvider implements MailProvider {
  readonly id = 'microsoft' as const;
  private readonly cfg: MicrosoftGraphProviderConfig;
  private readonly fetcher: typeof fetch;
  private readonly authBase: string;
  private readonly tokenUrl: string;

  constructor(cfg: MicrosoftGraphProviderConfig) {
    if (!cfg.clientId || !cfg.clientSecret) {
      throw new Error('MicrosoftGraphProvider requires clientId and clientSecret');
    }
    this.cfg = cfg;
    this.fetcher = cfg.fetcher || fetch;
    const t = cfg.tenant || 'common';
    this.authBase = `https://login.microsoftonline.com/${t}/oauth2/v2.0/authorize`;
    this.tokenUrl = `https://login.microsoftonline.com/${t}/oauth2/v2.0/token`;
  }

  beginAuth(args: BeginAuthArgs): string {
    const scopes = ['offline_access', 'openid', 'email', 'https://graph.microsoft.com/Mail.ReadWrite', 'https://graph.microsoft.com/User.Read'];
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      response_type: 'code',
      redirect_uri: args.redirectUri,
      response_mode: 'query',
      scope: scopes.join(' '),
      state: args.state,
      prompt: 'consent',
    });
    return `${this.authBase}?${params.toString()}`;
  }

  async completeAuth(args: CompleteAuthArgs): Promise<{
    identity: { email: string; displayName: string };
    tokens: MailAuthTokens;
  }> {
    const body = new URLSearchParams({
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      code: args.code,
      redirect_uri: args.redirectUri,
      grant_type: 'authorization_code',
      scope: 'offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read openid email',
    });
    const response = await this.fetcher(this.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`Microsoft token exchange failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as TokenResponse;
    if (!data.refresh_token) {
      throw new Error('Microsoft did not return refresh_token; try prompt=consent again');
    }
    const tokens: MailAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope,
      tokenType: data.token_type,
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
      scope: 'offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read',
    });
    const response = await this.fetcher(this.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`Microsoft refresh failed: ${response.status} ${await response.text()}`);
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
      throw new Error('Microsoft provider received password credentials; expected OAuth tokens');
    }
    let active: MailAuthTokens = args.tokens;
    if (Date.now() >= active.expiresAt - 30_000) {
      active = await this.refreshTokens(active);
    }
    const allowlist = args.rules.fromAllowlist;
    const url = `${GRAPH}/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,conversationId,bodyPreview,isRead`;
    const list = await this.graphGet<GraphListResponse>(url, active);
    const messages: RawMessage[] = [];
    let lastId = '';
    for (const meta of list.value || []) {
      if (!fromMatchesAllowlist(meta.from?.emailAddress?.address || '', allowlist)) continue;
      const full = await this.graphGet<GraphMessageFull>(
        `${GRAPH}/me/messages/${encodeURIComponent(meta.id)}?$select=id,subject,from,receivedDateTime,conversationId,body,bodyPreview,isRead`,
        active,
      );
      messages.push(graphMessageToRaw(full));
      lastId = meta.id;
    }
    const nextCursor = lastId ? `last:${lastId}` : args.cursor;
    return {
      messages,
      nextCursor,
      refreshedTokens: active === args.tokens ? undefined : active,
    };
  }

  async markProcessed(args: MarkProcessedArgs): Promise<void> {
    if (isPasswordCreds(args.tokens)) {
      throw new Error('Microsoft provider received password credentials; expected OAuth tokens');
    }
    let active: MailAuthTokens = args.tokens;
    if (Date.now() >= active.expiresAt - 30_000) {
      active = await this.refreshTokens(active);
    }
    const label = sanitizeFolderName(args.rules.processedLabel || 'Crescent-Processed');
    const folderId = await this.ensureMailFolder(active, label);
    const url = `${GRAPH}/me/messages/${encodeURIComponent(args.providerMsgId)}/move`;
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: this.authHeaders(active, 'application/json'),
      body: JSON.stringify({ destinationId: folderId }),
    });
    if (!response.ok) {
      throw new Error(`Microsoft move message failed: ${response.status} ${await response.text()}`);
    }
  }

  async revoke(material: MailAuthMaterial): Promise<void> {
    if (isPasswordCreds(material)) return;
    // Best-effort; tokens are removed locally when account is deleted.
    void material;
  }

  private async fetchIdentity(tokens: MailAuthTokens): Promise<{ email: string; displayName: string }> {
    const response = await this.fetcher(`${GRAPH}/me`, { headers: this.authHeaders(tokens) });
    if (!response.ok) {
      throw new Error(`Microsoft /me failed: ${response.status}`);
    }
    const data = (await response.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
    const email = data.mail || data.userPrincipalName || '';
    return { email, displayName: data.displayName || '' };
  }

  private async ensureMailFolder(tokens: MailAuthTokens, displayName: string): Promise<string> {
    const list = await this.graphGet<GraphFoldersResponse>(`${GRAPH}/me/mailFolders?$top=200`, tokens);
    const found = (list.value || []).find((f) => (f.displayName || '').toLowerCase() === displayName.toLowerCase());
    if (found) return found.id;
    const response = await this.fetcher(`${GRAPH}/me/mailFolders`, {
      method: 'POST',
      headers: this.authHeaders(tokens, 'application/json'),
      body: JSON.stringify({ displayName }),
    });
    if (!response.ok) {
      throw new Error(`Microsoft create folder failed: ${response.status} ${await response.text()}`);
    }
    const created = (await response.json()) as GraphFolder;
    return created.id;
  }

  private async graphGet<T>(url: string, tokens: MailAuthTokens): Promise<T> {
    const response = await this.fetcher(url, { headers: this.authHeaders(tokens) });
    if (!response.ok) {
      throw new Error(`Microsoft GET failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  private authHeaders(tokens: MailAuthTokens, contentType?: string): Record<string, string> {
    const h: Record<string, string> = { authorization: `Bearer ${tokens.accessToken}` };
    if (contentType) h['content-type'] = contentType;
    return h;
  }
}
