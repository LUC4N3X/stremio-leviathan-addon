const axios = require("axios");
const crypto = require("crypto");

/* ===========================================================
   STEALTH ENGINE v3.7 — Vercel/Serverless Optimized
   =========================================================== */

// RIDOTTO A 4.5s per evitare che Vercel uccida il processo (limite 10s totali)
const TIMEOUT_MS = 4500; 

// Pool pesato: simula una distribuzione realistica dei browser
const USER_AGENTS = [
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", weight: 4 },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36", weight: 2 },
    { ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", weight: 2 }
];

/* ===========================================================
   UTILITY FUNCTIONS
   =========================================================== */

function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function generateFakeHash() {
    return `BRN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// RIMOSSO: function wait(ms) -> Non serve su Vercel e causa Timeouts

/* ===========================================================
   HEADER & FINGERPRINTING LOGIC
   =========================================================== */

function pickWeightedUserAgent() {
    const expanded = USER_AGENTS.flatMap(o => Array(o.weight).fill(o.ua));
    return expanded[Math.floor(Math.random() * expanded.length)];
}

function getStealthHeaders() {
    return {
        'User-Agent': pickWeightedUserAgent(),
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'DNT': '1'
    };
}

/* ===========================================================
   SCORING SYSTEM
   =========================================================== */

function scoreItalian(item) {
    const t = (item.title || "").toLowerCase();
    const s = (item.source || "").toLowerCase();
    
    let score = 0;
    const HARD_ITA = [" ita ", "[ita]", "(ita)", "dual ita", "multi ita", "italian", "italiano", "🇮🇹"];
    HARD_ITA.forEach(k => { if (t.includes(k)) score += 4; });

    if (s.includes("ita") || s.includes("corsaro")) score += 3;
    if (t.includes("h264 ita") || t.includes("webdl ita")) score += 1;

    return score;
}

function filterItalianSmart(list) {
    const scored = list.map(i => ({ ...i, _score: scoreItalian(i) }));
    const maxScore = Math.max(...scored.map(i => i._score));
    if (maxScore < 1) return scored;
    return scored.filter(i => i._score === maxScore || i._score >= 2);
}

/* ===========================================================
   PART 1: STEALTH SCRAPERS (Direct HTTP)
   =========================================================== */

const BitSearch = {
    search: async (query) => {
        if (!query) return [];
        try {
            const url = `https://bitsearch.to/api/v1/torrents/search?q=${encodeURIComponent(query)}&sort=size`;
            const { data } = await axios.get(url, { headers: getStealthHeaders(), timeout: TIMEOUT_MS });
            if (!data || !data.results) return [];
            return data.results.map(item => ({
                title: item.name,
                size: formatBytes(item.size),
                sizeBytes: item.size,
                magnet: item.magnet,
                seeders: parseInt(item.seeders || 0),
                source: "BitSearch"
            }));
        } catch (e) { return []; }
    }
};

const SolidTorrents = {
    search: async (query) => {
        if (!query) return [];
        try {
            const url = `https://solidtorrents.to/api/v1/search?q=${encodeURIComponent(query)}&sort=size`;
            const { data } = await axios.get(url, { headers: getStealthHeaders(), timeout: TIMEOUT_MS });
            if (!data || !data.results) return [];
            return data.results.map(item => ({
                title: item.title,
                size: formatBytes(item.size),
                sizeBytes: item.size,
                magnet: item.magnet,
                seeders: parseInt(item.swarm?.seeders || 0),
                source: "SolidTorrents"
            }));
        } catch (e) { return []; }
    }
};

const YTS = {
    search: async (imdbId) => {
        if (!imdbId || !imdbId.startsWith('tt')) return [];
        try {
            const url = `https://yts.mx/api/v2/list_movies.json?query_term=${imdbId}`;
            const { data } = await axios.get(url, { headers: getStealthHeaders(), timeout: TIMEOUT_MS });
            if (!data?.data?.movies) return [];
            let results = [];
            data.data.movies.forEach(movie => {
                if (movie.torrents) {
                    movie.torrents.forEach(t => {
                        results.push({
                            title: `${movie.title} ${t.quality} ${t.type.toUpperCase()} YTS`,
                            size: t.size,
                            sizeBytes: t.size_bytes,
                            magnet: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(movie.title)}`,
                            seeders: t.seeds || 0,
                            source: "YTS"
                        });
                    });
                }
            });
            return results;
        } catch (e) { return []; }
    }
};

/* ===========================================================
   PART 2: ADDON PROXIES
   =========================================================== */

const ADDON_PROVIDERS = [
    { name: "Torrentio", url: "https://torrentio.strem.fun", parseType: "torrentio" },
    { name: "KnightCrawler", url: "https://knightcrawler.elfhosted.com", parseType: "torrentio" },
    { name: "MediaFusion", url: "https://mediafusion.elfhosted.com", parseType: "mediafusion" }
];

async function fetchFromAddon(provider, id, type) {
    try {
        const url = `${provider.url}/stream/${type}/${id}.json`;
        // Timeout molto breve per gli addon esterni per non bloccare tutto
        const { data } = await axios.get(url, { headers: getStealthHeaders(), timeout: 3500 }); 

        if (!data || !data.streams) return [];

        return data.streams.map(stream => {
            let title = stream.title || "Unknown";
            let size = "Unknown";
            let sizeBytes = 0;
            let seeders = 0;
            let source = provider.name === "Torrentio" ? "External" : provider.name;

            // Parsing semplificato per velocità
            if (provider.parseType === "torrentio") {
                const lines = title.split('\n');
                title = lines[0];
                if (lines.some(l => l.includes("👤"))) {
                    const seedMatch = title.match(/👤\s*(\d+)/) || lines.join(" ").match(/👤\s*(\d+)/);
                    if (seedMatch) seeders = parseInt(seedMatch[1]);
                }
            } 
            
            return {
                title, size, sizeBytes, seeders, source,
                magnet: stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : stream.url
            };
        });
    } catch (e) { return []; }
}

/* ===========================================================
   MAIN EXPORT
   =========================================================== */

async function searchMagnet(query, year, type, id) {
    const promises = [];
    const baseImdbId = id.includes(':') ? id.split(':')[0] : id;

    // 1. Addon Proxies
    ADDON_PROVIDERS.forEach(p => promises.push(fetchFromAddon(p, id, type)));

    // 2. Textual Scrapers (Solo se c'è query)
    if (query) {
        promises.push(BitSearch.search(query));
        promises.push(SolidTorrents.search(query));
    }

    // 3. Movie Specific
    if (type === 'movie' && baseImdbId) {
        promises.push(YTS.search(baseImdbId));
    }

    // Esegui tutto in parallelo
    const results = await Promise.all(promises);
    const allMagnets = results.flat();

    // RIMOSSO IL WAIT: Su serverless è inutile e dannoso

    const tagged = allMagnets.map(item => ({
        ...item,
        _brain_id: generateFakeHash(), 
        _stealth: true 
    }));

    return filterItalianSmart(tagged);
}

module.exports = { 
    searchMagnet, 
    formatBytes 
};
