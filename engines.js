const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const cloudscraper = require("cloudscraper");

// --- CONFIGURAZIONE CENTRALE ---
const CONFIG = {
    TIMEOUT: 6000, // Increased slightly to allow for retry logic
    KNABEN_API: "https://api.knaben.org/v1",
    // Pool of User-Agents for rotation
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ],
    // Static fallback list
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

// 2. Dynamic Tracker Updater (Optional call)
async function updateTrackers() {
    try {
        const { data } = await axios.get("https://ngosang.github.io/trackerslist/trackers_best.txt", { timeout: 3000 });
        const list = data.split('\n').filter(line => line.trim() !== '');
        if (list.length > 0) CONFIG.TRACKERS = list;
    } catch (e) {
        // Silent fail, keep using static list
    }
}

// 3. Concurrency Limiter (Native implementation of p-limit)
const limitConcurrency = (concurrency) => {
    const queue = [];
    let active = 0;
    const next = () => {
        active--;
        if (queue.length > 0) queue.shift()();
    };
    const run = (fn) => new Promise((resolve, reject) => {
        const execute = async () => {
            active++;
            try { resolve(await fn()); } catch (e) { reject(e); } finally { next(); }
        };
        if (active < concurrency) execute();
        else queue.push(execute);
    });
    return run;
};

// 4. Strict Engine Timeout Wrapper
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

// --- HELPER DI PARSING ---
function clean(title) {
    if (!title) return "";
    // Decode HTML entities
    const decoded = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    return decoded.replace(/[:"'’]/g, "").replace(/[^a-zA-Z0-9\s\-.\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

function isItalianResult(name) {
    const nameUpper = name.toUpperCase();
    if (/\b(ENG|ENGLISH)\b/i.test(nameUpper) && !/\b(ITA|MULTI|DUAL)\b/i.test(nameUpper)) return false;
    const regex = /\b(ITA|ITALIAN|ITALIANO|MULTI|DUAL|MD|SUB.?ITA|SUBITA|SUB-ITA|ITALUB|FORCED|AC3.?ITA|DTS.?ITA|AUDIO.?ITA|ITA.?AC3|ITA.?HD|BDMUX|DVDRIP.?ITA|CiNEFiLE|NovaRip|MeM|robbyrs|iDN_CreW|SPEEDVIDEO|WMS|TRIDIM)\b/i;
    return regex.test(nameUpper);
}

function checkYear(name, year, type) {
    if (!year) return true;
    if (type === 'tv' || type === 'series') return true;
    const y = parseInt(year);
    return [y - 1, y, y + 1].some(ay => name.includes(ay.toString()));
}

function parseImdbId(imdbId) {
    if (!imdbId || !imdbId.includes(':')) return { season: null, episode: null };
    const parts = imdbId.split(':');
    if (parts.length >= 3) {
        return { season: parseInt(parts[parts.length - 2]), episode: parseInt(parts[parts.length - 1]) };
    }
    return { season: null, episode: null };
}

// --- PARSER EPISODI ---
function extractInfo(name) {
    const upper = name.toUpperCase();
    let season = null;
    let episode = null;

    const dotMatch = upper.match(/S(\d{1,2})\.E(\d{1,3})/);
    if (dotMatch) { 
        season = parseInt(dotMatch[1]); 
        episode = parseInt(dotMatch[2]); 
    } else {
        const standardMatch = upper.match(/S(\d{1,2})[._\s-]*E(\d{1,3})/);
        if (standardMatch) {
            season = parseInt(standardMatch[1]);
            episode = parseInt(standardMatch[2]);
        } else {
            const xMatch = upper.match(/(\d{1,2})X(\d{1,3})/);
            if (xMatch) {
                season = parseInt(xMatch[1]);
                episode = parseInt(xMatch[2]);
            } else {
                const sMatch = upper.match(/(?:STAGIONE|SEASON|S)\s?(\d{1,2})(?![0-9])/);
                if (sMatch) season = parseInt(sMatch[1]);
                const eMatch = upper.match(/(?:EPISODIO|EP\.|_|\s)(\d{1,3})(?!\d|p|k|bit|mb|gb)/);
                if (eMatch) episode = parseInt(eMatch[1]);
            }
        }
    }
    return { season, episode };
}

function isCorrectFormat(name, reqSeason, reqEpisode) {
    if (!reqSeason && !reqEpisode) return true;
    const info = extractInfo(name);
    const upperName = name.toUpperCase();
    const isPack = upperName.includes("COMPLET") || upperName.includes("PACK") || upperName.includes("TUTTE") || upperName.includes("STAGIONE");

    const rangeMatch = upperName.match(/(?:S|STAGIONE)?\s*(\d{1,2})\s*-\s*(?:S|STAGIONE)?\s*(\d{1,2})/);
    if (rangeMatch && reqSeason) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        if (reqSeason >= start && reqSeason <= end) return true;
    }

    if (reqSeason && info.season !== null && info.season !== reqSeason) return false;
    if (reqEpisode) {
        if (info.episode !== null) {
            if (info.episode !== reqEpisode) return false;
        } else if (!isPack) return false;
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

        $('a').each((i, elem) => {
            if (items.length >= 20) return;
            const href = $(elem).attr('href');
            const text = $(elem).text().trim();
            if (!isItalianResult(text) || !checkYear(text, year, type) || !isCorrectFormat(text, reqSeason, reqEpisode)) return;
            if (href && (href.includes('/torrent/') || href.includes('details.php')) && text.length > 5) {
                let fullUrl = href.startsWith('http') ? href : `https://ilcorsaronero.link${href.startsWith('/') ? '' : '/'}${href}`;
                if (!items.some(p => p.url === fullUrl)) items.push({ url: fullUrl, title: text });
            }
        });

        // Limit concurrency to 5 parallel requests
        const limit = limitConcurrency(5);
        const promises = items.map(item => limit(async () => {
            try {
                const detailPage = await cfGet(item.url, { timeout: 3000 });
                const magnetMatch = detailPage.data.match(/magnet:\?xt=urn:btih:([a-zA-Z0-9]{40})/i);
                if (!magnetMatch) return null;
                const sizeMatch = detailPage.data.match(/(\d+(\.\d+)?)\s?(GB|MB|KB)/i);
                const seedersMatch = detailPage.data.match(/Seeders:\s*(\d+)/i);
                return {
                    title: item.title,
                    magnet: `magnet:?xt=urn:btih:${magnetMatch[1]}&dn=${encodeURIComponent(item.title)}`,
                    size: sizeMatch ? sizeMatch[0] : "??",
                    sizeBytes: parseSize(sizeMatch ? sizeMatch[0] : "0"),
                    seeders: seedersMatch ? parseInt(seedersMatch[1]) : 0,
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

        const payload = {
            "search_field": "title",
            "query": query,
            "order_by": "seeders",
            "order_direction": "desc",
            "hide_unsafe": false,
            "hide_xxx": true,
            "size": 300
        };

        const { data } = await axios.post(CONFIG.KNABEN_API, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': getRandomUA()
            },
            timeout: CONFIG.TIMEOUT
        });

        if (!data || !data.hits) return [];

        const results = [];

        data.hits.forEach(item => {
            if (!item.title) return;
            let magnet = item.magnetUrl;
            if (!magnet && item.hash) {
                magnet = `magnet:?xt=urn:btih:${item.hash}&dn=${encodeURIComponent(item.title)}`;
            }
            if (!magnet) return;

            const sizeBytes = item.bytes ? parseInt(item.bytes) : 0;
            const sizeStr = bytesToSize(sizeBytes);
            const strictItaCheck = isItalianResult(item.title);

            if (strictItaCheck && checkYear(item.title, year, type) && isCorrectFormat(item.title, reqSeason, reqEpisode)) {
                results.push({
                    title: item.title,
                    magnet: magnet,
                    size: sizeStr,
                    sizeBytes: sizeBytes,
                    seeders: item.seeders || 0,
                    source: "Knaben"
                });
            }
        });

        return results;
    } catch (error) {
        return [];
    }
}

async function searchUindex(title, year, type, reqSeason, reqEpisode) {
    try {
        const url = `https://uindex.org/search.php?search=${encodeURIComponent(clean(title) + " ITA")}&c=0`;
        const { data } = await axios.get(url, { 
            headers: { 'User-Agent': getRandomUA() }, 
            httpsAgent, 
            timeout: CONFIG.TIMEOUT, 
            validateStatus: s => s < 500 
        });
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
        const { data } = await axios.get("https://apibay.org/q.php", {
            params: { q, cat: type === 'tv' ? 0 : 201 },
            headers: { 'User-Agent': getRandomUA() },
            timeout: CONFIG.TIMEOUT
        }).catch(() => ({ data: [] }));

        if (!Array.isArray(data) || data[0]?.name === "No results returned") return [];

        return data
            .filter(i => 
                i.info_hash !== "0000000000000000000000000000000000000000" && 
                isItalianResult(i.name) &&
                checkYear(i.name, year, type) &&
                isCorrectFormat(i.name, reqSeason, reqEpisode)
            )
            .map(i => ({
                title: i.name,
                magnet: `magnet:?xt=urn:btih:${i.info_hash}&dn=${encodeURIComponent(i.name)}`,
                size: bytesToSize(i.size),
                sizeBytes: parseInt(i.size),
                seeders: parseInt(i.seeders),
                source: "TPB"
            }));
    } catch { return []; }
}

async function search1337x(title, year, type, reqSeason, reqEpisode) {
    try {
        const domain = "https://1337x.ninjaproxy1.com";
        const url = `${domain}/search/${encodeURIComponent(clean(title) + " ITA")}/1/`;

        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });
        const $ = cheerio.load(data || "");
        const candidates = [];

        $("table.table-list tbody tr").slice(0, 8).each((i, row) => {
            const name = $(row).find("td.name a").last().text().trim();
            const link = $(row).find("td.name a").last().attr("href");
            const seeders = parseInt($(row).find("td.seeds").text().replace(/,/g, "")) || 0;

            if (name && link && isItalianResult(name) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                candidates.push({ name, link: `${domain}${link}`, seeders });
            }
        });

        const limit = limitConcurrency(4);
        const promises = candidates.map(cand => limit(async () => {
            try {
                const { data } = await cfGet(cand.link, { timeout: 3000 });
                const $d = cheerio.load(data);
                const magnet = $d("a[href^='magnet:?']").first().attr("href");
                const sizeStr = $d("ul.list li")
                    .filter((i, el) => $(el).text().includes("Size"))
                    .text()
                    .replace(/.*Size:\s*/, '').trim();

                return magnet ? {
                    title: cand.name,
                    magnet,
                    seeders: cand.seeders,
                    size: sizeStr || "?",
                    sizeBytes: parseSize(sizeStr),
                    source: "1337x"
                } : null;
            } catch { return null; }
        }));

        return (await Promise.all(promises)).filter(Boolean);

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

async function searchBitSearch(title, year, type, reqSeason, reqEpisode) {
    try {
        const url = `https://bitsearch.to/search?q=${encodeURIComponent(clean(title) + " ITA")}`;
        const { data } = await cfGet(url, { timeout: CONFIG.TIMEOUT });

        const $ = cheerio.load(data || "");
        const results = [];

        $("li.search-result").each((i, el) => {
            const name = $(el).find("h5 a").text().trim();
            const magnet = $(el).find("a.dl-magnet").attr("href");
            const seeders = parseInt($(el).find(".stats div").first().text().replace(/,/g, "")) || 0;
            const sizeStr = $(el).find(".stats div").eq(1).text();

            if (name && magnet && isItalianResult(name) && checkYear(name, year, type) && isCorrectFormat(name, reqSeason, reqEpisode)) {
                results.push({ title: name, magnet, seeders, size: sizeStr, sizeBytes: parseSize(sizeStr), source: "BitSearch" });
            }
        });

        return results;
    } catch { return []; }
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

        const limit = limitConcurrency(4);
        const promises = candidates.slice(0, 5).map(cand => limit(async () => {
            try {
                const { data } = await cfGet(cand.link, { timeout: 3000 });
                const magnet = cheerio.load(data)("a[href^='magnet:?']").first().attr("href");

                return magnet ? {
                    title: cand.name,
                    magnet,
                    seeders: cand.seeders,
                    size: cand.sizeStr,
                    sizeBytes: parseSize(cand.sizeStr),
                    source: "Lime"
                } : null;

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
                candidates.push({
                    name,
                    detailLink: `https://glotorrents.com/${detailLink}`,
                    sizeStr,
                    seeders
                });
            }
        });

        const limit = limitConcurrency(4);
        const promises = candidates.slice(0, 5).map(cand => limit(async () => {
            try {
                const { data } = await cfGet(cand.detailLink, { timeout: 3000 });
                const magnet = cheerio.load(data)('a[href^="magnet:"]').attr('href');
                if (magnet) {
                    return {
                        title: cand.name,
                        magnet,
                        size: cand.sizeStr,
                        sizeBytes: parseSize(cand.sizeStr),
                        seeders: cand.seeders,
                        source: "Glo"
                    };
                }
            } catch {}
            return null;
        }));

        return (await Promise.all(promises)).filter(Boolean);

    } catch { return []; }
}

// DEFINIZIONE MOTORI ATTIVI
CONFIG.ENGINES = [
    searchCorsaro,
    searchTPB,
    search1337x,
    searchBitSearch,
    searchTorrentGalaxy,
    searchNyaa,
    searchLime,
    searchGlo,
    searchKnaben,
    searchUindex
];

// --- MAIN AGGREGATOR ---
async function searchMagnet(title, year, type, imdbId) {
    // Attempt to update trackers passively (non-blocking for this request, or await if you prefer freshness over speed)
    // await updateTrackers(); 

    const { season: reqSeason, episode: reqEpisode } = parseImdbId(imdbId);

    // Wrap each engine in a race with a timeout
    const promises = CONFIG.ENGINES.map(engine =>
        withTimeout(engine(title, year, type, reqSeason, reqEpisode), CONFIG.TIMEOUT + 500)
            .catch(e => []) // If timeout or error, return empty array immediately
    );

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
