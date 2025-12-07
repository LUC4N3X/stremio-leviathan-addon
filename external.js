const axios = require("axios");
const crypto = require("crypto");

/* ===========================================================
   STEALTH ENGINE v3.8 — POWER EDITION (Vercel Optimized)
   =========================================================== */

// ⚠️ TIMEOUT: 3.8s (Il massimo sicuro per Vercel senza crashare)
const TIMEOUT_MS = 3800; 

// Pool pesato: simula una distribuzione realistica dei browser
const USER_AGENTS = [
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", weight: 4 },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36", weight: 2 },
    { ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", weight: 2 },
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0", weight: 1 }
];

const REFERERS = [
    "https://www.google.com/",
    "https://www.bing.com/",
    "https://duckduckgo.com/",
    "https://www.google.it/",
    undefined 
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

// ⚠️ RIMOSSO 'wait' per Vercel (causava timeout)

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
        'DNT': '1',
        'Referer': REFERERS[Math.floor(Math.random() * REFERERS.length)]
    };
}

/* ===========================================================
   SCORING SYSTEM (LOGICA ORIGINALE RIPRISTINATA)
   =========================================================== */

function scoreItalian(item) {
    const t = (item.title || "").toLowerCase();
    const s = (item.source || "").toLowerCase();
    const d = (item.description || "").toLowerCase(); // Aggiunto check descrizione

    let score = 0;

    // Aumentato il punteggio per i tag forti
    const HARD_ITA = [
        " ita ", "[ita]", "(ita)", "dual ita", "multi ita",
        "mux ita", "ita mux", "ita-eng", "ita/eng", "italian", "italiano", "🇮🇹"
    ];
    HARD_ITA.forEach(k => { if (t.includes(k) || d.includes(k)) score += 5; });

    const TRACKERS = ["corsaro", "corsaronero", "tntvillage", "luna nuova", "crew", "icv"];
    TRACKERS.forEach(k => { if (t.includes(k) || s.includes(k)) score += 3; });

    if (s.includes("ita")) score += 2;

    const SOFT = ["it ", "it- ", " it/", "webdl ita", "h264 ita", "ac3 ita"];
    SOFT.forEach(k => { if (t.includes(k)) score += 1; });

    return score;
}

function filterItalianSmart(list) {
    const scored = list.map(i => ({ ...i, _score: scoreItalian(i) }));
    const maxScore = Math.max(...scored.map(i => i._score));

    // Se non troviamo nulla di esplicitamente italiano, ritorniamo tutto (fallback)
    // Ma se troviamo italiano, filtriamo severamente.
    if (maxScore < 1) return scored;
    
    return scored.filter(i => i._score === maxScore || i._score >= 2);
}

/* ===========================================================
   PART 1: STEALTH SCRAPERS
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
            if (!data || !data.data || !data.data.movies) return [];
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
   PART 2: ADDON PROXIES (PARSING AVANZATO RIPRISTINATO)
   =========================================================== */

const ADDON_PROVIDERS = [
    { name: "Torrentio", url: "https://torrentio.strem.fun", parseType: "torrentio" },
    { name: "KnightCrawler", url: "https://knightcrawler.elfhosted.com", parseType: "torrentio" },
    { name: "MediaFusion", url: "https://mediafusion.elfhosted.com", parseType: "mediafusion" }
];

async function fetchFromAddon(provider, id, type) {
    try {
        const url = `${provider.url}/stream/${type}/${id}.json`;
        const { data } = await axios.get(url, { headers: getStealthHeaders(), timeout: TIMEOUT_MS }); 

        if (!data || !data.streams) return [];

        return data.streams.map(stream => {
            let title = "Unknown";
            let size = "Unknown";
            let sizeBytes = 0;
            let seeders = 0;
            let source = provider.name === "Torrentio" ? "External" : provider.name;
            let description = stream.description || stream.title || "";

            // --- LOGICA TORRENTIO (Ripristinata dal tuo file originale) ---
            if (provider.parseType === "torrentio") {
                const lines = stream.title.split('\n');
                title = lines[0] || stream.title;
                const metaLine = lines.find(l => l.includes('💾'));
                
                if (metaLine) {
                    const sizeMatch = metaLine.match(/💾\s+(.*?)(?:\s|$)/);
                    if (sizeMatch) size = sizeMatch[1];
                    const seedMatch = metaLine.match(/👤\s+(\d+)/);
                    if (seedMatch) seeders = parseInt(seedMatch[1]);
                    
                    const sourceMatch = metaLine.match(/⚙️\s+(.*)/);
                    if (sourceMatch) {
                        let rawSource = sourceMatch[1];
                        if (rawSource.toLowerCase().includes("corsaronero")) rawSource = "Corsaro Nero";
                        else if (rawSource.toLowerCase().includes("1337")) rawSource = "1337x";
                        source = rawSource; 
                    }
                }
            } 
            // --- LOGICA MEDIAFUSION (Ripristinata e potenziata per l'Italia) ---
            else if (provider.parseType === "mediafusion") {
                const desc = stream.description || stream.title; 
                const lines = desc.split('\n');
                title = lines[0].replace("📂 ", "").replace("/", "").trim();
                
                // Se la descrizione dice ITALIAN ma il titolo no, forziamo il tag [ITA]
                // Questo risolve il problema "trova cose in inglese"
                const fullText = desc.toLowerCase();
                if ((fullText.includes("🇮🇹") || fullText.includes("italian")) && !title.toLowerCase().includes("ita")) {
                    title += " [ITA]";
                }

                const seedLine = lines.find(l => l.includes("👤"));
                if (seedLine) seeders = parseInt(seedLine.split("👤 ")[1]) || 0;
                
                const sourceLine = lines.find(l => l.includes("🔗"));
                source = sourceLine ? sourceLine.split("🔗 ")[1] : "MediaFusion";

                if (stream.behaviorHints && stream.behaviorHints.videoSize) {
                    sizeBytes = stream.behaviorHints.videoSize;
                    size = formatBytes(sizeBytes);
                }
            }

            // Normalizzazione SizeBytes
            if (sizeBytes === 0 && size !== "Unknown") {
                const num = parseFloat(size);
                if (size.includes("GB")) sizeBytes = num * 1024 * 1024 * 1024;
                else if (size.includes("MB")) sizeBytes = num * 1024 * 1024;
            }

            return {
                title, size, sizeBytes, seeders, source, description,
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

    // 2. Textual Scrapers
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

    // ⚠️ RIMOSSO "wait" per evitare timeout su Vercel

    // MARKERS & FILTERING
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
