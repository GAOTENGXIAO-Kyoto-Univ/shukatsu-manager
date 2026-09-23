export type GmailHeader = { name?: string; value?: string };
export type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailMessagePart[];
};
export type GmailMessageResource = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePart;
};

export function decodeBase64UrlText(data: string) {
  try {
    const normalized = data.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    throw new Error("GMAIL_BODY_DECODE_FAILED");
  }
}
function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/giu, (entity, token: string) => {
    const lower = token.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return named[lower] ?? entity;
  });
}

export function normalizeVisibleText(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u00a0\u2007\u202f]/gu, " ")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function htmlToVisibleText(html: string) {
  const withoutHiddenContent = html
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<(script|style|head|noscript)[^>]*>[\s\S]*?<\/\1>/giu, " ")
    .replace(/<(br|hr)\s*\/?\s*>/giu, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/giu, "\n")
    .replace(/<li[^>]*>/giu, "- ")
    .replace(/<[^>]+>/gu, " ");
  return normalizeVisibleText(decodeHtmlEntities(withoutHiddenContent));
}

export function getGmailHeader(payload: GmailMessagePart | undefined, name: string) {
  return payload?.headers?.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase(),
  )?.value?.trim() ?? "";
}

type TextParts = { plain: string[]; html: string[] };

export async function extractGmailBody(
  message: GmailMessageResource,
  fetchTextAttachment: (attachmentId: string) => Promise<string>,
) {
  const textParts: TextParts = { plain: [], html: [] };

  async function visit(part: GmailMessagePart | undefined): Promise<void> {
    if (!part) return;
    const mimeType = part.mimeType?.toLowerCase() ?? "";
    const isText = mimeType === "text/plain" || mimeType === "text/html";
    if (isText && !part.filename) {
      let data = part.body?.data;
      if (!data && part.body?.attachmentId) {
        data = await fetchTextAttachment(part.body.attachmentId);
      }
      if (data) {
        const decoded = decodeBase64UrlText(data);
        if (mimeType === "text/plain") textParts.plain.push(decoded);
        else textParts.html.push(decoded);
      }
    }
    for (const child of part.parts ?? []) await visit(child);
  }

  await visit(message.payload);
  const plain = normalizeVisibleText(textParts.plain.join("\n\n"));
  if (plain) return { bodyText: plain, bodySource: "plain" as const };
  const html = htmlToVisibleText(textParts.html.join("\n\n"));
  if (html) return { bodyText: html, bodySource: "html" as const };
  const snippet = normalizeVisibleText(message.snippet ?? "");
  if (snippet) return { bodyText: snippet, bodySource: "snippet" as const };
  throw new Error("GMAIL_MESSAGE_UNREADABLE");
}
