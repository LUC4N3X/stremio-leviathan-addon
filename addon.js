/**
 * addon.js
 * Corsaro Brain — LEVIATHAN EDITION (v33.2 - Install Fix)
 * * Changelog v33.2:
 * - FIX CRITICO: Logica 'configurationRequired' dinamica.
 * - Ora il tasto INSTALLA appare correttamente dopo la configurazione.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const NodeCache = require("node-cache");

// --- IMPORTIAMO I MODULI SMART ---
// Assicurati che questi file esistano nella cartella
const { generateSmartQueries } = require("./ai_query");
const { smartMatch } = require("./smart_parser");
const { rankAndFilterResults } = require("./ranking");

// IMPORTIAMO ALTRI MODULI
const { tmdbToImdb } = require("./id_converter");
const kitsuHandler = require("./kitsu_handler");
const RD = require("./debrid/realdebrid");
const AD = require("./debrid/alldebrid");
const TB = require("./debrid/torbox");

// --- CONFIGURAZIONE ---
const CONFIG = {
    CINEMETA_URL: "https://v3-cinemeta.strem.io",
    REAL_SIZE_FILTER: 80 * 1024 * 1024, // 80MB Minimo
    TIMEOUT_TMDB: 2000,
    SCRAPER_TIMEOUT: 6000,
    MAX_RESULTS: 40,
    CACHE_TTL: 600 // 10 Minuti di cache
};

// --- CACHE & LIMITERS ---
const debridCache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL, checkperiod: 120 });

const LIMITERS = {
    scraper: new Bottleneck({ maxConcurrent: 40, minTime: 10 }),
    rd: new Bottleneck({ maxConcurrent: 25, minTime: 40 }),
};

// --- MOTORI DI RICERCA ---
const SCRAPER_MODULES = [
    require("./engines")
];

const FALLBACK_SCRAPERS = [
    require("./external"),
];

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// UTILITIES
// ==========================================
const UNITS = ["B", "KB", "MB", "GB", "TB"];
function formatBytes(bytes) {
    if (!+bytes) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${UNITS[i]}`;
}

function parseSize(sizeStr) {
    if (!sizeStr) return 0;
    if (typeof sizeStr === "number") return sizeStr;
    const m = sizeStr.toString().match(/([\d.]+)\s*([KMGTP]?B)/i);
    if (!m) return 0;
    const val = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    const mult = { TB: 1099511627776, GB: 1073741824, MB: 1048576, KB: 1024, B: 1 };
    return val * (mult[unit] || 1);
}

// ==========================================
// HELPER DI FORMATTAZIONE & FILTRO
// ==========================================

function isSafeForItalian(item) {
    if (!item || !item.title) return false;
    const t = item.title.toUpperCase();
    const itaPatterns = [
        /\b(ITA|ITALIAN|IT|ITL|ITALY)\b/,
        /\b(MULTI|MUII|MUL|MULTILANGUAGE)\b.*\b(ITA|IT|ITALIAN)\b/,
        /\b(AC3|DTS).*\b(ITA|IT|ITALIAN)\b/,
        /\b(SUB.?ITA|SUBS.?ITA|SOTTOTITOLI.?ITA)\b/,
        /\b(VC[._-]?I|VO.?ITA|AUD.?ITA)\b/,
        /\b(ITA.?ENG)\b/,
        /ITALIAN.*(DL|Mux|WEBRip|BluRay)/i,
        /\b(SPEEDVIDEO|WMS|TRIDIM|iDN_CreW)\b/
    ];
    return itaPatterns.some(p => p.test(t));
}

function cleanFilename(filename) {
    if (!filename) return "";
    const yearMatch = filename.match(/(19|20)\d{2}/);
    let cleanTitle = filename;
    let year = "";
    if (yearMatch) {
        year = ` (${yearMatch[0]})`;
        cleanTitle = filename.substring(0, yearMatch.index);
    }
    cleanTitle = cleanTitle.replace(/[._]/g, " ").trim();
    cleanTitle = cleanTitle.replace(/\b(ita|eng|sub|h264|h265|x264|x265|1080p|720p|4k|bluray|webdl|rip)\b.*/yi, "");
    return `${cleanTitle.trim()}${year}`;
}

function getEpisodeTag(filename) {
    const f = filename.toLowerCase();
    const matchEp = f.match(/s(\d+)[ex](\d+)/i);
    if (matchEp) return `🍿 S${matchEp[1]}E${matchEp[2]}`;
    const matchX = f.match(/(\d+)x(\d+)/i);
    if (matchX) return `🍿 S${matchX[1].padStart(2, '0')}E${matchX[2].padStart(2, '0')}`;
    if (/s(\d+)\b|stagione (\d+)|season (\d+)/i.test(f)) {
        const s = f.match(/s(\d+)|stagione (\d+)|season (\d+)/i);
        const num = s[1] || s[2] || s[3];
        return `📦 STAGIONE ${num}`;
    }
    return "";
}

function extractStreamInfo(title, source) {
    const t = String(title).toLowerCase();
    let q = "HD"; let qIcon = "📺";
    if (/2160p|4k|uhd/.test(t)) { q = "4K"; qIcon = "✨"; }
    else if (/1080p/.test(t)) { q = "1080p"; qIcon = "🌕"; }
    else if (/720p/.test(t)) { q = "720p"; qIcon = "🌗"; }
    else if (/480p|\bsd\b/.test(t)) { q = "SD"; qIcon = "🌑"; }

    const videoTags = []; const audioTags = [];
    if (/hdr/.test(t)) videoTags.push("HDR");
    if (/dolby|vision|\bdv\b/.test(t)) videoTags.push("DV");
    if (/imax/.test(t)) videoTags.push("IMAX");
    if (/h265|hevc|x265/.test(t)) videoTags.push("HEVC");

    if (/atmos/.test(t)) audioTags.push("Atmos");
    if (/dts:?x?|\bdts\b/.test(t)) audioTags.push("DTS");
    if (/dd\+|eac3/.test(t)) audioTags.push("DD+");
    if (/5\.1/.test(t)) audioTags.push("5.1");

    let lang = "🇬🇧 ENG";
    if (source === "Corsaro") {
        lang = "🇮🇹 ITA";
        if (/multi|mui/i.test(t)) lang = "🇮🇹 MULTI";
    }
    else if (/\b(ita|italian|it)\b/i.test(t)) {
        lang = "🇮🇹 ITA";
    } else if (/multi|mui/i.test(t)) {
        lang = "🌐 MULTI";
    }

    let detailsParts = [];
    if (videoTags.length) detailsParts.push(`✨ ${videoTags.join(" ")}`);
    if (audioTags.length) detailsParts.push(`🔊 ${audioTags.join(" ")}`);

    return { quality: q, qIcon, info: detailsParts.join(" • "), lang };
}

function formatStreamTitleCinePro(fileTitle, source, size, seeders, serviceTag = "RD") {
    const { quality, qIcon, info, lang } = extractStreamInfo(fileTitle, source);
    const sizeStr = size ? `📦 ${formatBytes(size)}` : "📦 ❓";
    const seedersStr = seeders ? `👤 ${seeders}` : "";

    const name = `[${serviceTag} ${qIcon} ${quality}] ${source}`;
    const detailLines = [];

    let cleanName = cleanFilename(fileTitle)
        .replace(/s\d+e\d+/i, "")
        .replace(/s\d+/i, "")
        .trim();
    const epTag = getEpisodeTag(fileTitle);
    detailLines.push(`🎬 ${cleanName}${epTag ? ` ${epTag}` : ""} • ${quality}`);

    let sizeSeedLine = sizeStr;
    if (seedersStr) sizeSeedLine += ` • ${seedersStr}`;
    detailLines.push(sizeSeedLine);

    const langTag = lang.replace('🌐', '').replace('🇮🇹', 'IT').replace('🇬🇧', 'GB').trim();
    detailLines.push(`🔍 ${source} • 🗣️ ${langTag}`);

    if (info) {
        const tags = info.split(' • ');
        const videoTags = tags.filter(t => t.includes('✨')).map(t => t.replace('✨', ''));
        const audioTags = tags.filter(t => t.includes('🔊'));
        if (videoTags.length) detailLines.push(`🎞️ ${videoTags.join(' • ')}`);
        if (audioTags.length) detailLines.push(`🔊 ${audioTags.join(' • ')}`);
    }

    const fullTitle = detailLines.join('\n');
    return { name, title: fullTitle };
}

// ==========================================
// 🧠 CORE LOGIC
// ==========================================

async function getMetadata(id, type) {
    try {
        let tmdbId = id, s = 1, e = 1;
        if (type === "series" && id.includes(":")) [tmdbId, s, e] = id.split(":");

        const { data: cData } = await axios.get(`${CONFIG.CINEMETA_URL}/meta/${type}/${tmdbId.split(":")[0]}.json`, { timeout: CONFIG.TIMEOUT_TMDB }).catch(() => ({ data: {} }));

        return cData?.meta ? {
            title: cData.meta.name,
            originalTitle: cData.meta.name,
            year: cData.meta.year?.split("–")[0],
            imdb_id: tmdbId.split(":")[0],
            isSeries: type === "series",
            season: parseInt(s),
            episode: parseInt(e)
        } : null;
    } catch { return null; }
}

async function resolveDebridLink(config, item, showFake) {
    const service = config.service || 'rd';
    const apiKey = config.key || config.rd;
    if (!apiKey) return null;

    // --- CACHE CHECK ---
    const hashMatch = item.magnet.match(/btih:([a-f0-9]{40})/i);
    const hash = hashMatch ? hashMatch[1].toUpperCase() : null;
    const cacheKey = hash ? `${service}:${apiKey.substring(0, 5)}:${hash}` : null;

    if (cacheKey) {
        const cached = debridCache.get(cacheKey);
        if (cached === 'MISSING') return showFake ? { name: `[P2P ⚠️]`, title: `${item.title}\n⚠️ Cache Assente`, url: item.magnet, behaviorHints: { notWebReady: true } } : null;
        if (cached) return cached;
    }

    try {
        let streamData = null;
        if (service === 'rd') streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        else if (service === 'ad') streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        else if (service === 'tb') streamData = await TB.getStreamLink(apiKey, item.magnet, item.season, item.episode);

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) {
            if (cacheKey) debridCache.set(cacheKey, 'MISSING');
            return null;
        }

        let serviceTag = "RD";
        if (service === 'ad') serviceTag = "AD";
        if (service === 'tb') serviceTag = "TB";

        const { name, title } = formatStreamTitleCinePro(streamData.filename || item.title, item.source, streamData.size || item.size, item.seeders, serviceTag);

        const result = {
            name,
            title,
            url: streamData.url,
            behaviorHints: { notWebReady: false, bingieGroup: `corsaro-${service}` }
        };

        if (cacheKey) debridCache.set(cacheKey, result);
        return result;

    } catch (e) {
        if (cacheKey) debridCache.set(cacheKey, 'MISSING');
        if (showFake) return { name: `[P2P ⚠️]`, title: `${item.title}\n⚠️ Errore Debrid`, url: item.magnet, behaviorHints: { notWebReady: true } };
        return null;
    }
}

// 🔥 GENERATE STREAM - FUNZIONE PRINCIPALE 🔥
async function generateStream(type, id, config, userConfStr) {
    if (!config.key && !config.rd) return { streams: [{ name: "⚠️ CONFIG", title: "Inserisci API Key nel configuratore" }] };

    let finalId = id;

    // 1. RILEVAMENTO ID TMDB/KITSU
    if (id.startsWith("tmdb:")) {
        try {
            const parts = id.split(":");
            const imdbId = await tmdbToImdb(parts[1], type);
            if (imdbId) finalId = (type === "series" && parts.length >= 4) ? `${imdbId}:${parts[2]}:${parts[3]}` : imdbId;
        } catch (err) { }
    } else if (id.startsWith("kitsu:")) {
        try {
            const parts = id.split(":");
            const kData = await kitsuHandler(parts[1]);
            if (kData && kData.imdbID) {
                finalId = (kData.type === 'series' || type === 'series') ? `${kData.imdbID}:${kData.season || 1}:${parts[2] || 1}` : kData.imdbID;
            }
        } catch (err) { }
    }

    const meta = await getMetadata(finalId, type);
    if (!meta) return { streams: [] };

    // 2. QUERY EXPANSION
    const queries = generateSmartQueries(meta);
    const onlyIta = config.filters?.onlyIta !== false;

    console.log(`\n🧠 [AI-CORE] Cerco "${meta.title}" (${meta.year}): ${queries.length} varianti.`);

    let promises = [];
    queries.forEach(q => {
        SCRAPER_MODULES.forEach(scraper => {
            if (scraper.searchMagnet) {
                promises.push(
                    LIMITERS.scraper.schedule(() =>
                        withTimeout(scraper.searchMagnet(q, meta.year, type, finalId), CONFIG.SCRAPER_TIMEOUT).catch(err => [])
                    )
                );
            }
        });
    });

    let resultsRaw = (await Promise.all(promises)).flat();

    // 3. 🔥 FILTRI UTENTE + FIX LISA FRANKENSTEIN 🔥
    resultsRaw = resultsRaw.filter(item => {
        if (!item?.magnet) return false;

        // Anno + Prefisso Check
        const fileYearMatch = item.title.match(/\b(19|20)\d{2}\b/);
        if (fileYearMatch) {
            const fileYear = parseInt(fileYearMatch[0]);
            const metaYear = parseInt(meta.year);

            if (fileYear !== metaYear) {
                const cleanT = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
                const cleanM = meta.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
                if (cleanT.indexOf(cleanM) > 0) return false;
            }
        }

        const isSemanticallySafe = smartMatch(meta.title, item.title, meta.isSeries);
        if (!isSemanticallySafe) return false;

        if (onlyIta && !isSafeForItalian(item)) return false;
        return true;
    });

    // Fallback Scraper
    if (resultsRaw.length <= 5) {
        const extPromises = FALLBACK_SCRAPERS.map(fb => {
            return LIMITERS.scraper.schedule(async () => {
                try { return await withTimeout(fb.searchMagnet(queries[0], meta.year, type, finalId), CONFIG.SCRAPER_TIMEOUT); } catch (err) { return []; }
            });
        });

        try {
            const extResultsRaw = await Promise.race([
                Promise.all(extPromises),
                new Promise(r => setTimeout(() => r([]), CONFIG.SCRAPER_TIMEOUT + 1500))
            ]);

            if (Array.isArray(extResultsRaw)) {
                const filteredExt = extResultsRaw.flat().filter(item => smartMatch(meta.title, item.title, meta.isSeries));
                resultsRaw = [...resultsRaw, ...filteredExt];
            }
        } catch (e) { }
    }

    // Deduplicazione
    const seen = new Set();
    let cleanResults = [];
    for (const item of resultsRaw) {
        if (!item || !item.magnet) continue;
        try {
            const hashMatch = item.magnet.match(/btih:([a-f0-9]{40})/i);
            const hash = hashMatch ? hashMatch[1].toUpperCase() : item.magnet;
            if (seen.has(hash)) continue;
            seen.add(hash);
            item._size = parseSize(item.size || item.sizeBytes);
            cleanResults.push(item);
        } catch (err) { continue; }
    }

    if (!cleanResults.length) return { streams: [{ name: "⛔", title: "Nessun risultato trovato" }] };

    // Ranking
    const ranked = rankAndFilterResults(cleanResults, meta, config).slice(0, CONFIG.MAX_RESULTS);

    // Risoluzione Link Debrid
    const rdPromises = ranked.map(item => {
        item.season = meta.season;
        item.episode = meta.episode;
        return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake));
    });

    const streams = (await Promise.all(rdPromises)).filter(Boolean);
    return { streams };
}

// ==========================================
// ROUTES & MANIFEST HANDLING
// ==========================================

// Helper Generazione Manifesto Dinamico
// FIX: Aggiunto parametro isConfigured
const getManifest = (isConfigured = false) => ({
    id: "org.corsaro.brain.v33.1",
    version: "1.0.0",
    name: "Leviathan",
    description: isConfigured 
        ? "Leviathan: Hybrid Architecture (ACTIVE)" 
        : "Leviathan: Please configure first",
    logo: "https://img.icons8.com/ios-filled/500/00f2ea/dragon.png",
    resources: ["stream"],
    types: ["movie", "series"],
    catalogs: [],
    behaviorHints: { 
        configurable: true, 
        // FIX: Se è configurato, NON richiedere più la configurazione
        configurationRequired: !isConfigured 
    }
});

// 1. Pagina di configurazione (Statica)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// 2. Health Check
app.get("/health", (req, res) => res.send({ status: "OK", uptime: process.uptime() }));

// 3. Manifesto BASE (Non configurato)
app.get("/manifest.json", (req, res) => {
    // Qui passiamo false, quindi Stremio mostrerà "Configure"
    const m = getManifest(false);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(m);
});

// 4. Manifesto CONFIGURATO
app.get("/:conf/manifest.json", (req, res) => {
    // Qui passiamo true, quindi Stremio mostrerà "Install"
    const m = getManifest(true);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(m);
});

// 5. Stream Handler
app.get("/:conf/stream/:type/:id.json", async (req, res) => {
    const config = getConfig(req.params.conf);
    const result = await generateStream(req.params.type, req.params.id.replace(".json", ""), config, req.params.conf);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(result);
});

// Helpers
function getConfig(configStr) {
    try {
        return JSON.parse(Buffer.from(configStr, "base64").toString());
    } catch {
        return {};
    }
}

function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(r => setTimeout(() => r([]), ms))]);
}

// Avvio Server
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => console.log(`🚀 Leviathan (Hybrid) v33.2 attivo su porta ${PORT}`));
