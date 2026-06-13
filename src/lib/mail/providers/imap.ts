import { ImapFlow } from 'imapflow';
import type {
  ListNewArgs,
  ListNewResult,
  MailAuthMaterial,
  MailIdentity,
  MailPasswordCredentials,
  MailProvider,
  MarkProcessedArgs,
  RawMessage,
} from '../provider';
import { isPasswordCreds } from '../provider';

const DEFAULT_PROCESSED_KEYWORD = 'Real-Estate';
const FETCH_BATCH_LIMIT = 50;

function processedKeywordFromRules(rules: { processedLabel?: string }): string {
  const raw = (rules.processedLabel || DEFAULT_PROCESSED_KEYWORD).replace(/[^A-Za-z0-9_-]+/g, '-');
  return raw || DEFAULT_PROCESSED_KEYWORD;
}

function parseCursor(cursor: string): { uidValidity: number; lastUid: number } {
  if (!cursor) return { uidValidity: 0, lastUid: 0 };
  const m = cursor.match(/^uid:(\d+):(\d+)$/);
  if (!m) return { uidValidity: 0, lastUid: 0 };
  return { uidValidity: parseInt(m[1], 10), lastUid: parseInt(m[2], 10) };
}

function makeCursor(uidValidity: number, lastUid: number): string {
  return `uid:${uidValidity}:${lastUid}`;
}

function parseFromAddress(rawFrom: string | undefined): string {
  if (!rawFrom) return '';
  const angle = rawFrom.match(/<([^>]+)>/);
  return (angle ? angle[1] : rawFrom).trim().toLowerCase();
}

interface ImapFetchPart {
  type?: string;
  subtype?: string;
  parameters?: Record<string, string>;
  part?: string;
  encoding?: string;
  childNodes?: ImapFetchPart[];
  size?: number;
}

function findBodyParts(structure: ImapFetchPart): { plain?: string; html?: string } {
  const result: { plain?: string; html?: string } = {};
  function walk(node: ImapFetchPart) {
    if (!node) return;
    if (node.childNodes && node.childNodes.length) {
      for (const c of node.childNodes) walk(c);
      return;
    }
    const sub = (node.subtype || '').toLowerCase();
    if (!result.plain && sub === 'plain') result.plain = node.part;
    if (!result.html && sub === 'html') result.html = node.part;
  }
  walk(structure);
  return result;
}

export interface ImapProviderConfig {
  imapClientFactory?: (creds: MailPasswordCredentials) => ImapFlow;
}

export class ImapProvider implements MailProvider {
  readonly id = 'imap' as const;
  private readonly cfg: ImapProviderConfig;

  constructor(cfg: ImapProviderConfig = {}) {
    this.cfg = cfg;
  }

  async testCredentials(creds: MailPasswordCredentials): Promise<MailIdentity> {
    const client = this.openClient(creds);
    try {
      await client.connect();
      await client.mailboxOpen('INBOX', { readOnly: true });
      await client.logout();
      return { email: creds.user, displayName: creds.user };
    } catch (error) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  async listNew(args: ListNewArgs): Promise<ListNewResult> {
    if (!isPasswordCreds(args.tokens)) {
      throw new Error('IMAP provider received OAuth tokens; expected password credentials');
    }
    const creds = args.tokens;
    const client = this.openClient(creds);
    const messages: RawMessage[] = [];
    let nextCursor = args.cursor;
    try {
      await client.connect();
      const mailbox = await client.mailboxOpen('INBOX', { readOnly: false });
      const uidValidity = Number(mailbox.uidValidity ?? 0);
      const cursor = parseCursor(args.cursor);
      const lastUid = cursor.uidValidity === uidValidity ? cursor.lastUid : 0;

      const senderTerms = (args.rules.fromAllowlist || []).map((from) => ({ from }));
      const baseCriteria: Record<string, unknown> = {
        uid: `${lastUid + 1}:*`,
      };
      const keyword = processedKeywordFromRules(args.rules);
      if (senderTerms.length === 0) {
        // no senders means no filter; still apply keyword exclusion
        baseCriteria.notKeyword = keyword;
      } else if (senderTerms.length === 1) {
        Object.assign(baseCriteria, senderTerms[0]);
        baseCriteria.notKeyword = keyword;
      } else {
        baseCriteria.or = senderTerms;
        baseCriteria.notKeyword = keyword;
      }

      const searchResult = await client.search(baseCriteria, { uid: true });
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];
      const limited = uids.slice(0, FETCH_BATCH_LIMIT);

      let maxUid = lastUid;
      for (const uid of limited) {
        if (uid <= lastUid) continue;
        const fetched = await client.fetchOne(
          uid,
          { envelope: true, internalDate: true, source: true, flags: true, uid: true },
          { uid: true },
        );
        if (!fetched) continue;
        const env = fetched.envelope;
        const fromAddr =
          (env?.from || []).map((a) => a.address || '').filter(Boolean)[0] ||
          parseFromAddress(env?.sender?.[0]?.address || '');
        const subject = env?.subject || '';
        const internalDate = fetched.internalDate ? new Date(fetched.internalDate) : new Date();

        const sourceBuf: Buffer | null = (fetched.source as Buffer | null) ?? null;
        const { textBody, htmlBody, snippet } = parseSource(sourceBuf);

        messages.push({
          providerMsgId: `${uidValidity}:${uid}`,
          threadId: '',
          fromAddress: (fromAddr || '').toLowerCase(),
          subject,
          receivedAt: internalDate,
          textBody,
          htmlBody,
          snippet,
          labels: [],
          raw: { uid, uidValidity, flags: Array.from(fetched.flags ?? []) },
        });
        if (uid > maxUid) maxUid = uid;
      }

      nextCursor = makeCursor(uidValidity, maxUid);
      await client.logout();
    } catch (error) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      throw error;
    }
    return { messages, nextCursor };
  }

  async markProcessed(args: MarkProcessedArgs): Promise<void> {
    if (!isPasswordCreds(args.tokens)) {
      throw new Error('IMAP provider received OAuth tokens; expected password credentials');
    }
    const [validityStr, uidStr] = args.providerMsgId.split(':');
    const uid = parseInt(uidStr, 10);
    if (!uid) throw new Error(`invalid providerMsgId for IMAP: ${args.providerMsgId}`);
    const keyword = processedKeywordFromRules(args.rules);
    const client = this.openClient(args.tokens);
    try {
      await client.connect();
      await client.mailboxOpen('INBOX', { readOnly: false });

      // Gmail / Google Workspace: X-GM-LABELS for user labels + Inbox; standard FLAGS for \Seen.
      const gmailLabels =
        typeof client.capabilities?.has === 'function' && client.capabilities.has('X-GM-EXT-1');

      if (gmailLabels) {
        // Gmail: FLAGS \\Seen, then X-GM-LABELS user label, then drop \\Inbox (sometimes Gmail
        // re-applies Inbox when adding a label; a second -X-GM-LABELS \\Inbox STORE clears it).
        const seenOk = await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        if (!seenOk) throw new Error('IMAP: failed to mark message as read');
        const labelOk = await client.messageFlagsAdd(uid, [keyword], { uid: true, useLabels: true });
        if (!labelOk) throw new Error(`IMAP: failed to apply Gmail label "${keyword}"`);
        const inboxOk = await client.messageFlagsRemove(uid, ['\\Inbox'], { uid: true, useLabels: true });
        if (!inboxOk) throw new Error('IMAP: failed to remove Inbox label (archive)');
        const inboxOk2 = await client.messageFlagsRemove(uid, ['\\Inbox'], { uid: true, useLabels: true });
        if (!inboxOk2) throw new Error('IMAP: failed second Inbox removal (archive)');
      } else {
        // Generic IMAP: read then keyword (two STORE +FLAGS). Inbox archive is not portable here.
        const seenOk = await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        if (!seenOk) throw new Error('IMAP: failed to mark message as read');
        const keywordOk = await client.messageFlagsAdd(uid, [keyword], { uid: true });
        if (!keywordOk) throw new Error(`IMAP: failed to apply keyword "${keyword}"`);
      }
      await client.logout();
    } catch (error) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      throw error;
    }
    void validityStr;
  }

  async revoke(_material: MailAuthMaterial): Promise<void> {
    void _material;
  }

  private openClient(creds: MailPasswordCredentials): ImapFlow {
    if (this.cfg.imapClientFactory) return this.cfg.imapClientFactory(creds);
    return new ImapFlow({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth: { user: creds.user, pass: creds.password },
      logger: false,
    });
  }
}

export function parseSource(source: Buffer | null): { textBody: string; htmlBody: string; snippet: string } {
  if (!source) return { textBody: '', htmlBody: '', snippet: '' };
  const raw = source.toString('utf8');
  const headerEnd = raw.indexOf('\r\n\r\n') === -1 ? raw.indexOf('\n\n') : raw.indexOf('\r\n\r\n');
  const headers = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw;
  const body = headerEnd >= 0 ? raw.slice(headerEnd).replace(/^[\r\n]+/, '') : '';

  const ctMatch = headers.match(/Content-Type:\s*([^\r\n;]+)(?:;\s*([^\r\n]+))?/i);
  const contentType = ctMatch ? ctMatch[1].trim().toLowerCase() : 'text/plain';
  const ctParams = ctMatch && ctMatch[2] ? ctMatch[2] : '';
  const boundaryMatch = ctParams.match(/boundary="?([^";]+)"?/i);
  const transferMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
  const transferEncoding = transferMatch ? transferMatch[1].trim().toLowerCase() : '7bit';

  if (contentType.startsWith('multipart/') && boundaryMatch) {
    const parts = splitMultipart(body, boundaryMatch[1]);
    let textBody = '';
    let htmlBody = '';
    for (const part of parts) {
      const pCt = (part.headers.match(/Content-Type:\s*([^\r\n;]+)/i) || [])[1] || '';
      const pEnc = (part.headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i) || [])[1] || '7bit';
      const decoded = decodePart(part.body, pEnc.trim().toLowerCase());
      if (/text\/plain/i.test(pCt) && !textBody) textBody = decoded;
      if (/text\/html/i.test(pCt) && !htmlBody) htmlBody = decoded;
    }
    const snippet = (textBody || stripHtml(htmlBody)).slice(0, 200);
    return { textBody, htmlBody, snippet };
  }

  const decoded = decodePart(body, transferEncoding);
  if (contentType.startsWith('text/html')) {
    return { textBody: '', htmlBody: decoded, snippet: stripHtml(decoded).slice(0, 200) };
  }
  return { textBody: decoded, htmlBody: '', snippet: decoded.slice(0, 200) };
}

function splitMultipart(body: string, boundary: string): { headers: string; body: string }[] {
  const sep = `--${boundary}`;
  const parts = body.split(sep);
  const out: { headers: string; body: string }[] = [];
  for (const p of parts) {
    const trimmed = p.replace(/^\r?\n/, '');
    if (!trimmed || trimmed.startsWith('--')) continue;
    const headerEnd = trimmed.indexOf('\r\n\r\n') === -1 ? trimmed.indexOf('\n\n') : trimmed.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    out.push({
      headers: trimmed.slice(0, headerEnd),
      body: trimmed.slice(headerEnd).replace(/^[\r\n]+/, '').replace(/\r?\n--$/, ''),
    });
  }
  return out;
}

function decodePart(body: string, encoding: string): string {
  if (encoding === 'base64') {
    try {
      return Buffer.from(body.replace(/[\r\n]/g, ''), 'base64').toString('utf8');
    } catch {
      return body;
    }
  }
  if (encoding === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return body;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
