const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const cloudscraper = require("cloudscraper");
const pLimit = require("p-limit"); // Richiede npm install p-limit@3

// --- CONFIGURAZIONE CENTRALE ---
const CONFIG = {
    TIMEOUT: 6000,       // Timeout standard (6s) per siti pesanti o con Cloudflare
    TIMEOUT_API: 3000,   // Timeout ridotto (3s) per API veloci (Knaben, TPB)
    KNABEN_API: "https://api.knaben.org/v1",
    // Pool di User-Agents per rotazione
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    ],
    // Lista statica di tracker di fallback
    TRACKERS: [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://open.demonoid.ch:6969/announce",
        "udp://open.demonii.com:1337/announce",
        "udp://open.stealth.si:80/announce",
        "udp://tracker.torrent.eu.org:451/announce",
        "udp://tracker.therarbg.to:6969/announce",
        "udp://tracker.tryhackx.org:6969/announce",
        "udp://tracker.doko.moe:6969/announce",
        "udp://opentracker.i2p.rocks:6969/announce"
    ],
    HTTPS_AGENT_OPTIONS: { rejectUnauthorized: false, keepAlive: true } 
};

// --- UTILS & HELPERS ---

// 1. User Agent Rotator
function getRandomUA() {
    return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
}

// 2. Dynamic Tracker Updater (Chiamata opzionale)
async function updateTrackers() {
    try {
        const { data } = await axios.get("https://ngosang.github.io/trackerslist/trackers_best.txt", { timeout: 3000 });
        const list = data.split('\n').filter(line => line.trim() !== '');
        if (list.length > 0) CONFIG.TRACKERS = list;
    } catch (e) {
        // Fallimento silenzioso, usa lista statica
    }
}

// 3. Strict Engine Timeout Wrapper
const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Engine Timeout")), ms))
]);

const httpsAgent = new https.Agent(CONFIG.HTTPS_AGENT_OPTIONS);

// --- BYPASS CLOUDFLARE (Wrapper Automatico) ---
async function cfGet(url, config = {}) {
    const headers = { ...CONFIG.HEADERS, 'User-Agent': getRandomUA(), ...config.headers };
    try {
        return await axios.get(url, { ...config, headers, httpsAgent });
    } catch (err) {
        try {
            const html = await cloudscraper.get(url, {
                headers: headers,
                timeout: CONFIG.TIMEOUT
            });
            return { data: html };
        } catch (err2) {
            return { data: "" };
        }
    }
}

// --- HELPER DI PARSING BASE ---

function clean(title) {
    if (!title) return "";
    const htmlDecode = title
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&'); 

    const cleaned = htmlDecode
        .replace(/[:"'’]/g, "")
        .replace(/[^a-zA-Z0-9\s\-.\[\]()]/g, " ") 
        .replace(/\s+/g, " ")
        .trim();

    return cleaned;
}

function isItalianResult(name) {
    if (!name) return false;
    const nameUpper = name.toUpperCase();
    if (/\b(ENG|ENGLISH)\b/i.test(nameUpper) && !/\b(ITA|MULTI|DUAL)\b/i.test(nameUpper)) return false;
    const ITA_REGEX = /\b(ITA(LIANO)?|MULTI|DUAL|MD|SUB\.?ITA|SUB-?ITA|ITALUB|FORCED|AC3\.?ITA|DTS\.?ITA|AUDIO\.?ITA|ITA\.?AC3|ITA\.?HD|BDMUX|DVDRIP\.?ITA|CiNEFiLE|NovaRip|MeM|robbyrs|iDN_CreW|SPEEDVIDEO|WMS|TRIDIM)\b/i;
    return ITA_REGEX.test(nameUpper);
}

function checkYear(name, year, type) {
    if (!year) return true;
    if (type === 'tv' || type === 'series') return true;
    const y = parseInt(year);
    if (isNaN(y)) return true;
    const yearsToCheck = [y - 1, y, y + 1].map(String);
    return yearsToCheck.some(yStr => name.includes(yStr));
}

function parseImdbId(imdbId) {
    if (!imdbId || typeof imdbId !== 'string') return { season: null, episode: null };
    const parts = imdbId.split(':');
    if (parts.length >= 3) {
        const season = parseInt(parts[parts.length - 2]) || null;
        const episode = parseInt(parts[parts.length - 1]) || null;
        return { season, episode };
    }
    return { season: null, episode: null };
}

// --- HELPER DI PARSING ---

const createRegex = (pattern) => new RegExp(`(?<![^\\s\\[(_\\-.,])(${pattern})(?=[\\s\\)\\]_.\\-,]|$)`, 'i');
const createLanguageRegex = (pattern) => createRegex(`${pattern}(?![ .\\-_]?sub(title)?s?)`);

const PARSE_REGEX = {
    resolutions: {
        '2160p': createRegex('(bd|hd|m)?(4k|2160(p|i)?)|u(ltra)?[ .\\-_]?hd|3840\\s?x\\s?(\\d{4})'),
        '1080p': createRegex('(bd|hd|m)?(1080(p|i)?)|f(ull)?[ .\\-_]?hd|1920\\s?x\\s?(\\d{3,4})'),
        '720p': createRegex('(bd|hd|m)?((720|800)(p|i)?)|hd|1280\\s?x\\s?(\\d{3,4})'),
        '480p': createRegex('(bd|hd|m)?(480(p|i)?)|sd'),
    },
    qualities: {
        'BluRay REMUX': createRegex('(bd|br|b|uhd)?remux'),
        'BluRay': createRegex('(?<!remux.*)(bd|blu[ .\\-_]?ray|((bd|br)[ .\\-_]?rip))(?!.*remux)'),
        'WEB-DL': createRegex('web[ .\\-_]?(dl)?(?![ .\\-_]?(rip|DLRip|cam))'),
        'WEBRip': createRegex('web[ .\\-_]?rip'),
        'HDRip': createRegex('hd[ .\\-_]?rip|web[ .\\-_]?dl[ .\\-_]?rip'),
        'HDTV': createRegex('hd[ .\\-_]?tv|pdtv'),
    },
    languages: {
        'Multi': createLanguageRegex('multi'),
        'Dual Audio': createLanguageRegex('dual[ .\\-_]?(audio|lang(uage)?|flac|ac3|aac2?)'),
        'Italian': createRegex('italian|ita|sub[.\\s\\-_]?ita'),
    }
};

function matchPattern(filename, patterns) {
    for (const [name, pattern] of Object.entries(patterns)) {
        if (pattern.test(filename)) return name;
    }
    return undefined;
}

function parseTorrentTitle(filename) {
    if (!filename) return { title: '', year: null, season: null, episode: null, quality: 'Unknown', languages: [] };
    
    let normalized = filename.replace(/\./g, ' ').replace(/_/g, ' ').trim();
    const result = {
        title: filename,
        year: null,
        seasons: [],
        episodes: [],
        resolution: matchPattern(filename, PARSE_REGEX.resolutions) || 'Unknown',
        quality: matchPattern(filename, PARSE_REGEX.qualities) || 'Unknown',
        isMulti: PARSE_REGEX.languages['Multi'].test(filename) || PARSE_REGEX.languages['Dual Audio'].test(filename)
    };

    const yearMatch = filename.match(/[[(. _-]?((?:19|20)\d{2})[\]).\s_-]/);
    if (yearMatch) result.year = parseInt(yearMatch[1]);

    const seasonEpisodePatterns = [
        /S(\d{1,2})[ .\-_]?E(\d{1,3})/i,
        /(\d{1,2})x(\d{1,3})/i,
        /Stagione\s?(\d{1,2})/i,
        /Season\s?(\d{1,2})/i
    ];

    for (const pattern of seasonEpisodePatterns) {
        const match = filename.match(pattern);
        if (match) {
            if (match[1]) result.seasons.push(parseInt(match[1]));
            if (match[2]) result.episodes.push(parseInt(match[2]));
        }
    }
    
    result.season = result.seasons[0] || null;
    result.episode = result.episodes[0] || null;

    return result;
}

function isCorrectFormat(name, reqSeason, reqEpisode) {
    if (!reqSeason && !reqEpisode) return true;
    const info = parseTorrentTitle(name);
    
    const isPack = /PACK|COMPLET|TUTTE|STAGIONE\s\d+(?!.*E\d)/i.test(name);
    
    if (reqSeason && info.season !== null && info.season !== reqSeason) return false;
    
    if (reqEpisode) {
        if (isPack) return true; 
        if (info.episode !== null && info.episode !== reqEpisode) return false;
    }
    return true;
}

function parseSize(sizeStr) {
    if (!sizeStr) return 0;
    const match = sizeStr.toString().match(/([\d.,]+)\s*(TB|GB|MB|KB|B)/i);
    if (!match) return 0;
    let val = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();
    if (unit.includes('T')) val *= 1024 ** 4;
    else if (unit.includes('G')) val *= 1024 ** 3;
    else if (unit.includes('M')) val *= 1024 ** 2;
    else if (unit.includes('K')) val *= 1024;
    return Math.round(val);
}

function bytesToSize(bytes) {
    return (bytes / 1073741824).toFixed(2) + " GB";
}

// --- MOTORI DI RICERCA ---

async function searchCorsaro(title, year, type, reqSeason, reqEpisode) {
    try {
        const url = `https://ilcorsaronero.link/search?q=${encodeURIComponent(clean(title))}`;
        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });
        if (!data || data.includes("Cloudflare")) return [];
        const $ = cheerio.load(data);
        let items = [];

        $('table tr').each((i, row) => {
            if (items.length >= 25) return;

            const tds = $(row).find('td');
            if (tds.length < 5) return; 

            const titleLink = $(row).find('a[href*="/torrent/"], a[href*="details.php"]').first();
            if (!titleLink.length) return;

            const text = titleLink.text().trim();
            const href = titleLink.attr('href');

            if (!isItalianResult(text) || !checkYear(text, year, type) || !isCorrectFormat(text, reqSeason, reqEpisode)) return;

            let seeders = 0;
            const seedText = $(row).find('font[color="#008000"], .green').text().trim() || tds.eq(2).text().trim();
            if (/^\d+$/.test(seedText)) seeders = parseInt(seedText);

            let sizeStr = "??";
            const sizeText = tds.eq(4).text().trim();
            if (sizeText.match(/\d/)) sizeStr = sizeText;

            if (href && (href.includes('/torrent/') || href.includes('details.php')) && text.length > 5) {
                let fullUrl = href.startsWith('http') ? href : `https://ilcorsaronero.link${href.startsWith('/') ? '' : '/'}${href}`;
                if (!items.some(p => p.url === fullUrl)) {
                    items.push({ 
                        url: fullUrl, 
                        title: text,
                        seeders: seeders,
                        size: sizeStr
                    });
                }
            }
        });

        const limit = pLimit(5);
        const promises = items.map(item => limit(async () => {
            try {
                const detailPage = await cfGet(item.url, { timeout: 3000 });
                const magnetMatch = detailPage.data.match(/magnet:\?xt=urn:btih:([a-zA-Z0-9]{40})/i);
                
                if (!magnetMatch) return null;
                
                return {
                    title: item.title,
                    magnet: `magnet:?xt=urn:btih:${magnetMatch[1]}&dn=${encodeURIComponent(item.title)}`,
                    size: item.size,
                    sizeBytes: parseSize(item.size),
                    seeders: item.seeders,
                    source: "Corsaro"
                };
            } catch { return null; }
        }));
        return (await Promise.all(promises)).filter(Boolean);
    } catch { return []; }
}

async function searchKnaben(title, year, type, reqSeason, reqEpisode) {
    try {
        let query = clean(title);
        if (!query.toUpperCase().includes("ITA")) query += " ITA";
        const payload = { "search_field": "title", "query": query, "order_by": "seeders", "order_direction": "desc", "hide_unsafe": false, "hide_xxx": true, "size": 300 };
        const { data } = await axios.post(CONFIG.KNABEN_API, payload, { headers: { 'Content-Type': 'application/json', 'User-Agent': getRandomUA() }, timeout: CONFIG.TIMEOUT_API });
        if (!data || !data.hits) return [];
        const results = [];
        data.hits.forEach(item => {
            if (!item.title) return;
            let magnet = item.magnetUrl;
            if (!magnet && item.hash) magnet = `magnet:?xt=urn:btih:${item.hash}&dn=${encodeURIComponent(item.title)}`;
            if (!magnet) return;
            const sizeBytes = item.bytes ? parseInt(item.bytes) : 0;
            const sizeStr = bytesToSize(sizeBytes);
            if (isItalianResult(item.title) && checkYear(item.title, year, type) && isCorrectFormat(item.title, reqSeason, reqEpisode)) {
                results.push({ title: item.title, magnet: magnet, size: sizeStr, sizeBytes: sizeBytes, seeders: item.seeders || 0, source: "Knaben" });
            }
        });
        return results;
    } catch (error) { return []; }
}

async function searchUindex(title, year, type, reqSeason, reqEpisode) {
    try {
        const url = `https://uindex.org/search.php?search=${encodeURIComponent(clean(title) + " ITA")}&c=0`;
        const { data } = await axios.get(url, { headers: { 'User-Agent': getRandomUA() }, httpsAgent, timeout: 4000, validateStatus: s => s < 500 });
        if (!data || typeof data !== 'string') return [];
        const rows = data.split(/<tr[^>]*>/gi).filter(row => row.includes('magnet:?xt=urn:btih:') && row.includes('<td'));
        let results = [];
        for (const row of rows) {
            try {
                const magnet = row.match(/href=["'](magnet:\?xt=urn:btih:[^"']+)["']/i)?.[1].replace(/&amp;/g, '&');
                if (!magnet) continue;
                const cells = [];
                let m; const regex = /<td[^>]*>(.*?)<\/td>/gis;
                while ((m = regex.exec(row)) !== null) cells.push(m[1].trim());
                if (cells.length < 3) continue;
                const name = cells[1].match(/>([^<]+)<\/a>/)?.[1].trim();
                if (name && isItalianResult(name) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                    const sizeStr = cells[2].match(/([\d.,]+\s*(?:B|KB|MB|GB|TB))/i)?.[1].trim() || "??";
                    const seeders = parseInt(cells[4]?.match(/(\d+)/)?.[1] || 0);
                    results.push({ title: name, magnet, size: sizeStr, sizeBytes: parseSize(sizeStr), seeders, source: "UIndex" });
                }
            } catch {}
        }
        return results;
    } catch { return []; }
}

async function searchNyaa(title, year, type, reqSeason, reqEpisode) {
    try {
        let q = clean(title);
        if (!q.toLowerCase().includes("ita")) q += " ita";
        const url = `https://nyaa.iss.ink/?f=0&c=0_0&q=${encodeURIComponent(q)}&s=seeders&o=desc`;
        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });
        const $ = cheerio.load(data);
        const results = [];
        $("tr.default, tr.success, tr.danger").each((i, el) => {
            const tds = $(el).find("td");
            if (tds.length < 8) return;
            const name = $(tds.eq(1)).find("a:not(.comments)").last().text().trim();
            const magnet = $(tds.eq(2)).find('a[href^="magnet:"]').attr("href");
            const sizeStr = $(tds.eq(3)).text().trim();
            const seeders = parseInt($(tds.eq(5)).text().trim(), 10);
            if (name && magnet && seeders > 0 && isItalianResult(name) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                results.push({ title: name, magnet, size: sizeStr, sizeBytes: parseSize(sizeStr), seeders, source: "Nyaa" });
            }
        });
        return results;
    } catch { return []; }
}

async function searchTPB(title, year, type, reqSeason, reqEpisode) {
    try {
        const q = `${clean(title)} ${type === 'tv' ? '' : (year || "")} ITA`;
        const { data } = await axios.get("https://apibay.org/q.php", { params: { q, cat: type === 'tv' ? 0 : 201 }, headers: { 'User-Agent': getRandomUA() }, timeout: CONFIG.TIMEOUT_API }).catch(() => ({ data: [] }));
        if (!Array.isArray(data) || data[0]?.name === "No results returned") return [];
        return data
            .filter(i => i.info_hash !== "0000000000000000000000000000000000000000" && isItalianResult(i.name) && checkYear(i.name, year, type) && isCorrectFormat(i.name, reqSeason, reqEpisode))
            .map(i => ({ title: i.name, magnet: `magnet:?xt=urn:btih:${i.info_hash}&dn=${encodeURIComponent(i.name)}`, size: bytesToSize(i.size), sizeBytes: parseInt(i.size), seeders: parseInt(i.seeders), source: "TPB" }));
    } catch { return []; }
}

async function searchTorrentGalaxy(title, year, type, reqSeason, reqEpisode) {
    try {
        const url = `https://torrentgalaxy.to/torrents.php?search=${encodeURIComponent(clean(title) + " ITA")}&sort=seeders&order=desc`;
        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });
        const $ = cheerio.load(data);
        const results = [];
        $('div.tgxtablerow').each((i, row) => {
            const name = $(row).find('div a b').text().trim();
            const magnet = $(row).find('a[href^="magnet:"]').attr('href');
            const sizeStr = $(row).find('div td div span font').first().text().trim();
            const seedersStr = $(row).find('div td span font[color="green"]').text().trim();
            const seeders = parseInt(seedersStr) || 0;
            if (name && magnet && isItalianResult(name) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                results.push({ title: name, magnet, size: sizeStr, sizeBytes: parseSize(sizeStr), seeders, source: "TorrentGalaxy" });
            }
        });
        return results;
    } catch { return []; }
}

// 🔥 NUOVA LOGICA UNIVERSALE BITSEARCH (Con Fix Italiano e Parsing "Detective")
async function searchBitSearch(title, year, type, reqSeason, reqEpisode) {
    try {
        // Logica Smart Query (evita doppio ITA)
        let query = clean(title);
        if (!query.toUpperCase().includes("ITA")) {
            query += " ITA";
        }
        
        const url = `https://bitsearch.to/search?q=${encodeURIComponent(query)}`;
        console.log(`[BitSearch] 🔎 Cerco: "${query}" su ${url}`);

        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });
        
        // 1. Check se il server ha ricevuto dati o se è stato bloccato
        if (!data) {
            console.log(`[BitSearch] ❌ Nessun dato ricevuto.`);
            return [];
        }
        if (data.includes("No results found") || data.includes("Nessun risultato trovato")) {
            console.log(`[BitSearch] ⚠️ Il sito dice: "Nessun risultato trovato".`);
            return [];
        }

        const $ = cheerio.load(data);
        const results = [];
        
        // 2. STRATEGIA "CERCA TUTTO": Trova tutti i magnet, poi risali al contenitore
        const rawMagnets = $('a[href^="magnet:"]');
        console.log(`[BitSearch] 🧲 Trovati ${rawMagnets.length} magnet link grezzi.`);

        rawMagnets.each((i, el) => {
            try {
                const magnet = $(el).attr('href');
                
                // Risaliamo al contenitore (Card, Riga o generico)
                let container = $(el).closest('li');
                if (container.length === 0) container = $(el).closest('.search-result');
                if (container.length === 0) container = $(el).closest('.card');
                if (container.length === 0) container = $(el).closest('.row');
                // Fallback estremo: genitore del genitore
                if (container.length === 0) container = $(el).parent().parent();

                // 3. ESTRAZIONE TITOLO (A cascata)
                let name = container.find('h5 a').text().trim();
                if (!name) name = container.find('h5').text().trim();
                if (!name) name = container.find('a.title').text().trim();
                
                // Fallback: cerca un link che NON sia il magnet
                if (!name) {
                    container.find('a').each((j, link) => {
                        const href = $(link).attr('href') || "";
                        const text = $(link).text().trim();
                        if (!href.startsWith("magnet:") && text.length > 5) {
                            name = text;
                            return false; 
                        }
                    });
                }

                if (!name) return;

                // 4. ESTRAZIONE STATS (Fix per Italiano "seminatrici")
                let seeders = 0;
                let sizeStr = "??";
                
                // Prendi tutto il testo e puliscilo
                const statsText = container.text().replace(/\s+/g, ' ');
                
                // Regex che supporta Inglese e Italiano (visto negli screenshot)
                const seedMatch = statsText.match(/(\d+)\s*(seed|seminatrici|leech|sanguisughe)/i);
                if (seedMatch) {
                    seeders = parseInt(seedMatch[1]);
                } else {
                    // Fallback: cerca numeri nei div stats
                    const statNum = container.find('.stats div').first().text().replace(/[^0-9]/g, '');
                    if (statNum) seeders = parseInt(statNum);
                }

                const sizeMatch = statsText.match(/(\d+(\.\d+)?\s*(GB|MB))/i);
                if (sizeMatch) sizeStr = sizeMatch[0];

                // 5. FILTRI
                const isIta = isItalianResult(name);
                const isYear = checkYear(name, year, type);
                const isFormat = isCorrectFormat(name, reqSeason, reqEpisode);

                if (isIta && isYear && isFormat) {
                    console.log(`[BitSearch] ✅ Trovato: ${name} | S: ${seeders} | ${sizeStr}`);
                    results.push({ 
                        title: name, 
                        magnet, 
                        seeders, 
                        size: sizeStr, 
                        sizeBytes: parseSize(sizeStr), 
                        source: "BitSearch" 
                    });
                }

            } catch (err) {
               // Silent fail per riga singola
            }
        });
        
        return results;

    } catch (e) { 
        console.log(`[BitSearch] 💥 Errore Critico: ${e.message}`);
        return []; 
    }
}

async function searchLime(title, year, type, reqSeason, reqEpisode) {
    try {
        const url = `https://limetorrents.info/search/all/${encodeURIComponent(clean(title) + " ITA")}/seeds/1/`;
        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });
        const $ = cheerio.load(data || "");
        const candidates = [];
        $("table.table2 tbody tr").each((i, row) => {
            const tds = $(row).find("td");
            if (tds.length < 4) return;
            const nameLink = tds.eq(0).find("div.tt-name a").eq(1);
            const name = nameLink.text().trim();
            const link = nameLink.attr("href");
            const seeders = parseInt(tds.eq(3).text().replace(/,/g, "")) || 0;
            const sizeStr = tds.eq(2).text();
            if (name && link && isItalianResult(name) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                candidates.push({ name, link: `https://limetorrents.info${link}`, seeders, sizeStr });
            }
        });
        const limit = pLimit(4);
        const promises = candidates.slice(0, 5).map(cand => limit(async () => {
            try {
                const { data } = await cfGet(cand.link, { timeout: 3000 });
                const magnet = cheerio.load(data)("a[href^='magnet:?']").first().attr("href");
                return magnet ? { title: cand.name, magnet, seeders: cand.seeders, size: cand.sizeStr, sizeBytes: parseSize(cand.sizeStr), source: "Lime" } : null;
            } catch { return null; }
        }));
        return (await Promise.all(promises)).filter(Boolean);
    } catch { return []; }
}

async function searchGlo(title, year, type, reqSeason, reqEpisode) {
    try {
        let q = clean(title);
        if (!q.toLowerCase().includes("ita")) q += " ITA";
        const url = `https://glotorrents.com/search_results.php?search=${encodeURIComponent(q)}&incldead=0&sort=seeders&order=desc`;
        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });
        const $ = cheerio.load(data);
        const candidates = [];
        $('tr.t-row').each((i, el) => {
            const nameA = $(el).find('td.ttitle a b');
            const name = nameA.text().trim();
            const detailLink = nameA.parent().attr('href');
            const sizeStr = $(el).find('td').eq(4).text().trim();
            const seeders = parseInt($(el).find('td').eq(5).text().trim()) || 0;
            if (name && detailLink && isItalianResult(name) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                candidates.push({ name, detailLink: `https://glotorrents.com/${detailLink}`, sizeStr, seeders });
            }
        });
        const limit = pLimit(4);
        const promises = candidates.slice(0, 5).map(cand => limit(async () => {
            try {
                const { data } = await cfGet(cand.detailLink, { timeout: 3000 });
                const magnet = cheerio.load(data)('a[href^="magnet:"]').attr('href');
                if (magnet) {
                    return { title: cand.name, magnet, size: cand.sizeStr, sizeBytes: parseSize(cand.sizeStr), seeders: cand.seeders, source: "Glo" };
                }
            } catch {}
            return null;
        }));
        return (await Promise.all(promises)).filter(Boolean);
    } catch { return []; }
}

async function searchTorrentBay(title, year, type, reqSeason, reqEpisode) {
    try {
        const domain = "https://rarbg.torrentbay.st";
        let query = clean(title);
        if (!query.toUpperCase().includes("ITA")) query += " ITA";

        console.log(`[TorrentBay] 🔎 Cerco: "${query}" su ${domain}`);
        
        const url = `${domain}/get-posts/keywords:${encodeURIComponent(query)}/`;
        
        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });

        if (!data) return [];
        
        if (data.includes("Verify you are human") || data.includes("Cloudflare")) {
            console.log(`[TorrentBay] ⚠️ Blocco Cloudflare rilevato.`);
            return [];
        }

        const $ = cheerio.load(data);
        const candidates = [];

        $('table tr').each((i, row) => {
            if ($(row).find('th').length > 0) return;

            const tds = $(row).find('td');
            if (tds.length < 7) return; 

            const titleLink = tds.eq(1).find('a').first();
            const name = titleLink.text().trim();
            let relativeHref = titleLink.attr('href');

            if (!name || !relativeHref) return;

            if (!relativeHref.startsWith('http')) {
                if (!relativeHref.startsWith('/')) relativeHref = '/' + relativeHref;
                relativeHref = domain + relativeHref;
            }

            const sizeStr = tds.eq(5).text().trim();
            const seedersStr = tds.eq(6).text().trim(); 
            const seeders = parseInt(seedersStr) || 0;

            const isIta = isItalianResult(name);
            const isCorrectYear = checkYear(name, year, type);
            const isFormatOk = isCorrectFormat(name, reqSeason, reqEpisode);

            if (isIta && isCorrectYear && isFormatOk) {
                console.log(`[TorrentBay] ✅ Trovato candidato: ${name} | S: ${seeders}`);
                candidates.push({
                    name: name,
                    link: relativeHref,
                    seeders: seeders,
                    sizeStr: sizeStr
                });
            }
        });

        console.log(`[TorrentBay] Candidati validi: ${candidates.length}`);

        const limit = pLimit(5);
        const promises = candidates.slice(0, 10).map(cand => limit(async () => {
            try {
                const { data: detailData } = await cfGet(cand.link, { 
                    timeout: 4500, 
                    headers: { 'Referer': url } 
                });
                const $$ = cheerio.load(detailData);
                
                let magnet = $$('a[href^="magnet:"]').first().attr('href');
                if (!magnet) magnet = $$('td:contains("Magnet")').next().find('a').attr('href');
                
                if (magnet) {
                    return {
                        title: cand.name,
                        magnet: magnet,
                        size: cand.sizeStr,
                        sizeBytes: parseSize(cand.sizeStr),
                        seeders: cand.seeders,
                        source: "RARBG"
                    };
                } else {
                    console.log(`[TorrentBay] ❌ Magnet NON trovato per: ${cand.name}`);
                    return null;
                }
            } catch (e) { 
                console.log(`[TorrentBay] 💥 Errore fetch dettaglio: ${cand.name} - ${e.message}`);
                return null; 
            }
        }));

        const results = (await Promise.all(promises)).filter(Boolean);
        return results;

    } catch (e) {
        console.log(`[TorrentBay] Errore critico: ${e.message}`);
        return [];
    }
}

// DEFINIZIONE MOTORI ATTIVI
CONFIG.ENGINES = [
    searchCorsaro,       // 1. Il re dei torrent italiani
    searchKnaben,        // 2. Richiesto dall'utente
    searchUindex,        // 3. Richiesto dall'utente
    searchBitSearch,     // 4. Ora robusto e posizionato qui
    searchTorrentBay,
    searchLime,
    searchTPB,
    searchNyaa,
    searchTorrentGalaxy,,
    searchGlo
];

// --- MAIN AGGREGATOR ---
async function searchMagnet(title, year, type, imdbId) {
    const { season: reqSeason, episode: reqEpisode } = parseImdbId(imdbId);

    const engineTimeouts = new Map([
        [searchKnaben, CONFIG.TIMEOUT_API],
        [searchTPB, CONFIG.TIMEOUT_API],
        [searchUindex, 4000] 
    ]);

    const promises = CONFIG.ENGINES.map(engine => {
        const specificTimeout = engineTimeouts.get(engine) || CONFIG.TIMEOUT;
        return withTimeout(engine(title, year, type, reqSeason, reqEpisode), specificTimeout)
            .catch(e => []); 
    });

    const resultsArrays = await Promise.allSettled(promises);

    let allResults = resultsArrays
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .flat();

    const topResults = allResults
        .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
        .slice(0, 50);

    topResults.forEach(r => {
        if (r.magnet && !r.magnet.includes("&tr=")) {
            CONFIG.TRACKERS.forEach(tr =>
                r.magnet += `&tr=${encodeURIComponent(tr)}`
            );
        }
    });

    const seenHashes = new Set();
    const finalResults = topResults.filter(r => {
        const hashMatch = r.magnet.match(/btih:([a-f0-9]{40})/i);
        const hash = hashMatch ? hashMatch[1].toLowerCase() : null;
        if (hash && seenHashes.has(hash)) return false;
        if (hash) seenHashes.add(hash);
        return true;
    });

    return finalResults;
}

module.exports = { searchMagnet, CONFIG, updateTrackers };
