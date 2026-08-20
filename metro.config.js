const { getDefaultConfig } = require('expo/metro-config');
const http = require('node:http');
const https = require('node:https');

const AI_WEB_PROXY_PATH = '/__jianji_ai_proxy';

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'authorization',
  'anthropic-version',
  'cache-control',
  'content-length',
  'content-type',
  'x-api-key',
];

const FORWARDED_RESPONSE_HEADERS = [
  'cache-control',
  'content-type',
  'retry-after',
  'x-request-id',
  'request-id',
  'anthropic-request-id',
  'cf-ray',
];

function rejectProxyRequest(response, statusCode, message) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ error: message }));
}

function isAllowedTarget(targetUrl) {
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    return false;
  }
  const pathname = targetUrl.pathname.replace(/\/+$/, '');
  return pathname.endsWith('/responses')
    || pathname.endsWith('/messages')
    || pathname.endsWith('/models');
}

function createAIWebProxyMiddleware(middleware) {
  return (request, response, next) => {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    if (requestUrl.pathname !== AI_WEB_PROXY_PATH) {
      return middleware(request, response, next);
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      rejectProxyRequest(response, 405, 'AI Web 代理仅支持 GET 与 POST');
      return undefined;
    }

    const targetValue = requestUrl.searchParams.get('target');
    if (!targetValue) {
      rejectProxyRequest(response, 400, 'AI Web 代理缺少 target');
      return undefined;
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetValue);
    } catch {
      rejectProxyRequest(response, 400, 'AI Web 代理 target 不是有效 URL');
      return undefined;
    }

    if (!isAllowedTarget(targetUrl)) {
      rejectProxyRequest(response, 403, 'AI Web 代理只允许 Responses、Messages 与模型列表接口');
      return undefined;
    }

    const transport = targetUrl.protocol === 'https:' ? https : http;
    const headers = {};
    for (const headerName of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers[headerName];
      if (typeof value === 'string') {
        headers[headerName] = value;
      }
    }

    const upstream = transport.request(targetUrl, {
      method: request.method,
      headers,
    }, (upstreamResponse) => {
      response.statusCode = upstreamResponse.statusCode || 502;
      for (const headerName of FORWARDED_RESPONSE_HEADERS) {
        const value = upstreamResponse.headers[headerName];
        if (typeof value === 'string' || Array.isArray(value)) {
          response.setHeader(headerName, value);
        }
      }
      response.setHeader('x-accel-buffering', 'no');
      if (typeof response.flushHeaders === 'function') {
        response.flushHeaders();
      }
      upstreamResponse.pipe(response);
    });

    upstream.on('error', (error) => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      rejectProxyRequest(response, 502, 'AI Web 代理无法连接到上游服务');
    });

    request.on('aborted', () => upstream.destroy());
    response.on('close', () => {
      if (!response.writableEnded) {
        upstream.destroy();
      }
    });
    request.pipe(upstream);
    return undefined;
  };
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'wasm' to asset extensions to resolve SQLite for web
config.resolver.assetExts.push('wasm');

const defaultEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = defaultEnhanceMiddleware
    ? defaultEnhanceMiddleware(middleware, server)
    : middleware;
  return createAIWebProxyMiddleware(enhanced);
};

module.exports = config;
