import crypto from 'node:crypto';
import { BASE_URL } from './endpoints.js';
import {
  AuthenticationError,
  RateLimitError,
  NetworkError,
} from './types.js';
import { withRetry, type RetryOptions } from '../../../utils/retry.js';
import { CdpHttpSession } from './cdp-http.js';

export interface ClientOptions {
  verbose?: boolean;
  /** When set, all requests run inside the CDP browser (cookies + session Bearer). */
  cdpPort?: number;
  /** Parallel CDP tabs (default 3). */
  cdpPoolSize?: number;
  /** Min gap between starting CDP fetches (ms). */
  cdpMinGapMs?: number;
  /** Optional pre-connected session (takes ownership for close()). */
  cdpSession?: CdpHttpSession;
}

const BROWSER_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://chatgpt.com/',
  Origin: 'https://chatgpt.com',
  'Sec-Ch-Ua': '"Chromium";v="152", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Linux"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

export class ChatGPTClient {
  private accessToken: string;
  private verbose: boolean;
  private deviceId: string;
  private cdpPort?: number;
  private cdpPoolSize: number;
  private cdpMinGapMs: number;
  private cdp?: CdpHttpSession;
  private ownsCdp = false;

  constructor(accessToken: string = '', options: ClientOptions = {}) {
    this.accessToken = accessToken;
    this.verbose = options.verbose ?? false;
    this.deviceId = crypto.randomUUID();
    this.cdpPort = options.cdpPort;
    this.cdpPoolSize = options.cdpPoolSize ?? 3;
    this.cdpMinGapMs = options.cdpMinGapMs ?? 150;
    if (options.cdpSession) {
      this.cdp = options.cdpSession;
      this.ownsCdp = false;
    }
  }

  get usesCdp(): boolean {
    return this.cdpPort !== undefined || this.cdp !== undefined;
  }

  get throttleStats() {
    return this.cdp?.stats;
  }

  get cdpWorkers(): number {
    return this.cdp?.workerCount ?? 0;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      'Oai-Device-Id': this.deviceId,
      'Oai-Language': 'en-US',
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  private async ensureCdp(): Promise<CdpHttpSession> {
    if (this.cdp) return this.cdp;
    if (this.cdpPort === undefined) {
      throw new Error('CDP port not configured');
    }
    this.cdp = await CdpHttpSession.connect(this.cdpPort, {
      poolSize: this.cdpPoolSize,
      minGapMs: this.cdpMinGapMs,
    });
    this.ownsCdp = true;
    return this.cdp;
  }

  async close(): Promise<void> {
    if (this.ownsCdp && this.cdp) {
      await this.cdp.close();
      this.cdp = undefined;
    }
  }

  private async request(
    endpointOrUrl: string,
    options: {
      method?: string;
      body?: unknown;
      raw?: boolean;
      absolute?: boolean;
    } = {}
  ): Promise<{ status: number; statusText: string; json?: unknown; raw?: ArrayBuffer; text?: string }> {
    const method = options.method ?? 'GET';
    const absolute =
      options.absolute ||
      endpointOrUrl.startsWith('http://') ||
      endpointOrUrl.startsWith('https://');
    const url = absolute ? endpointOrUrl : `${BASE_URL}${endpointOrUrl}`;

    if (this.usesCdp) {
      const cdp = await this.ensureCdp();
      const pathOrUrl = absolute ? url : endpointOrUrl;
      const response = await cdp.fetch(pathOrUrl, {
        method,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        headers:
          options.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : undefined,
        raw: options.raw,
      });

      if (options.raw) {
        const b64 = response.bodyBase64 ?? '';
        const binary = Buffer.from(b64, 'base64');
        return {
          status: response.status,
          statusText: response.statusText,
          raw: binary.buffer.slice(
            binary.byteOffset,
            binary.byteOffset + binary.byteLength
          ),
        };
      }

      let json: unknown;
      try {
        json = response.bodyText ? JSON.parse(response.bodyText) : null;
      } catch {
        json = undefined;
      }
      return {
        status: response.status,
        statusText: response.statusText,
        text: response.bodyText,
        json,
      };
    }

    // Node fallback (often Cloudflare-blocked)
    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (options.raw) {
      return {
        status: response.status,
        statusText: response.statusText,
        raw: await response.arrayBuffer(),
      };
    }
    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = undefined;
    }
    return {
      status: response.status,
      statusText: response.statusText,
      text,
      json,
    };
  }

  private throwForStatus(status: number, statusText: string, bodyPreview?: string): never {
    if (status === 401 || status === 403) {
      throw new AuthenticationError(
        `Access rejected (HTTP ${status})${
          this.usesCdp ? '' : ' — prefer CDP: prompt-exporter chromium start'
        }.${this.verbose && bodyPreview ? ` Body: ${bodyPreview.slice(0, 200)}` : ''}`
      );
    }
    if (status === 429) {
      throw new RateLimitError('Rate limited by API');
    }
    throw new NetworkError(`Request failed: ${status} ${statusText}`, status);
  }

  async initialize(): Promise<void> {
    if (this.usesCdp) {
      await this.ensureCdp();
    }

    const result = await this.request(
      '/backend-api/conversations?offset=0&limit=1&order=updated'
    );

    if (result.status < 200 || result.status >= 300) {
      if (this.verbose) {
        console.error(`Auth check failed: HTTP ${result.status}`);
        console.error(`Response body: ${(result.text ?? '').slice(0, 500)}`);
      }
      this.throwForStatus(result.status, result.statusText, result.text);
    }

    if (this.verbose) {
      console.log(
        this.usesCdp
          ? `Authenticated via Chromium CDP (port ${this.cdp?.debuggingPort ?? this.cdpPort})`
          : 'Successfully authenticated'
      );
    }
  }

  async fetch<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      parseResponse?: (data: unknown) => T;
      retryOptions?: Partial<RetryOptions>;
    } = {}
  ): Promise<T> {
    if (!this.usesCdp && !this.accessToken) {
      throw new AuthenticationError(
        'No access token and no CDP session. Run: prompt-exporter token'
      );
    }

    const { method = 'GET', body, parseResponse, retryOptions } = options;

    return withRetry(
      async () => {
        const result = await this.request(endpoint, { method, body });
        if (result.status < 200 || result.status >= 300) {
          this.throwForStatus(result.status, result.statusText, result.text);
        }
        const data = result.json;
        return parseResponse ? parseResponse(data) : (data as T);
      },
      {
        ...retryOptions,
        onRetry: (error, attempt, delay) => {
          if (this.verbose) {
            console.log(
              `Retry ${attempt}: ${error.message} (waiting ${Math.round(delay / 1000)}s)`
            );
          }
        },
      }
    );
  }

  async fetchRaw(
    url: string,
    retryOptions?: Partial<RetryOptions>
  ): Promise<ArrayBuffer> {
    const isAbsolute = url.startsWith('http://') || url.startsWith('https://');
    const fullUrl = isAbsolute ? url : `${BASE_URL}${url}`;
    const isSameOrigin = !isAbsolute || fullUrl.startsWith(BASE_URL);

    return withRetry(
      async () => {
        const result = await this.request(fullUrl, {
          absolute: true,
          raw: true,
        });
        if (result.status < 200 || result.status >= 300) {
          if (isSameOrigin && (result.status === 401 || result.status === 403)) {
            throw new AuthenticationError('Access token expired or invalid.');
          }
          this.throwForStatus(result.status, result.statusText);
        }
        return result.raw ?? new ArrayBuffer(0);
      },
      {
        ...retryOptions,
        onRetry: (error, attempt, delay) => {
          if (this.verbose) {
            console.log(
              `Retry ${attempt}: ${error.message} (waiting ${Math.round(delay / 1000)}s)`
            );
          }
        },
      }
    );
  }
}
