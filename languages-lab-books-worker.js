// Cloudflare Workers — LANGUAGES LAB Books API — native JavaScript, no dependencies.
// Optional Worker secret: GOOGLE_BOOKS_API_KEY. CORS_ORIGINS can override the allowed-origin defaults.

const API_VERSION = '1.0.0';
const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1';
const OPEN_LIBRARY_BASE = 'https://openlibrary.org';
const COVER_BASE = 'https://covers.openlibrary.org';
const MAX_QUERY_LENGTH = 180;
const MAX_LIMIT = 40;
const MAX_PAGE = 250;
const UPSTREAM_TIMEOUT_MS = 8000;
const SEARCH_CACHE_SECONDS = 300;
const IP_WINDOW_MS = 60_000;
const IP_MAX_REQUESTS = 60;
const DEFAULT_CORS_ORIGINS = [
  'https://biblioteca-7daf5.web.app',
  'null',
  'https://appassets.androidplatform.net'
];
const ipBuckets = new Map();

const OPEN_LIBRARY_FIELDS = [
  'key', 'title', 'subtitle', 'author_name', 'publisher', 'publish_date',
  'first_publish_year', 'isbn', 'language', 'cover_i', 'cover_edition_key',
  'edition_count', 'subject', 'ia', 'editions', 'editions.key',
  'editions.title', 'editions.subtitle', 'editions.isbn_10',
  'editions.isbn_13', 'editions.publishers', 'editions.publish_date',
  'editions.languages', 'editions.covers', 'editions.ia',
  'editions.ebook_access', 'editions.number_of_pages'
].join(',');

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

function errorResponse(status, code, message, source = undefined, extra = {}, headers = {}) {
  const error = { code, message };
  if (source) error.source = source;
  return json({ success: false, error, ...extra }, status, headers);
}

function corsHeaders(origin, env) {
  const configuredValue = String(env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS.join(','));
  const configured = configuredValue
    .split(',').map(value => value.trim()).filter(Boolean);
  if (!origin) return {};
  if (!configured.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function rateLimit(request) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return false;
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.start >= IP_WINDOW_MS) {
    ipBuckets.set(ip, { start: now, count: 1 });
    if (ipBuckets.size > 5000) {
      for (const [key, entry] of ipBuckets) if (now - entry.start >= IP_WINDOW_MS) ipBuckets.delete(key);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > IP_MAX_REQUESTS;
}

function getQuery(url) {
  return (url.searchParams.get('q') || url.searchParams.get('titulo') || url.searchParams.get('title') || '')
    .normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePagination(url) {
  const rawPage = url.searchParams.get('page') || '1';
  const rawLimit = url.searchParams.get('limit') || url.searchParams.get('maxResults') || '10';
  if (!/^\d+$/.test(rawPage) || !/^\d+$/.test(rawLimit)) return { error: 'page e limit precisam ser inteiros positivos.' };
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (page < 1 || page > MAX_PAGE) return { error: `page deve ficar entre 1 e ${MAX_PAGE}.` };
  if (limit < 1 || limit > MAX_LIMIT) return { error: `limit deve ficar entre 1 e ${MAX_LIMIT}.` };
  return { page, limit };
}

async function fetchJson(url, source, headers = {}, validateSearchShape = true, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'LANGUAGES-LAB-Books/1.0 (Cloudflare Worker)', ...headers },
      signal: controller.signal
    });
    const elapsedMs = Date.now() - started;
    if (!response.ok) {
      console.error('books_upstream_http_error', JSON.stringify({ source, status: response.status }));
      return { ok: false, source, status: response.status, elapsedMs, error: response.status === 429 ? 'rate_limited' : 'http_error' };
    }
    let data;
    try { data = await response.json(); }
    catch (_) {
      console.error('books_upstream_invalid_json', JSON.stringify({ source, status: response.status }));
      return { ok: false, source, status: response.status, elapsedMs, error: 'invalid_json' };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, source, status: response.status, elapsedMs, error: 'invalid_payload' };
    }
    const validGoogleSearch = !validateSearchShape || source !== 'google_books'
      || (Number.isInteger(data.totalItems) && (data.items === undefined || Array.isArray(data.items)));
    const validOpenLibrarySearch = !validateSearchShape || source !== 'open_library'
      || (Array.isArray(data.docs) && Number.isFinite(Number(data.num_found ?? data.numFound)));
    if (!validGoogleSearch || !validOpenLibrarySearch) {
      console.error('books_upstream_invalid_shape', JSON.stringify({ source, status: response.status }));
      return { ok: false, source, status: response.status, elapsedMs, error: 'invalid_payload' };
    }
    return { ok: true, source, status: response.status, elapsedMs, data };
  } catch (error) {
    const timeout = error?.name === 'AbortError' || error?.name === 'TimeoutError';
    console.error('books_upstream_fetch_error', JSON.stringify({ source, error: timeout ? 'timeout' : (error?.name || 'network_error') }));
    return { ok: false, source, status: 0, elapsedMs: Date.now() - started, error: timeout ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

function toHttpsImage(raw, provider) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return url.href;
    const allowedHttpHosts = provider === 'google_books'
      ? new Set(['books.google.com', 'books.googleusercontent.com'])
      : new Set(['covers.openlibrary.org', 'openlibrary.org']);
    if (url.protocol === 'http:' && allowedHttpHosts.has(url.hostname.toLowerCase())) {
      url.protocol = 'https:';
      return url.href;
    }
  } catch (_) {}
  return null;
}

function cleanStrings(value, max = 12) {
  const values = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  return [...new Set(values.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean))].slice(0, max);
}

function cleanLanguages(value) {
  const values = Array.isArray(value) ? value : (value ? [value] : []);
  return values.map(item => {
    if (typeof item === 'string') return item.split('/').filter(Boolean).pop();
    if (item && typeof item.key === 'string') return item.key.split('/').filter(Boolean).pop();
    return null;
  }).filter(Boolean);
}

function normalizeGoogle(volume) {
  const info = volume?.volumeInfo || {};
  const identifiers = (info.industryIdentifiers || []).filter(item => item?.identifier);
  const isbn10 = identifiers.find(item => item.type === 'ISBN_10')?.identifier || null;
  const isbn13 = identifiers.find(item => item.type === 'ISBN_13')?.identifier || null;
  const images = info.imageLinks || {};
  const coverUrl = toHttpsImage(images.extraLarge || images.large || images.medium || images.thumbnail || images.smallThumbnail, 'google_books');
  return {
    id: `google:${volume.id}`,
    title: info.title || 'Untitled',
    subtitle: info.subtitle || null,
    authors: cleanStrings(info.authors),
    publisher: info.publisher || null,
    publishedDate: info.publishedDate || null,
    description: info.description || null,
    isbn: [...new Set([isbn10, isbn13].filter(Boolean))],
    isbn10,
    isbn13,
    relatedIsbns: [],
    language: info.language || null,
    coverUrl,
    hasCover: Boolean(coverUrl),
    infoLink: info.infoLink || volume.volumeInfo?.infoLink || volume.selfLink || null,
    previewLink: info.previewLink || null,
    pageCount: Number.isInteger(info.pageCount) ? info.pageCount : null,
    editionCount: null,
    categories: cleanStrings(info.categories),
    source: 'google_books',
    attribution: { name: 'Google Books', url: 'https://books.google.com/' }
  };
}

function normalizeOpenLibrary(work, edition = null) {
  const idPath = edition?.key || work.key || '';
  const idPart = idPath.replace(/^\/(books|works)\//, '');
  const workIsbns = cleanStrings(work.isbn, 40).map(isbn => isbn.replace(/[\s-]/g, '').toUpperCase());
  const editionIsbns = [...new Set([
    ...cleanStrings(edition?.isbn_10, 40),
    ...cleanStrings(edition?.isbn_13, 40),
    ...cleanStrings(edition?.isbn, 40)
  ].map(isbn => isbn.replace(/[\s-]/g, '').toUpperCase()))];
  const selectedIsbns = edition ? editionIsbns : [...new Set([...editionIsbns, ...workIsbns])];
  const isbn10 = selectedIsbns.find(isbn => isbn.replace(/[^0-9X]/g, '').length === 10) || null;
  const isbn13 = selectedIsbns.find(isbn => isbn.replace(/[^0-9X]/g, '').length === 13) || null;
  const coverId = edition?.covers?.find(id => Number.isInteger(id) && id > 0) || work.cover_i || null;
  const coverUrl = coverId ? toHttpsImage(`${COVER_BASE}/b/id/${coverId}-L.jpg?default=false`, 'open_library') : null;
  const archiveId = cleanStrings(edition?.ia || work.ia, 1)[0] || null;
  const langs = cleanLanguages(edition?.languages || work.language || []);
  return {
    id: `openlibrary:${idPart}`,
    title: edition?.title || work.title || 'Untitled',
    subtitle: edition?.subtitle || work.subtitle || null,
    authors: cleanStrings(work.author_name),
    publisher: cleanStrings(edition?.publishers || work.publisher, 1)[0] || null,
    publishedDate: cleanStrings(edition?.publish_date || work.publish_date, 1)[0] || (work.first_publish_year ? String(work.first_publish_year) : null),
    description: typeof work.description === 'string' ? work.description : work.description?.value || null,
    isbn: [...new Set([isbn10, isbn13, ...selectedIsbns].filter(Boolean))],
    relatedIsbns: edition ? workIsbns.filter(isbn => !selectedIsbns.includes(isbn)).slice(0, 10) : [],
    isbn10,
    isbn13,
    language: cleanStrings(langs, 1)[0] || null,
    coverUrl,
    hasCover: Boolean(coverUrl),
    infoLink: idPath ? `${OPEN_LIBRARY_BASE}${idPath}` : null,
    previewLink: archiveId ? `https://archive.org/details/${encodeURIComponent(archiveId)}` : null,
    pageCount: Number.isInteger(edition?.number_of_pages) ? edition.number_of_pages : null,
    editionCount: Number.isInteger(work.edition_count) ? work.edition_count : null,
    categories: cleanStrings(work.subject, 12),
    source: 'open_library',
    attribution: { name: 'Open Library', url: 'https://openlibrary.org/' }
  };
}

function googleUrl(query, page, limit, apiKey) {
  const url = new URL(`${GOOGLE_BOOKS_BASE}/volumes`);
  url.searchParams.set('q', query);
  url.searchParams.set('printType', 'books');
  url.searchParams.set('orderBy', 'relevance');
  url.searchParams.set('startIndex', String((page - 1) * limit));
  url.searchParams.set('maxResults', String(limit));
  if (apiKey) url.searchParams.set('key', apiKey);
  return url;
}

function openLibraryUrl(query, page, limit, lang) {
  const url = new URL(`${OPEN_LIBRARY_BASE}/search.json`);
  url.searchParams.set('q', query);
  url.searchParams.set('fields', OPEN_LIBRARY_FIELDS);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));
  if (lang) url.searchParams.set('lang', lang);
  return url;
}

function normalizeLanguageHint(value) {
  const code = String(value || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : '';
}

function identity(book) {
  const isbn = book.isbn13?.replace(/[^0-9Xx]/g, '')
    || book.isbn10?.replace(/[^0-9Xx]/g, '')
    || (book.isbn || []).map(value => value.replace(/[^0-9Xx]/g, '')).sort()[0];
  if (isbn) return `isbn:${isbn}`;
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `meta:${fold(book.title)}|${fold(book.authors.join(','))}|${fold(book.publishedDate)}|${fold(book.publisher)}`;
}

function mergeResults(googleItems, libraryItems) {
  const merged = new Map();
  for (const book of [...googleItems, ...libraryItems]) {
    const key = identity(book);
    const previous = merged.get(key);
    if (!previous) { merged.set(key, book); continue; }
    const preferred = previous.coverUrl ? previous : book;
    merged.set(key, {
      ...book,
      ...preferred,
      isbn: [...new Set([...previous.isbn, ...book.isbn])],
      coverUrl: previous.coverUrl || book.coverUrl,
      hasCover: Boolean(previous.coverUrl || book.coverUrl),
      sources: [...new Set([...(previous.sources || [previous.source]), ...(book.sources || [book.source])])],
      source: previous.source
    });
  }
  return [...merged.values()];
}

function matchesSearch(book, query) {
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const terms = fold(query).split(/\s+/).filter(term => term.length > 1);
  if (!terms.length) return true;
  const titleAuthor = fold([book.title, book.subtitle, ...(book.authors || [])].join(' '));
  const isbnQuery = query.replace(/[^0-9Xx]/g, '');
  if (isbnQuery.length >= 10 && (book.isbn || []).some(value => value.replace(/[^0-9Xx]/g, '').includes(isbnQuery))) return true;
  const matched = terms.filter(term => titleAuthor.includes(term)).length;
  return matched >= Math.max(1, Math.ceil(terms.length * 0.5));
}

function sourceSummary(result, count) {
  if (!result) return { enabled: false, ok: false, skipped: true, reason: 'No API key configured.' };
  if (!result.ok) return { enabled: true, ok: false, status: result.status || null, error: result.error, elapsedMs: result.elapsedMs };
  return { enabled: true, ok: true, status: result.status, count, elapsedMs: result.elapsedMs };
}

async function performSearch(query, page, limit, env, diagnostics = false) {
  const lang = normalizeLanguageHint(env.OPEN_LIBRARY_LANGUAGE);
  const tasks = [fetchJson(openLibraryUrl(query, page, limit, lang), 'open_library')];
  const googleEnabled = String(env.GOOGLE_BOOKS_ENABLED || 'true').toLowerCase() !== 'false';
  if (googleEnabled) tasks.push(fetchJson(googleUrl(query, page, limit, env.GOOGLE_BOOKS_API_KEY), 'google_books', {}, true, 5000));
  const settled = await Promise.all(tasks);
  const openResult = settled.find(item => item.source === 'open_library');
  const googleResult = settled.find(item => item.source === 'google_books') || null;
  const openWorks = openResult?.ok && Array.isArray(openResult.data.docs) ? openResult.data.docs : [];
  const openBooks = [];
  for (const work of openWorks) {
    const editions = work.editions?.docs;
    if (Array.isArray(editions) && editions.length) {
      for (const edition of editions) openBooks.push(normalizeOpenLibrary(work, edition));
    } else {
      openBooks.push(normalizeOpenLibrary(work));
    }
  }
  const googleItems = googleResult?.ok && Array.isArray(googleResult.data.items)
    ? googleResult.data.items.map(normalizeGoogle).filter(book => book.id !== 'google:undefined') : [];
  const successfulSources = settled.filter(item => item.ok).length;
  const sourceStates = {
    open_library: sourceSummary(openResult, openBooks.length),
    ...(googleEnabled ? { google_books: sourceSummary(googleResult, googleItems.length) } : {
      google_books: { enabled: false, ok: false, skipped: true, reason: 'GOOGLE_BOOKS_ENABLED=false.' }
    })
  };
  if (!successfulSources) {
    const failures = settled.map(item => `${item.source}:${item.error}`).join(',');
    return { failed: true, error: { code: 'UPSTREAM_API_ERROR', message: 'Não foi possível consultar nenhuma fonte bibliográfica.', source: settled.length > 1 ? 'multiple' : 'open_library' }, diagnostics: { sources: sourceStates, failures } };
  }

  const results = mergeResults(googleItems, openBooks).filter(book => matchesSearch(book, query));
  const warnings = settled.filter(item => !item.ok).map(item => ({ source: item.source, error: item.error, status: item.status || null }));
  const total = Math.max(
    Number(openResult?.ok ? openResult.data.num_found ?? openResult.data.numFound ?? 0 : 0),
    Number(googleResult?.ok ? googleResult.data.totalItems || 0 : 0)
  );
  return {
    failed: false,
    data: {
      success: true,
      query,
      page,
      limit,
      total,
      returned: results.length,
      results,
      livros: results,
      partial: warnings.length > 0,
      warnings,
      message: results.length ? null : (warnings.length
        ? 'A fonte disponível não encontrou resultados; outra fonte falhou. Consulte warnings ou /diagnostics.'
        : 'Pesquisa concluída sem resultados nas fontes consultadas.'),
      attribution: [
        { name: 'Open Library', url: 'https://openlibrary.org/' },
        ...(googleEnabled ? [{ name: 'Google Books', url: 'https://books.google.com/' }] : [])
      ],
      ...(diagnostics ? { diagnostics: { sources: sourceStates, successfulSources, attemptedSources: settled.length } } : {})
    },
    diagnostics: { sources: sourceStates, successfulSources, attemptedSources: settled.length }
  };
}

async function getCached(request, ctx) {
  try { return await caches.default.match(request); }
  catch (_) { return null; }
}

async function putCached(request, response, ctx) {
  try { await caches.default.put(request, response.clone()); }
  catch (_) {}
  return response;
}

async function getBook(id, env) {
  if (id.startsWith('google:')) {
    const volumeId = id.slice('google:'.length);
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(volumeId)) return { badId: true };
    const url = new URL(`${GOOGLE_BOOKS_BASE}/volumes/${encodeURIComponent(volumeId)}`);
    if (env.GOOGLE_BOOKS_API_KEY) url.searchParams.set('key', env.GOOGLE_BOOKS_API_KEY);
    const result = await fetchJson(url, 'google_books', {}, false);
    if (!result.ok) return { upstream: result };
    return { book: normalizeGoogle(result.data), source: result };
  }
  if (id.startsWith('openlibrary:')) {
    const key = id.slice('openlibrary:'.length);
    if (!/^(?:OL\d+(?:M|W)|work\/OL\d+W)$/.test(key)) return { badId: true };
    const isWork = key.startsWith('work/') || key.endsWith('W');
    const path = isWork ? `/works/${key.replace(/^work\//, '')}.json` : `/books/${key}.json`;
    const result = await fetchJson(`${OPEN_LIBRARY_BASE}${path}`, 'open_library', {}, false);
    if (!result.ok) return { upstream: result };
    const edition = isWork ? null : result.data;
    let work = isWork ? result.data : null;
    if (!work && edition?.works?.[0]?.key) {
      const workResult = await fetchJson(`${OPEN_LIBRARY_BASE}${edition.works[0].key}.json`, 'open_library', {}, false);
      if (workResult.ok) work = workResult.data;
    }
    if (isWork) {
      const editionsResult = await fetchJson(`${OPEN_LIBRARY_BASE}${path.replace('.json', '')}/editions.json?limit=10`, 'open_library', {}, false);
      const firstEdition = editionsResult.ok ? editionsResult.data.entries?.[0] : null;
      if (firstEdition) return { book: normalizeOpenLibrary(work, firstEdition), source: result };
    }
    work = work || {};
    if (!work.author_name?.length) {
      const authors = work.authors || edition?.authors || [];
      const authorKeys = authors.map(item => item.author?.key || item.key).filter(key => typeof key === 'string' && /^\/authors\/OL\d+A$/.test(key)).slice(0, 3);
      const authorResults = await Promise.all(authorKeys.map(key => fetchJson(`${OPEN_LIBRARY_BASE}${key}.json`, 'open_library', {}, false)));
      work.author_name = authorResults.filter(item => item.ok).map(item => item.data.name).filter(Boolean);
    }
    return { book: normalizeOpenLibrary(work, edition), source: result };
  }
  // Backward compatibility: unprefixed IDs are treated as Google Books volume IDs.
  return getBook(`google:${id}`, env);
}

function diagnosticsSummary(outcome) {
  if (outcome.failed) return outcome.diagnostics;
  return outcome.diagnostics;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      if (cors === null) return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada. Configure CORS_ORIGINS no Worker.');
      return new Response(null, { status: 204, headers: cors || {} });
    }
    if (cors === null) return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada. Configure CORS_ORIGINS no Worker.');
    const fail = (status, code, message, source, extra) => errorResponse(status, code, message, source, extra, cors || {});
    if (request.method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED', 'Use o método GET ou OPTIONS.', undefined, { allowedMethods: ['GET', 'OPTIONS'] });

    const route = url.pathname.replace(/\/+$/, '') || '/';
    const headers = cors || {};
    if (route === '/health') {
      return json({ success: true, status: 'ok', service: 'LANGUAGES LAB Books API', version: API_VERSION, timestamp: new Date().toISOString() }, 200, headers);
    }
    if (route === '/') {
      return json({
        success: true,
        service: 'LANGUAGES LAB Books API',
        version: API_VERSION,
        status: 'online',
        endpoints: {
          search: '/search?q=The%20Little%20Prince&page=1&limit=10',
          book: '/book?id=google:VOLUME_ID',
          health: '/health',
          diagnostics: '/diagnostics?q=The%20Little%20Prince'
        },
        sources: ['Open Library', ...(String(env.GOOGLE_BOOKS_ENABLED || 'true').toLowerCase() !== 'false' ? ['Google Books'] : [])]
      }, 200, headers);
    }
    if (route !== '/search' && route !== '/diagnostics' && route !== '/book') {
      return fail(404, 'NOT_FOUND', 'Endpoint não encontrado.', undefined, { endpoints: ['/', '/search', '/book', '/health', '/diagnostics'] });
    }
    if (rateLimit(request)) return fail(429, 'RATE_LIMITED', 'Limite temporário de requisições excedido. Aguarde um minuto.', undefined, { retryAfterSeconds: 60 });

    if (route === '/book') {
      const id = String(url.searchParams.get('id') || '').trim();
      if (!id) return fail(400, 'MISSING_ID', 'Informe id do livro. Exemplo: /book?id=google:VOLUME_ID.');
      if (id.length > 200) return fail(400, 'INVALID_ID', 'O parâmetro id excede 200 caracteres.');
      const found = await getBook(id, env);
      if (found.badId) return fail(400, 'INVALID_ID', 'Formato de id inválido. Use o id devolvido por /search.');
      if (found.upstream) {
        if (found.upstream.status === 404) return fail(404, 'BOOK_NOT_FOUND', 'Livro não encontrado na fonte.', found.upstream.source);
        return fail(502, 'UPSTREAM_API_ERROR', 'Não foi possível consultar a fonte bibliográfica.', found.upstream.source, { upstreamStatus: found.upstream.status || null, upstreamError: found.upstream.error });
      }
      return json({ success: true, book: found.book, attribution: found.book.attribution }, 200, headers);
    }

    const query = getQuery(url);
    if (!query) return fail(400, 'MISSING_QUERY', 'Informe q ou titulo. Exemplo: /search?q=The%20Little%20Prince.');
    if (query.length > MAX_QUERY_LENGTH) return fail(400, 'QUERY_TOO_LONG', `A pesquisa pode ter no máximo ${MAX_QUERY_LENGTH} caracteres.`);
    const pagination = parsePagination(url);
    if (pagination.error) return fail(400, 'INVALID_PAGINATION', pagination.error);
    const { page, limit } = pagination;
    const isDiagnostics = route === '/diagnostics';

    if (!isDiagnostics) {
      const cacheUrl = new URL(request.url);
      cacheUrl.searchParams.set('_apiVersion', API_VERSION);
      const cacheRequest = new Request(cacheUrl.toString(), { method: 'GET' });
      const cached = await getCached(cacheRequest, ctx);
      if (cached) {
        const payload = await cached.json();
        return json(payload, cached.status, { ...headers, 'X-Books-Cache': 'HIT' });
      }
      const outcome = await performSearch(query, page, limit, env);
      if (outcome.failed) return fail(502, outcome.error.code, outcome.error.message, outcome.error.source, { diagnostics: outcome.diagnostics, failures: outcome.diagnostics.failures });
      const response = json(outcome.data, 200, { ...headers, 'Cache-Control': `public, max-age=60, s-maxage=${SEARCH_CACHE_SECONDS}`, 'X-Books-Cache': 'MISS' });
      return putCached(cacheRequest, response, ctx);
    }

    const outcome = await performSearch(query, page, limit, env, true);
    if (outcome.failed) {
      return fail(502, outcome.error.code, outcome.error.message, outcome.error.source, {
        query, diagnostics: diagnosticsSummary(outcome), failures: outcome.diagnostics.failures
      });
    }
    return json({
      success: true,
      query,
      diagnostics: diagnosticsSummary(outcome),
      returned: outcome.data.returned,
      hasCover: outcome.data.results.filter(book => book.hasCover).length,
      warnings: outcome.data.warnings,
      resultSample: outcome.data.results.slice(0, 3).map(book => ({ id: book.id, title: book.title, authors: book.authors, hasCover: book.hasCover, source: book.source }))
    }, 200, headers);
  }
};
