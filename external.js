const axios = require("axios");
const crypto = require("crypto");

/* ===========================================================
   STEALTH ENGINE v3 — Anti Block / Anti Fingerprint
   =========================================================== */

const TIMEOUT_MS = 6500;
const MIN_DELAY = 350;
const MAX_DELAY = 1250;

// Pool pesato: simula una distribuzione realistica dei browser
const USER_AGENTS = [
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", weight: 4 },
    { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36", weight: 2 },
    { ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", weight: 2 },
    { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0", weight: 1 }
];

function pickWeightedUserAgent() {
    const expanded = USER_AGENTS.flatMap(o => Array(o.weight).fill(o.ua));
    return expanded[Math.floor(Math.random() * expanded.length)];
}

function getStealthHeaders() {
    return {
        'User-Agent': pickWeightedUserAgent(),
        'Accept': 'application/json, text/plain, */*',
        // Priorità lingua italiana negli header HTTP
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.7,en;q=0.6',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateFakeHash() {
    return `BRN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/* ===========================================================
   AI-LIKE ITALIAN DETECTOR v4 (Scoring System)
   =========================================================== */

function scoreItalian(item) {
    const t = (item.title || "").toLowerCase();
    const s = (item.source || "").toLowerCase();
    // Se c'è una descrizione (MediaFusion), la usiamo, altrimenti stringa vuota
    const d = (item.description || "").toLowerCase();

    let score = 0;

    // 🇮🇹 POWER KEYWORDS
    const HARD_ITA = [
        " ita ", "[ita]", "(ita)", "dual ita", "multi ita",
        "mux ita", "ita mux", "ita-eng", "ita/eng", "italian", "italiano", "🇮🇹"
    ];
    HARD_ITA.forEach(k => { if (t.includes(k) || d.includes(k)) score += 4; });

    // Italian trackers (Priorità massima ai tracker nostrani)
    const TRACKERS = ["corsaro", "corsaronero", "tntvillage", "luna nuova", "crew", "icv"];
    TRACKERS.forEach(k => { if (t.includes(k) || s.includes(k)) score += 3; });

    // Source patterns generici
    if (s.includes("ita")) score += 2;

    // Italian "hidden" variants (indicatori deboli ma utili)
    const SOFT = ["it ", "it- ", " it/", "webdl ita", "h264 ita", "ac3 ita"];
    SOFT.forEach(k => { if (t.includes(k)) score += 1; });

    // Bonus: release "pulita" con anno (spesso indice di qualità)
    if (/(\b[12][0-9]{3}\b)/.test(t)) score += 0.5;

    return score;
}

function filterItalianSmart(list) {
    const scored = list.map(i => ({ ...i, _score: scoreItalian(i) }));
    const maxScore = Math.max(...scored.map(i => i._score));

    // Se nessun risultato ha un punteggio "Italiano" (score < 1), ritorna tutto
    if (maxScore < 1) return scored;

    // Altrimenti ritorna SOLO i risultati migliori (Italiani)
    // Accetta il top score o comunque score alti (>= 2) per non perdere alternative
    return scored.filter(i => i._score === maxScore || i._score >= 2);
}

/* ===========================================================
   PART 1: STEALTH SCRAPERS (API Pubbliche)
   =========================================================== */

const BitSearch = {
    search: async (query) => {
        if (!query) return [];
        try {
            const url = `https://bitsearch.to/api/v1/torrents/search?q=${encodeURIComponent(query)}&sort=size`;
            // Usa getStealthHeaders() invece di getRandomHeader()
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
                        const magnet = `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(movie.title)}&tr=udp://open.demonii.com:1337/announce`;
                        results.push({
                            title: `${movie.title} ${t.quality} ${t.type.toUpperCase()} YTS`,
                            size: t.size,
                            sizeBytes: t.size_bytes,
                            magnet: magnet,
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
   PART 2: ADDON PROXIES (Interroga Torrentio/KC/MF)
   =========================================================== */

const ADDON_PROVIDERS = [
    { name: "Torrentio", url: "https://torrentio.strem.fun", parseType: "torrentio" },
    { name: "KnightCrawler", url: "https://knightcrawler.elfhosted.com", parseType: "torrentio" },
    { name: "MediaFusion", url: "https://mediafusion.elfhosted.com", parseType: "mediafusion" }
];

async function fetchFromAddon(provider, id, type) {
    try {
        const url = `${provider.url}/stream/${type}/${id}.json`;
        // Usa getStealthHeaders()
        const { data } = await axios.get(url, { headers: getStealthHeaders(), timeout: TIMEOUT_MS }); 

        if (!data || !data.streams) return [];

        return data.streams.map(stream => {
            let title = "Unknown";
            let size = "Unknown";
            let sizeBytes = 0;
            let seeders = 0;
            // Default: se non troviamo info, usiamo il nome del provider ma pulito
            let source = provider.name === "Torrentio" ? "External" : provider.name;

            // --- PARSING INTELLIGENTE PER ESTRARRE INFO DAI TITOLI ---
            if (provider.parseType === "torrentio") {
                const lines = stream.title.split('\n');
                title = lines[0] || stream.title;
                
                const metaLine = lines.find(l => l.includes('💾'));
                if (metaLine) {
                    const sizeMatch = metaLine.match(/💾\s+(.*?)(?:\s|$)/);
                    if (sizeMatch) size = sizeMatch[1];
                    const seedMatch = metaLine.match(/👤\s+(\d+)/);
                    if (seedMatch) seeders = parseInt(seedMatch[1]);
                    
                    // PARSING SOURCE SPECIFICO (Mantenuto dal file originale per pulizia)
                    const sourceMatch = metaLine.match(/⚙️\s+(.*)/);
                    if (sourceMatch) {
                        let rawSource = sourceMatch[1];
                        
                        // Rinomina ilCorSaRoNeRo in "Corsaro Nero"
                        if (rawSource.toLowerCase().includes("corsaronero")) {
                            rawSource = "Corsaro Nero";
                        }
                        // Rinomina altri tracker se vuoi
                        else if (rawSource.toLowerCase().includes("1337")) {
                            rawSource = "1337x";
                        }
                        
                        source = rawSource; 
                    }
                }
            } 
            else if (provider.parseType === "mediafusion") {
                const desc = stream.description || stream.title; 
                const lines = desc.split('\n');
                title = lines[0].replace("📂 ", "").replace("/", "").trim();
                
                const fullText = desc.toLowerCase();
                const hasHiddenIta = fullText.includes("🇮🇹") || fullText.includes("italian") || (fullText.includes("audio") && fullText.includes("ita"));
                if (hasHiddenIta && !title.toLowerCase().includes("ita")) title += " [ITA]";

                const seedLine = lines.find(l => l.includes("👤"));
                if (seedLine) seeders = parseInt(seedLine.split("👤 ")[1]) || 0;

                const sourceLine = lines.find(l => l.includes("🔗"));
                source = sourceLine ? sourceLine.split("🔗 ")[1] : "MediaFusion";

                if (stream.behaviorHints && stream.behaviorHints.videoSize) {
                    sizeBytes = stream.behaviorHints.videoSize;
                    size = formatBytes(sizeBytes);
                }
            }

            if (sizeBytes === 0 && size !== "Unknown") {
                const num = parseFloat(size);
                if (size.includes("GB")) sizeBytes = num * 1024 * 1024 * 1024;
                else if (size.includes("MB")) sizeBytes = num * 1024 * 1024;
            }

            return {
                title: title,
                size: size,
                sizeBytes: sizeBytes,
                seeders: seeders,
                magnet: stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : stream.url,
                source: source
            };
        });

    } catch (e) { return []; }
}

/* ===========================================================
   MAIN FUNCTION
   =========================================================== */

async function searchMagnet(query, year, type, id) {
    let promises = [];
    
    // Per YTS serve solo la parte tt12345
    const baseImdbId = id.includes(':') ? id.split(':')[0] : id;

    // 1. Lancia i Proxy Addon
    ADDON_PROVIDERS.forEach(p => {
        promises.push(fetchFromAddon(p, id, type));
    });

    // 2. Lancia gli Scraper Testuali
    if (query) {
        promises.push(BitSearch.search(query));
        promises.push(SolidTorrents.search(query));
    }

    // 3. Lancia YTS (Solo film)
    if (type === 'movie' && baseImdbId) {
        promises.push(YTS.search(baseImdbId));
    }

    // Attendi tutti i risultati
    const results = await Promise.allSettled(promises);
    
    let allMagnets = [];
    results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            allMagnets.push(...res.value);
        }
    });

    // --- STEALTH DELAY (Jitter casuale) ---
    const randomDelay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY);
    await wait(randomDelay);

    // --- STEALTH MARKERS ---
    const tagged = allMagnets.map(item => ({
        ...item,
        _brain_id: generateFakeHash(), 
        _stealth: true 
    }));

    // --- FILTRO ITALIANO INTELLIGENTE ---
    // Questo è il cuore della modifica: seleziona i contenuti ITA se presenti
    const finalResults = filterItalianSmart(tagged);

    return finalResults;
}

module.exports = { searchMagnet };
