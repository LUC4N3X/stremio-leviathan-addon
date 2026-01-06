const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const cloudscraper = require("cloudscraper");
const pLimit = require("p-limit");
const he = require("he"); 

// --- CONFIGURAZIONE AVANZATA BROWSER ---
const BROWSER_PROFILES = [
    {
        name: "Chrome Win",
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        headers: {
            'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            'upgrade-insecure-requests': '1'
        }
    },
    {
        name: "Firefox Win",
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3',
            'upgrade-insecure-requests': '1',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin'
        }
    }
];

// --- CONFIGURAZIONE CENTRALE ---
const CONFIG = {
    TIMEOUT: 7000,      // Timeout standard per scraping HTML
    TIMEOUT_API: 3500,  // Timeout veloce per API JSON
    KNABEN_API: "https://api.knaben.org/v1",
    TRACKERS: [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://open.demonoid.ch:6969/announce",
        "udp://open.demonii.com:1337/announce",
        "udp://open.stealth.si:80/announce",
        "udp://tracker.torrent.eu.org:451/announce",
        "udp://tracker.therarbg.to:6969/announce",
        "udp://tracker.doko.moe:6969/announce",
        "udp://opentracker.i2p.rocks:6969/announce",
        "udp://exodus.desync.com:6969/announce", 
        "udp://tracker.moeking.me:6969/announce"
    ],
    HTTPS_AGENT_OPTIONS: { rejectUnauthorized: false, keepAlive: true } 
};

// --- UTILS & HELPERS ---

const httpsAgent = new https.Agent(CONFIG.HTTPS_AGENT_OPTIONS);

const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
]);

// 🔍 Funzione di pulizia ottimizzata con 'he'
function clean(title) {
    if (!title) return "";
    let decoded = he.decode(title); // Decodifica HTML corretta
    return decoded
        .replace(/[:"'’]/g, "")           // Via apostrofi e virgolette
        .replace(/[^a-zA-Z0-9\s\-.\[\]()]/g, " ") // Via caratteri strani
        .replace(/\s+/g, " ")             // Normalizza spazi
        .trim();
}

function parseSize(sizeStr) {
    if (!sizeStr) return 0;
    const match = sizeStr.toString().match(/([\d.,]+)\s*(TB|GB|MB|KB|GiB|MiB|KiB|B)/i);
    if (!match) return 0;
    let val = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();
    
    // Normalizzazione unità (gestisce anche GiB/MiB)
    const mult = { 
        TB: 1099511627776, TiB: 1099511627776,
        GB: 1073741824, GiB: 1073741824,
        MB: 1048576, MiB: 1048576,
        KB: 1024, KiB: 1024,
        B: 1 
    };
    
    return Math.round(val * (mult[unit] || 1));
}

function bytesToSize(bytes) {
    return (bytes / 1073741824).toFixed(2) + " GB";
}

// 🇮🇹 Validazione Risultati ITA
function isValidResult(name, allowEng = false) {
    if (!name) return false;
    const nameUpper = name.toUpperCase();
    
    // Regex rigorosa per contenuti ITA
    const ITA_REGEX = /\b(ITA(LIANO)?|MULTI|DUAL|MD|SUB\.?ITA|SUB-?ITA|ITALUB|AC3\.?ITA|DTS\.?ITA|AUDIO\.?ITA|ITA\.?AC3|ITA\.?HD|BDMUX|DVDRIP\.?ITA|STAGIONE|EPISODIO|SERIE|COMPLETA|CiNEFiLE|iDN_CreW|CORSARO|SPEEDVIDEO|WMS|TRIDIM|LUX|MUX)\b/i;
    
    if (ITA_REGEX.test(nameUpper)) return true;
    
    if (!allowEng) return false;
    
    // Esclusione lingue straniere indesiderate se allowEng è attivo
    const FOREIGN_REGEX = /\b(FRENCH|GERMAN|SPANISH|LATINO|RUSSIAN|HINDI|TAMIL|TELUGU|KOREAN)\b/i;
    if (FOREIGN_REGEX.test(nameUpper) && !/MULTI/i.test(nameUpper)) return false;
    
    return true; 
}

function checkYear(name, year, type) {
    if (!year || type === 'tv' || type === 'series') return true;
    // Tolleranza +/- 1 anno per i film
    const y = parseInt(year);
    return name.includes(String(y)) || name.includes(String(y - 1)) || name.includes(String(y + 1));
}

function isCorrectFormat(name, reqSeason, reqEpisode) {
    if (!reqSeason && !reqEpisode) return true;
    // Se cerchiamo un episodio specifico, scartiamo risultati che sono palesemente altri episodi
    // Ma accettiamo "Season Packs" (es. S01 Complete)
    const sMatch = name.match(/S(\d{1,2})/i);
    const eMatch = name.match(/E(\d{1,3})/i);
    
    if (reqSeason && sMatch) {
        if (parseInt(sMatch[1]) !== reqSeason) return false;
    }
    
    if (reqEpisode && eMatch) {
        // Se c'è scritto E05 e cerchiamo E05 -> OK
        // Se c'è scritto E09 e cerchiamo E05 -> NO
        // Se non c'è scritto Exx (è un pack) -> OK
        if (parseInt(eMatch[1]) !== reqEpisode) return false;
    }
    return true;
}

// --- STEALTH HTTP REQUEST ---

function getStealthHeaders(url) {
    const profile = BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
    const urlObj = new URL(url);
    return {
        headers: {
            'User-Agent': profile.userAgent,
            'Referer': urlObj.origin + '/',
            'Origin': urlObj.origin,
            ...profile.headers 
        }
    };
}

async function requestHtml(url, config = {}) {
    const { headers: stealthHeaders } = getStealthHeaders(url);
    const finalHeaders = { ...stealthHeaders, ...config.headers };
    
    try {
        const response = await axios({
            url,
            method: config.method || 'GET',
            headers: finalHeaders,
            data: config.data,
            httpsAgent,
            timeout: config.timeout || CONFIG.TIMEOUT,
            validateStatus: s => s < 500
        });
        
        if (typeof response.data === 'string' && (response.data.includes("Cloudflare") || response.data.includes("Verify you are human"))) {
            throw new Error("CF");
        }
        return response;
    } catch (err) {
        // Fallback Cloudscraper per Cloudflare
        if (config.method !== 'POST') {
            try {
                const html = await cloudscraper.get(url, { headers: finalHeaders });
                return { data: html };
            } catch (e) { return { data: "" }; }
        }
        return { data: "" };
    }
}

// ==========================================
//  MOTORI DI RICERCA
// ==========================================

async function searchCorsaro(title, year, type, reqSeason, reqEpisode, options = {}) {
    try {
        const url = `https://ilcorsaronero.link/search?q=${encodeURIComponent(clean(title))}`;
        const { data } = await requestHtml(url);
        if (!data || data.includes("Cloudflare")) return [];
        
        const $ = cheerio.load(data);
        let candidates = [];

        $('table tr').each((i, row) => {
            const tds = $(row).find('td');
            if (tds.length < 5) return;
            
            const linkTag = $(row).find('a[href*="/torrent/"]');
            const name = linkTag.text().trim();
            const href = linkTag.attr('href');
            
            if (isValidResult(name, options.allowEng) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                const sizeStr = tds.eq(4).text().trim();
                const seeders = parseInt($(row).find('.green, font[color="#008000"]').text()) || 0;
                
                candidates.push({
                    name, 
                    url: href.startsWith('http') ? href : `https://ilcorsaronero.link${href}`,
                    sizeStr,
                    seeders
                });
            }
        });

        const limit = pLimit(5);
        const results = await Promise.all(candidates.slice(0, 10).map(c => limit(async () => {
            try {
                const html = (await requestHtml(c.url, { timeout: 3500 })).data;
                const magnet = html.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]{40}/i)?.[0];
                if (magnet) return {
                    title: c.name, magnet, size: c.sizeStr, sizeBytes: parseSize(c.sizeStr), seeders: c.seeders, source: "Corsaro"
                };
            } catch {}
            return null;
        })));
        
        return results.filter(Boolean);
    } catch { return []; }
}

async function searchKnaben(title, year, type, reqSeason, reqEpisode, options = {}) {
    try {
        let query = clean(title);
        if (!options.allowEng && !query.toUpperCase().includes("ITA")) query += " ITA";

        const payload = { "search_field": "title", "query": query, "hide_xxx": true };
        const { data } = await requestHtml(CONFIG.KNABEN_API, { method: 'POST', data: payload, timeout: CONFIG.TIMEOUT_API });

        if (!data?.hits) return [];
        
        return data.hits.map(h => {
            if (!h.title || !h.magnetUrl) return null;
            if (isValidResult(h.title, options.allowEng) && checkYear(h.title, year, type) && isCorrectFormat(h.title, reqSeason, reqEpisode)) {
                return {
                    title: h.title, magnet: h.magnetUrl, 
                    size: bytesToSize(h.bytes), sizeBytes: parseInt(h.bytes), 
                    seeders: parseInt(h.seeders), source: "Knaben"
                };
            }
            return null;
        }).filter(Boolean);
    } catch { return []; }
}

async function searchTPB(title, year, type, reqSeason, reqEpisode, options = {}) {
    try {
        let q = clean(title);
        if (!options.allowEng && !q.toUpperCase().includes("ITA")) q += " ITA";
        
        const { data } = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(q)}&cat=${type==='tv'?0:200}`, { timeout: CONFIG.TIMEOUT_API });
        
        if (!Array.isArray(data) || data[0]?.id === '0') return [];

        return data.map(i => {
            if (isValidResult(i.name, options.allowEng) && checkYear(i.name, year, type) && isCorrectFormat(i.name, reqSeason, reqEpisode)) {
                return {
                    title: i.name,
                    magnet: `magnet:?xt=urn:btih:${i.info_hash}&dn=${encodeURIComponent(i.name)}`,
                    size: bytesToSize(i.size), sizeBytes: parseInt(i.size),
                    seeders: parseInt(i.seeders), source: "TPB"
                };
            }
            return null;
        }).filter(Boolean);
    } catch { return []; }
}

async function searchUindex(title, year, type, reqSeason, reqEpisode, options = {}) {
    try {
        let q = clean(title) + (options.allowEng ? "" : " ITA");
        const { data } = await requestHtml(`https://uindex.org/search.php?search=${encodeURIComponent(q)}&c=0`, { timeout: 4000 });
        if (!data) return [];
        
        const rows = data.split(/<tr[^>]*>/gi).filter(row => row.includes('magnet:'));
        return rows.map(row => {
            const magnet = row.match(/href=["'](magnet:[^"']+)["']/i)?.[1].replace(/&amp;/g, '&');
            if(!magnet) return null;
            const name = row.match(/<td[^>]*><a[^>]*>([^<]+)/i)?.[1];
            if(name && isValidResult(name, options.allowEng)) {
                return { title: name, magnet, size: "??", sizeBytes: 0, seeders: 0, source: "UIndex" };
            }
            return null;
        }).filter(Boolean);
    } catch { return []; }
}

// --- LIME TORRENTS ---
async function searchLime(title, year, type, reqSeason, reqEpisode, options = {}) {
    try {
        let query = clean(title);
        if (!options.allowEng && !query.toUpperCase().includes("ITA")) query += " ITA";

        const baseUrl = "https://limetorrents.asia";
        const url = `${baseUrl}/search?q=${encodeURIComponent(query)}`;
        const { data } = await requestHtml(url);
        
        if (!data) return [];
        
        const $ = cheerio.load(data);
        const items = [];
        
        $('.table2 tr').each((i, row) => {
            if ($(row).find('th').length > 0) return;
            const titleEl = $(row).find('.tt-name a').last();
            const name = titleEl.text().trim();
            const relUrl = titleEl.attr('href');
            const size = $(row).find('td').eq(2).text().trim();
            const seeders = parseInt($(row).find('td').eq(3).text().trim()) || 0;
            
            if (name && relUrl && isValidResult(name, options.allowEng) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                items.push({ title: name, url: `${baseUrl}${relUrl}`, size, seeders });
            }
        });

        const limit = pLimit(5);
        return (await Promise.all(items.slice(0, 10).map(item => limit(async () => {
            try {
                const { data: d } = await requestHtml(item.url);
                const $$ = cheerio.load(d);
                const magnet = $$('a[href^="magnet:"]').first().attr('href');
                if (magnet) return { 
                    title: item.title, 
                    magnet, 
                    size: item.size, 
                    sizeBytes: parseSize(item.size), 
                    seeders: item.seeders, 
                    source: "LimeTorrents" 
                };
            } catch {}
            return null;
        })))).filter(Boolean);
    } catch { return []; }
}

// --- TORRENTZ2 (VERSIONE DRAGNET V3) ---
async function searchTorrentz2(title, year, type, reqSeason, reqEpisode, options = {}) {
    try {
        let baseQuery = clean(title);
        if (!options.allowEng && !baseQuery.toUpperCase().includes("ITA")) baseQuery += " ITA";
        
        const cleanQuery = baseQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, '+');
        const url = `https://torrentz2.nz/search?q=${cleanQuery}`;

        const html = await cloudscraper.get(url);
        if (!html) return [];

        const $ = cheerio.load(html);
        const results = [];

        $('a[href^="magnet:"]').each((i, el) => {
            const magnet = $(el).attr('href');
            const container = $(el).closest('div.row, tr, div.card, div.border-bottom');

            let extractedTitle = "";
            if (container.length) {
                extractedTitle = container.find('h5, h6, .title, a[href*="/torrent/"]').first().text().trim();
                if (!extractedTitle) {
                    extractedTitle = container.find('a').not('[href^="magnet:"]').first().text().trim();
                }
            }
            if (!extractedTitle) {
                const prevLink = $(el).parent().find('a').not('[href^="magnet:"]').first().text().trim();
                if (prevLink) extractedTitle = prevLink;
            }

            if (!extractedTitle) return;
            extractedTitle = he.decode(extractedTitle);

            if (isValidResult(extractedTitle, options.allowEng) && 
                checkYear(extractedTitle, year, type) && 
                isCorrectFormat(extractedTitle, reqSeason, reqEpisode)) {

                const textData = container.text() || $(el).parent().text();
                const sizeMatch = textData.match(/(\d+[.,]\d+)\s*(TB|GB|MB|KB)/i);
                const size = sizeMatch ? sizeMatch[0] : "??";

                let seeders = 0;
                const seedMatch = textData.match(/(?:seeds:|S:|seminatrici)\s*(\d+)/i);
                if (seedMatch) {
                    seeders = parseInt(seedMatch[1]);
                } else {
                    const greenText = container.find('.text-success, .green, span[style*="green"]').text();
                    const greenNum = greenText.match(/(\d+)/);
                    if (greenNum) seeders = parseInt(greenNum[1]);
                }

                results.push({
                    title: extractedTitle,
                    magnet,
                    size,
                    sizeBytes: parseSize(size),
                    seeders,
                    source: "Torrentz2"
                });
            }
        });

        return results;
    } catch (e) {
        return [];
    }
}

// --- RARBG SCRAPER ---
async function searchRARBG(title, year, type, reqSeason, reqEpisode, options = {}) {
    const RARBG_MIRRORS = [
        "https://rargb.to",
        "https://www2.rarbggo.to",
        "https://www.rarbgproxy.to",
        "https://www.proxyrarbg.to"
    ];

    let query = clean(title);
    if (!options.allowEng && !query.toUpperCase().includes("ITA")) query += " ITA";

    // Prova i mirror sequenzialmente
    for (const mirror of RARBG_MIRRORS) {
        try {
            const searchUrl = `${mirror}/search/?search=${encodeURIComponent(query)}`;
            // Usiamo requestHtml per beneficiare di Cloudscraper se necessario
            const { data } = await requestHtml(searchUrl, { timeout: 8000 });
            
            if (!data) continue;

            const $ = cheerio.load(data);
            const candidates = [];

            $('table.lista2 tr').each((i, row) => {
                const tds = $(row).find('td');
                if (tds.length < 5) return;

                const linkTag = tds.eq(1).find('a').first();
                const name = linkTag.text().trim() || linkTag.attr('title');
                let detailHref = linkTag.attr('href');

                if (!name || !detailHref) return;

                if (!detailHref.startsWith('http')) {
                    detailHref = mirror + (detailHref.startsWith('/') ? '' : '/') + detailHref;
                }

                // Filtri
                if (isValidResult(name, options.allowEng) && 
                    checkYear(name, year, type) && 
                    isCorrectFormat(name, reqSeason, reqEpisode)) {
                    
                    const sizeStr = tds.eq(3).text().trim();
                    const seeders = parseInt(tds.eq(4).text().trim()) || 0;

                    candidates.push({
                        name,
                        detailUrl: detailHref,
                        size: sizeStr,
                        seeders
                    });
                }
            });

            if (candidates.length === 0) continue; // Prova prossimo mirror

            // Recupera magnet in parallelo (max 15 items per evitare ban)
            const limit = pLimit(5);
            const processList = candidates
                .sort((a, b) => b.seeders - a.seeders)
                .slice(0, 15);

            const results = await Promise.all(processList.map(c => limit(async () => {
                try {
                    const { data: detailHtml } = await requestHtml(c.detailUrl, { 
                        timeout: 5000,
                        headers: { 'Referer': mirror + '/' }
                    });
                    
                    if (!detailHtml) return null;
                    const $$ = cheerio.load(detailHtml);
                    
                    let magnet = $$('a[href^="magnet:"]').first().attr('href');
                    
                    // Fallback regex se il link non è diretto
                    if (!magnet) {
                         const match = detailHtml.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^"'\s]*/);
                         if (match) magnet = match[0];
                    }

                    if (magnet) {
                        return {
                            title: c.name,
                            magnet,
                            size: c.size,
                            sizeBytes: parseSize(c.size),
                            seeders: c.seeders,
                            source: "RARBG"
                        };
                    }
                } catch {}
                return null;
            })));

            const finalResults = results.filter(Boolean);
            if (finalResults.length > 0) return finalResults; // Trovati risultati validi, esci
            
        } catch (e) {
            // Continua col prossimo mirror in caso di errore
            continue; 
        }
    }
    return [];
}

// ==========================================
//  MAIN AGGREGATOR
// ==========================================

const ACTIVE_ENGINES = [
    searchCorsaro,
    searchKnaben,
    searchTPB,
    searchUindex,
    searchLime,       
    searchTorrentz2,
    searchRARBG      
];

async function searchMagnet(title, year, type, imdbId, options = {}) {
    const { season: reqSeason, episode: reqEpisode } = imdbId ? 
        (imdbId.split(':').length > 2 ? { season: parseInt(imdbId.split(':')[1]), episode: parseInt(imdbId.split(':')[2]) } : {}) 
        : {};

    const searchOpts = { allowEng: false, imdbId, ...options };
    
    // 1. Esecuzione Parallela Motori Standard
    const promises = ACTIVE_ENGINES.map(engine => 
        withTimeout(engine(title, year, type, reqSeason, reqEpisode, searchOpts), CONFIG.TIMEOUT).catch(() => [])
    );

    const resultsRaw = await Promise.allSettled(promises);
    let allResults = resultsRaw.map(r => r.status === 'fulfilled' ? r.value : []).flat();

    // 2. Deduplica per Hash
    const seenHashes = new Set();
    let uniqueResults = [];
    allResults.forEach(r => {
        const hashMatch = r.magnet.match(/btih:([a-f0-9]{40})/i);
        const hash = hashMatch ? hashMatch[1].toLowerCase() : null;
        if (hash && !seenHashes.has(hash)) {
            seenHashes.add(hash);
            uniqueResults.push(r);
        }
    });

    // 4. Ordinamento e Trackers
    return uniqueResults
        .sort((a, b) => b.seeders - a.seeders)
        .slice(0, 50)
        .map(r => {
            if (!r.magnet.includes("tr=")) {
                r.magnet += "&" + CONFIG.TRACKERS.map(t => `tr=${encodeURIComponent(t)}`).join('&');
            }
            return r;
        });
}

// Funzione Update Trackers (Silent)
async function updateTrackers() {
    try {
        const { data } = await axios.get("https://ngosang.github.io/trackerslist/trackers_best.txt", { timeout: 3000 });
        if(data) CONFIG.TRACKERS = data.split('\n').filter(l => l.trim());
    } catch {}
}

module.exports = { searchMagnet, updateTrackers, CONFIG, requestHtml };
