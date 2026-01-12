const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

// ==============================================================================
// 1. HELPER & UTILITIES
// ==============================================================================

const CACHE_FILE = path.join(__dirname, '..', 'config', 'guardahd_embeds.json');
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 Ore
const BASE_URL = 'https://mostraguarda.stream';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

const HEADERS_DEF = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Referer': 'https://google.com/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};

function normalizeUrl(url) {
    if (!url) return '';
    return url.startsWith('//') ? 'https:' + url : url;
}

// --- GENERATORE DESCRIZIONE DETTAGLIATA (Stile SC) ---
function generateRichDescription(title) {
    const lines = [];
    lines.push(`🎬 ${title || "Video"}`);
    lines.push(`🇮🇹 ITA • 🔊 AAC`);
    lines.push(`🎞️ HLS/MP4 • Streaming Web`);
    lines.push(`☁️ Web Stream • ⚡ Instant`);
    lines.push(`🦁 GuardaHD`); 
    return lines.join("\n");
}

// Funzione Unpack (P.A.C.K.E.D decoder per SuperVideo)
function detectAndUnpack(html) {
    const evalMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*?\)\)/s);
    if (!evalMatch) return null;
    
    try {
        let p, a, c, k, e, d;
        const packed = evalMatch[0];
        const regex = /}\('(.+?)',(\d+),(\d+),'(.+?)'\.split\('\|'\)/;
        const m = packed.match(regex);
        if (m) {
            p = m[1];
            a = parseInt(m[2]);
            c = parseInt(m[3]);
            k = m[4].split('|');
            
            const decode = function(c) {
                return (c < a ? '' : decode(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
            };
            
            while (c--) {
                if (k[c]) {
                    p = p.replace(new RegExp('\\b' + decode(c) + '\\b', 'g'), k[c]);
                }
            }
            return p;
        }
    } catch (err) {
        console.log(`[GHD-DEBUG] ⚠️ Errore unpacking: ${err.message}`);
    }
    return null;
}

async function fetchText(url, referer, extraHeaders = {}) {
    try {
        // console.log(`[GHD] Fetching: ${url}`);
        const headers = { ...HEADERS_DEF, ...extraHeaders };
        if (referer) headers.Referer = referer;
        
        const response = await axios.get(url, { 
            headers, 
            httpsAgent: insecureAgent,
            timeout: 10000, 
            validateStatus: () => true,
            maxRedirects: 5
        });
        
        if (response.status >= 200 && response.status < 400) {
            return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        }
        return null;
    } catch (e) {
        console.error(`[GHD] Errore Fetch su ${url}: ${e.message}`);
        return null;
    }
}

// ==============================================================================
// 2. ESTRATTORI (SOLO MIXDROP & SUPERVIDEO)
// ==============================================================================

// --- MIXDROP EXTRACTOR ---
const MixdropExtractor = {
    id: 'mixdrop',
    supports: (url) => /mixdrop/i.test(url),
    extract: async (rawUrl, config, titleHint) => {
        if (!config.mediaflow || !config.mediaflow.url) return [];

        let embedUrl = normalizeUrl(rawUrl).replace('/f/', '/e/');
        if (!/\/e\//.test(embedUrl)) embedUrl = embedUrl.replace('/f/', '/e/');
        
        const encoded = encodeURIComponent(embedUrl);
        const mfpUrl = config.mediaflow.url.replace(/\/$/, '');
        const passwordParam = config.mediaflow.pass ? `&api_password=${encodeURIComponent(config.mediaflow.pass)}` : '';
        const finalUrl = `${mfpUrl}/extractor/video?host=Mixdrop${passwordParam}&d=${encoded}&redirect_stream=true`;
        
        const richTitle = generateRichDescription(titleHint);

        return [{
            name: `🦁 GuardaHD\n📦 MixDrop`, // Stile SC: Provider sopra, Dettaglio sotto
            title: richTitle,
            url: finalUrl,
            behaviorHints: { notWebReady: true }
        }];
    }
};

// --- SUPERVIDEO EXTRACTOR ---
const SuperVideoExtractor = {
    id: 'supervideo',
    supports: (url) => /supervideo/i.test(url),
    extract: async (rawUrl, config, titleHint) => {
        try {
            const normalized = normalizeUrl(rawUrl);
            const id = normalized.split('/').pop().replace('.html', '');
            const embedUrl = `https://supervideo.tv/e/${id}`;

            const html = await fetchText(embedUrl, normalized);
            if (!html) return [];

            let m3u8 = '';

            // TENTATIVO 1: Unpacking
            const packedMatch = html.match(/}\('(.+?)',.+,'(.+?)'\.split/);
            if (packedMatch) {
                try {
                    const terms = packedMatch[2].split('|');
                    const hfs = terms.find(t => t.includes('hfs'));
                    const urlsetIndex = terms.indexOf('urlset');
                    const hlsIndex = terms.indexOf('hls');
                    
                    if (hfs && urlsetIndex !== -1 && hlsIndex !== -1 && hlsIndex > urlsetIndex) {
                        const slice = terms.slice(urlsetIndex + 1, hlsIndex);
                        const reversed = slice.reverse();
                        
                        let base = `https://${hfs}.serversicuro.cc/hls/`;
                        let pathPart = '';
                        if (reversed.length === 1) pathPart = reversed[0];
                        else pathPart = reversed.join(',');
                        
                        m3u8 = `${base}${pathPart}.urlset/master.m3u8`;
                    }
                } catch (e) {
                    console.log(`[GHD] Errore Unpack SuperVideo: ${e.message}`);
                }
            }

            // TENTATIVO 2: Regex Fallback
            if (!m3u8) {
                const sourceMatch = html.match(/sources:\s*\[\s*\{.*?file:\s*["'](.*?)["']/);
                if (sourceMatch) m3u8 = sourceMatch[1];
            }
            if (!m3u8) {
                const fileMatch = html.match(/file:\s*["'](http[^"']+)["']/);
                if (fileMatch) m3u8 = fileMatch[1];
            }

            if (!m3u8) return [];

            const richTitle = generateRichDescription(titleHint);

            return [{
                name: `🦁 GuardaHD\n⚡ SuperVideo`, // Stile SC
                title: richTitle,
                url: m3u8,
                behaviorHints: { notWebReady: true }
            }];

        } catch (e) {
            console.error(`[GHD] Errore SuperVideo: ${e.message}`);
            return [];
        }
    }
};

const EXTRACTORS = [MixdropExtractor, SuperVideoExtractor];

// ==============================================================================
// 3. LOGICA PRINCIPALE
// ==============================================================================

function readEmbedCache() {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, '{}');
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) { return {}; }
}

function writeEmbedCache(cache) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) { /* ignore */ }
}

function purgeOldEmbeds(cache) {
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(cache)) {
        if (now - cache[k].timestamp > CACHE_TTL) {
            delete cache[k];
            changed = true;
        }
    }
    if (changed) writeEmbedCache(cache);
}

// Risolutore Stream
async function resolveUrlToStream(url, config, titleHint) {
    for (const extractor of EXTRACTORS) {
        if (extractor.supports(url)) {
            const results = await extractor.extract(url, config, titleHint);
            if (results && results.length > 0) return results;
        }
    }
    return [];
}

// Estrattore URL
function extractEmbedUrlsFromHtml(html) {
    const $ = cheerio.load(html);
    const urls = $('[data-link]').map((_, el) => {
        let u = ($(el).attr('data-link') || '').trim();
        if (u.startsWith('//')) u = 'https:' + u;
        return u;
    }).get();

    const supportedDomains = ['mixdrop', 'supervideo'];
    const filtered = [...new Set(urls.filter(u => {
        if (!u || !/^https?:/i.test(u) || u.includes('mostraguarda')) return false;
        return supportedDomains.some(d => u.includes(d));
    }))];
    
    return filtered;
}

// --- ENTRY POINT ---
async function searchGuardaHD(meta, config) {
    if (meta.isSeries) return [];

    const imdbId = meta.imdb_id;
    if (!imdbId) return [];

    // console.log(`[GHD] Ricerca per ${imdbId}`);

    const cache = readEmbedCache();
    purgeOldEmbeds(cache);
    
    let embedUrls = [];
    let realTitle = meta.title;
    
    if (cache[imdbId] && (Date.now() - cache[imdbId].timestamp < CACHE_TTL)) {
        embedUrls = cache[imdbId].embedUrls;
        realTitle = cache[imdbId].title || meta.title;
    } else {
        try {
            const html = await fetchText(`${BASE_URL}/movie/${imdbId}`, null);
            if (html) {
                const $ = cheerio.load(html);
                const pageTitle = $('h1').first().text().trim();
                if (pageTitle) realTitle = pageTitle.replace(/Streaming.*$/i, '').trim();

                embedUrls = extractEmbedUrlsFromHtml(html);
                
                if (embedUrls.length > 0) {
                    cache[imdbId] = { timestamp: Date.now(), embedUrls, title: realTitle };
                    writeEmbedCache(cache);
                }
            }
        } catch (e) {
            console.error(`[GHD] Scraping error: ${e.message}`);
            return [];
        }
    }

    const finalStreams = [];
    const promises = embedUrls.map(async (url) => {
        return resolveUrlToStream(url, config, realTitle);
    });

    const results = await Promise.all(promises);
    results.forEach(arr => finalStreams.push(...arr));

    return finalStreams;
}

module.exports = { searchGuardaHD };
