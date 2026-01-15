const axios = require('axios');
const cheerio = require('cheerio');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const crypto = require('crypto');

const jar = new CookieJar();

// --- CONFIGURAZIONE ---
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getTargetDomain(config) {
    let domain = "guardaserietv.asia"; 
    if (config && config.mediaflow && config.mediaflow.gsUrl && config.mediaflow.gsUrl.length > 3) {
        domain = config.mediaflow.gsUrl;
    }
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${domain}`;
}

function createClient(targetDomain) {
    const config = {
        jar,
        withCredentials: true,
        headers: {
            'User-Agent': UA,
            'Origin': targetDomain,
            'Referer': `${targetDomain}/`
        },
        timeout: 10000 
    };
    const instance = axios.create(config);
    return wrapper(instance);
}

// --- HELPER: GENERATORE DESCRIZIONI (STILE VIX) ---
function generateRichDescription(meta, provider, quality = "HD") {
    const lines = [];
    lines.push(`🎬 ${meta.title || "Episodio"}`);
    lines.push(`🇮🇹 ITA • 🔊 AAC`);
    lines.push(`🎞️ ${quality} • ⚡ Fast`);
    lines.push(`☁️ ${provider} • 🍿 GuardaSerie`);
    return lines.join("\n");
}

// --- HELPER: UNPACKER ---
function detectAndUnpack(html) {
    try {
        const regex = /eval\(function\(p,a,c,k,e,d\).*?return p\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = html.match(regex);
        if (!match) return null;

        let [_, p, a, c, k] = match;
        a = parseInt(a);
        c = parseInt(c);
        k = k.split('|');

        const e = (n) => (n < a ? '' : e(parseInt(n / a))) + ((n = n % a) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
        
        const dict = {};
        for (let i = 0; i < c; i++) dict[e(i)] = k[i] || e(i);

        return p.replace(/\b\w+\b/g, (w) => dict[w] || w);
    } catch (e) { return null; }
}

// --- PROVIDER 1: DROPLOAD (Ottimizzato) ---
async function extractDropload(client, dlUrl, referer, mfpUrl, mfpPsw, meta) {
    try {
        const response = await client.get(dlUrl, {
            headers: { 'User-Agent': UA, 'Referer': referer }
        });
        
        let html = response.data;
        let streamUrl = null;

        // 1. Cerca "file": "..."
        const fileRegex = /file\s*:\s*["']([^"']+)["']/;
        let m = html.match(fileRegex);
        if (m) streamUrl = m[1];

        // 2. Fallback Unpacker
        if (!streamUrl) {
            const unpacked = detectAndUnpack(html);
            if (unpacked) {
                m = unpacked.match(fileRegex);
                if (m) streamUrl = m[1];
            }
        }

        if (streamUrl) {
            return {
                name: `🛡️ GuardaSerie\n📦 Dropload`,
                title: generateRichDescription(meta, "Dropload", "FHD"),
                url: streamUrl,
                behaviorHints: {
                    notWebReady: false,
                    bingieGroup: "guardaserie-dropload",
                    proxyHeaders: {
                        request: {
                            "Referer": dlUrl,
                            "User-Agent": UA
                        }
                    }
                }
            };
        }
    } catch (e) {}
    return null;
}

// --- PROVIDER 2: LOADM (Legacy) ---
const KEY = Buffer.from('kiemtienmua911ca', 'utf-8');
const IV = Buffer.from('1234567890oiuytr', 'utf-8');

async function extractLoadM(client, playerUrl, referer, mfpUrl, mfpPsw, meta) {
    try {
        const parts = playerUrl.split('#');
        const id = parts[1];
        if (!id) return null;

        const playerDomain = new URL(playerUrl).origin;
        const apiUrl = `${playerDomain}/api/v1/video`;

        const response = await client.get(apiUrl, {
            headers: { 'Referer': playerUrl, 'User-Agent': UA },
            params: { id, w: '2560', h: '1440', r: referer },
            responseType: 'text'
        });

        const hexData = response.data;
        const cleanHex = hexData.replace(/[^0-9a-fA-F]/g, '');
        if (!cleanHex) return null;

        const encryptedBytes = Buffer.from(cleanHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
        decipher.setAutoPadding(false);

        let decrypted = Buffer.concat([decipher.update(encryptedBytes), decipher.final()]);
        const padLen = decrypted[decrypted.length - 1];
        if (padLen >= 1 && padLen <= 16) decrypted = decrypted.subarray(0, decrypted.length - padLen);

        const data = JSON.parse(decrypted.toString('utf-8'));
        const hls = data['cf'];
        
        if (hls) {
            let finalUrl = hls;
            // Gestione Proxy MFP (Opzionale per LoadM, ma utile)
            if (mfpUrl) {
                const proxyBase = mfpUrl.replace(/\/+$/, '');
                const params = new URLSearchParams();
                params.append('d', hls);
                if (mfpPsw) params.append('api_password', mfpPsw);
                params.append('h_Referer', playerUrl);
                params.append('h_User-Agent', UA);
                finalUrl = `${proxyBase}/proxy/hls/manifest.m3u8?${params.toString()}`;
            }

            return {
                name: `🛡️ GuardaSerie\n⚡ LoadM`,
                title: generateRichDescription(meta, "LoadM", "HD"),
                url: finalUrl,
                behaviorHints: {
                    notWebReady: false,
                    bingieGroup: "guardaserie-loadm",
                    proxyHeaders: { request: { "Referer": playerUrl } }
                }
            };
        }
    } catch (e) { return null; }
    return null;
}

// --- RICERCA & NAVIGAZIONE ---
async function searchGuardoserie(client, targetDomain, query, imdbId) {
    if (imdbId && imdbId.startsWith('tt')) {
        try {
            const searchUrl = `${targetDomain}/?story=${imdbId}&do=search&subaction=search`;
            const res = await client.get(searchUrl);
            const $ = cheerio.load(res.data);
            
            let href = null;
            $('.mlnh-2 h2 a, .mlnew h2 a, .movie-item a').each((_, el) => {
                if (!href) href = $(el).attr('href');
            });
            if (href) return href;
        } catch (e) {}
    }

    try {
        const simpleSearchUrl = `${targetDomain}/?s=${encodeURIComponent(query)}`;
        const res = await client.get(simpleSearchUrl);
        const $ = cheerio.load(res.data);
        
        const candidates = [];
        $('.mlnh-2 h2 a, .mlnew h2 a').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && text) candidates.push({ href, text });
        });

        const match = candidates.find(c => {
            const t = c.text.toLowerCase().replace(/[^a-z0-9]/g, '');
            const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
            return t.includes(q) || q.includes(t);
        });

        return match ? match.href : null;
    } catch (e) { return null; }
}

// --- CORE: RISOLUZIONE LINK (PARALLELA) ---
async function resolvePageStream(client, pageUrl, mfpUrl, mfpPsw, meta) {
    const streams = [];
    const { season, episode } = meta;

    try {
        const res = await client.get(pageUrl);
        const $ = cheerio.load(res.data);
        const links = new Set();

        if (season && episode) {
            const epId = `serie-${season}_${episode}`;
            const targetEl = $(`#${epId}`);
            
            if (targetEl.length > 0) {
                const direct = targetEl.attr('data-link') || targetEl.attr('href');
                if (direct && direct.length > 5) links.add(direct);
                
                const parentLi = targetEl.closest('li');
                parentLi.find('[data-link]').each((_, el) => links.add($(el).attr('data-link')));
            }
        }

        // Fallback: cerca tutto se non trova ID specifico
        if (links.size === 0) {
            $('iframe').each((_, el) => links.add($(el).attr('src') || $(el).attr('data-src')));
            $('[data-link]').each((_, el) => links.add($(el).attr('data-link')));
        }

        // Processamento Parallelo
        const processingPromises = Array.from(links).map(async (link) => {
            if (!link) return null;
            if (link.startsWith('//')) link = 'https:' + link;
            if (link.startsWith('/')) link = new URL(link, pageUrl).href;

            // Filtro provider (Supervideo rimosso come richiesto)
            if (link.includes('dropload')) {
                return await extractDropload(client, link, pageUrl, mfpUrl, mfpPsw, meta);
            } 
            else if (link.includes('loadm')) {
                return await extractLoadM(client, link, pageUrl, mfpUrl, mfpPsw, meta);
            }
            return null;
        });

        const results = await Promise.allSettled(processingPromises);
        
        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                streams.push(res.value);
            }
        });

    } catch (e) {
        console.error(`[GS] Resolve error: ${e.message}`);
    }
    return streams;
}

// --- ENTRY POINT ---
async function searchGuardaserie(meta, config) {
    if (!meta || !meta.isSeries) return []; 
    if (!config.filters || !config.filters.enableGs) return [];

    const targetDomain = getTargetDomain(config);
    const client = createClient(targetDomain);
    const mfpUrl = config.mediaflow ? config.mediaflow.url : null;
    const mfpPsw = config.mediaflow ? config.mediaflow.pass : null;

    try {
        const seriesUrl = await searchGuardoserie(client, targetDomain, meta.title, meta.imdb_id);
        if (!seriesUrl) return [];

        return await resolvePageStream(client, seriesUrl, mfpUrl, mfpPsw, meta);

    } catch (e) {
        console.error(`🛡️ [GS] Critical: ${e.message}`);
        return [];
    }
}

module.exports = { searchGuardaserie };
