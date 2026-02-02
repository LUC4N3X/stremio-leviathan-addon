require('dotenv').config();
const express = require("express");
const cors = require("cors");
const compression = require('compression');
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
const Bottleneck = require("bottleneck");
const rateLimit = require("express-rate-limit");
const winston = require('winston');
const NodeCache = require("node-cache");
const ptt = require('parse-torrent-title'); 

// --- IMPORT ESTERNI ---
const { fetchExternalAddonsFlat } = require("./external-addons");
const PackResolver = require("./leviathan-pack-resolver");
const aioFormatter = require("./aiostreams-formatter.cjs");
const { searchWebStreamr } = require("./webstreamr_handler");

// --- IMPORT NUOVO MODULO CACHE TORBOX ---
const TbCache = require("./debrid/tb_cache.js");

// --- IMPORT NUOVO FORMATTER (Skins & Logic) ---
const { formatStreamSelector, cleanFilename, formatBytes } = require("./formatter");

// ---  IMPORT GESTORE P2P  ---
const P2P = require("./p2p_handler");

// --- IMPORT GESTORE TRAILER (YouTube/Invidious) ---
const { getTrailerStreams } = require("./trailerProvider"); 

// --- IMPORT GESTORI WEB (Vix, GuardaHD, GuardaSerie & AnimeWorld) ---
const { searchVix } = require("./vix/vix_handler");
const { searchGuardaHD } = require("./guardahd/ghd_handler"); 
const { searchGuardaserie } = require("./guardaserie/gs_handler"); 
const { searchAnimeWorld } = require("./animeworld/aw_handler"); // <--- NUOVO IMPORT

// --- 1. CONFIGURAZIONE LOGGER (Winston) ---
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// --- CACHE OTTIMIZZATA (NODE-CACHE) ---
const myCache = new NodeCache({ stdTTL: 1800, checkperiod: 120, maxKeys: 5000 });

const Cache = {
    getCachedMagnets: async (key) => { return myCache.get(`magnets:${key}`) || null; },
    cacheMagnets: async (key, value, ttl = 3600) => { myCache.set(`magnets:${key}`, value, ttl); },
    getCachedStream: async (key) => {
        const data = myCache.get(`stream:${key}`);
        if (data) logger.info(`⚡ CACHE HIT: ${key}`);
        return data || null;
    },
    cacheStream: async (key, value, ttl = 1800) => { myCache.set(`stream:${key}`, value, ttl); },
    listKeys: async () => myCache.keys(),
    deleteKey: async (key) => myCache.del(key),
    flushAll: async () => myCache.flushAll()
};

const { handleVixSynthetic } = require("./vix/vix_proxy");
const { generateSmartQueries } = require("./ai_query");
const { smartMatch } = require("./smart_parser");
const { rankAndFilterResults } = require("./ranking");
const { tmdbToImdb, imdbToTmdb, getTmdbAltTitles } = require("./id_converter");
const kitsuHandler = require("./kitsu_handler");
const RD = require("./debrid/realdebrid");
const AD = require("./debrid/alldebrid");
const TB = require("./debrid/torbox");
const dbHelper = require("./db-helper"); 
const { getManifest } = require("./manifest");

// Inizializza DB Locale
dbHelper.initDatabase();

// --- CONFIGURAZIONE CENTRALE ---
const CONFIG = {
  INDEXER_URL: process.env.INDEXER_URL || "", 
  CINEMETA_URL: "https://v3-cinemeta.strem.io",
  REAL_SIZE_FILTER: 80 * 1024 * 1024,
  MAX_RESULTS: 70,
  TIMEOUTS: {
    TMDB: 2000,
    SCRAPER: 6000,
    REMOTE_INDEXER: 2500, 
    LOCAL_DB: 1500, 
    DB_QUERY: 3000,
    DEBRID: 10000, 
    PACK_RESOLVER: 4000,
    EXTERNAL: 20000 
  }
};

const REGEX_YEAR = /(19|20)\d{2}/;

const REGEX_QUALITY_FILTER = {
    "4K": /\b(?:2160p|4k|uhd|ultra[-.\s]?hd|2160i)\b/i,
    "1080p": /\b(?:1080p|1080i|fhd|full[-.\s]?hd|blu[-.\s]?ray|bd[-.\s]?rip)\b/i,
    "720p": /\b(?:720p|720i|hd[-.\s]?rip|hd)\b/i,
    "SD": /\b(?:480p|576p|sd|dvd|dvd[-.\s]?rip|dvd[-.\s]?scr|cd)\b/i
};

// =========================================================================
// 🔥 SISTEMA DI RICONOSCIMENTO LINGUA (STRICT MODE) 🔥
// =========================================================================

// 1. ITA/ITALIAN: Sicuri al 100% (3 lettere o più)
const REGEX_STRONG_ITA = /\b(ITA|ITALIAN|ITALIANO)\b/i;

// 2. CONTEXT IT: "IT" (2 lettere) accettato SOLO se preceduto da keyword audio
const REGEX_CONTEXT_IT = /\b(AUDIO|LINGUA|LANG|VO|AC-?3|AAC|MP3|DDP|DTS|TRUEHD)\W+(IT)\b/i;

// 3. ISOLATED IT: "IT" accettato SOLO se tra delimitatori molto specifici
const REGEX_ISOLATED_IT = /(?:^|[_\-.])(IT)(?:$|[_\-.])/;

// 4. MULTI/DUAL: Se dice Multi/Dual, controlliamo che ci sia ITA dentro
const REGEX_MULTI_ITA = /\b(MULTI|DUAL|TRIPLE).*(ITA|ITALIAN)\b/i;

// 5. RELEASE GROUPS NOTI ITALIANI
const REGEX_TRUSTED_GROUPS = /\b(iDN_CreW|CORSARO|MUX|WMS|TRIDIM|SPEEDVIDEO|EAGLE|TRL|MEA|LUX|DNA|LEST|GHIZZO|USAbit|Bric|Dtone|Gaiage|BlackBit|Pantry|Vics|Papeete|Lidri|MirCrew)\b/i;

// 6. FALSE POSITIVE CHECK
const REGEX_FALSE_IT = /\b(10BIT|BIT|WIT|HIT|FIT|KIT|SIT|LIT|PIT)\b/i;

// Regex specifica per escludere i soli sottotitoli (False Positives)
const REGEX_SUB_ONLY = /\b(SUB|SUBS|SUBBED|SOTTOTITOLI|VOST|VOSTIT)\s*[:.\-_]?\s*(ITA|IT|ITALIAN)\b/i;
// Regex per confermare che, anche se c'è scritto SUB, c'è pure l'audio
const REGEX_AUDIO_CONFIRM = /\b(AUDIO|AC3|AAC|DTS|MD|LD|DDP|MP3|LINGUA)[\s.\-_]+(ITA|IT)\b/i;

// =========================================================================
// 🆕 PARSER HELPER (INTEGRATO)
// =========================================================================
const languageMapping = {
  'english': '🇬🇧 ENG',
  'japanese': '🇯🇵 JPN',
  'italian': '🇮🇹 ITA',
  'french': '🇫🇷 FRA',
  'german': '🇩🇪 GER',
  'spanish': '🇪🇸 ESP',
  'russian': '🇷🇺 RUS',
  'multi audio': '🌍 MULTI'
};

function parseTitleDetails(filename) {
    if (!filename) return { quality: 'SD', tags: '', languages: [] };
    try {
        const info = ptt.parse(filename);
        const codec = info.codec ? info.codec.toUpperCase() : '';
        const audio = info.audio ? info.audio.toUpperCase() : '';
        const source = info.source ? info.source.toUpperCase() : '';
        
        let languages = [];
        if (info.languages && Array.isArray(info.languages)) {
            languages = info.languages.map(l => languageMapping[l] || l.substring(0,3).toUpperCase());
        }

        return {
            quality: info.resolution || 'SD',
            tags: [source, codec, audio].filter(x => x).join(' '),
            languages: languages,
            cleanTitle: info.title
        };
    } catch (e) {
        return { quality: 'SD', tags: '', languages: [] };
    }
}
// =========================================================================


function base32ToHex(base32) {
    const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    let hex = "";
    for (let i = 0; i < base32.length; i++) {
        const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
        bits += val.toString(2).padStart(5, '0');
    }
    for (let i = 0; i + 4 <= bits.length; i += 4) {
        const chunk = bits.substr(i, 4);
        hex += parseInt(chunk, 2).toString(16);
    }
    return hex;
}

function extractInfoHash(magnet) {
    if (!magnet) return null;
    const match = magnet.match(/btih:([A-Fa-f0-9]{40}|[A-Za-z2-7]{32})/i);
    if (!match) return null;
    const hash = match[1];
    if (hash.length === 32) {
        return base32ToHex(hash).toUpperCase();
    }
    return hash.toUpperCase();
}

const LIMITERS = {
  scraper: new Bottleneck({ maxConcurrent: 40, minTime: 10 }),
  rd: new Bottleneck({ maxConcurrent: 15, minTime: 200 }),
};

const SCRAPER_MODULES = [ require("./engines") ];

const app = express();
app.set('trust proxy', 1);

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 350,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Troppe richieste da questo IP, riprova più tardi."
});
app.use(limiter);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- HELPER FUNZIONALI POTENZIATI ---

// Nuova parseSize robusta (Gestisce virgole e formati sporchi)
function parseSize(sizeText) {
  if (!sizeText) return 0;
  if (typeof sizeText === 'number') return sizeText;
  
  const str = sizeText.toString();
  let scale = 1;
  
  if (str.match(/TB/i)) {
    scale = 1024 * 1024 * 1024 * 1024;
  } else if (str.match(/GB/i)) {
    scale = 1024 * 1024 * 1024;
  } else if (str.match(/MB/i)) {
    scale = 1024 * 1024;
  } else if (str.match(/KB/i) || str.match(/kB/i)) {
    scale = 1024;
  } else if (str.match(/B/i) && !str.match(/GB|MB|KB|TB/i)) {
    scale = 1;
  }
  
  // Rimuove virgole e caratteri non numerici (lascia il punto)
  const cleanStr = str.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : Math.floor(num * scale);
}

// Estrae seeders da stringhe formattate con icone (stile Leviathan)
function extractSeeders(title) {
  // Cerca sia l'icona singola 👤 che quella di gruppo 👥
  const seedersMatch = title.match(/(?:👤|👥)\s*(\d+)/);
  return seedersMatch && parseInt(seedersMatch[1]) || 0;
}

// Estrae dimensione da stringhe formattate con icone
function extractSize(title) {
  const sizeMatch = title.match(/(?:💾|🧲|📦)\s*([\d.,]+\s*\w+)/i);
  return sizeMatch && parseSize(sizeMatch[1]) || 0;
}

// Estrae provider da tag nel titolo (es. [RD])
function extractProvider(title) {
  const match = title.match(/\[([A-Z]{2,3})\]/);
  return match?.[1] || "P2P";
}

function deduplicateResults(results) {
  const hashMap = new Map();
  for (const item of results) {
    if (!item?.magnet) continue;
    const rawHash = item.infoHash || item.hash || extractInfoHash(item.magnet);
    const finalHash = rawHash ? rawHash.toUpperCase() : null;
    if (!finalHash || finalHash.length !== 40) continue;
    item.hash = finalHash;
    item.infoHash = finalHash;
    
    // Assicuriamoci che la dimensione sia parsata correttamente
    item._size = parseSize(item.sizeBytes || item.size);

    const existing = hashMap.get(finalHash);
    if (!existing || (item.seeders || 0) > (existing.seeders || 0)) {
      hashMap.set(finalHash, item);
    }
  }
  return Array.from(hashMap.values());
}

function filterByQualityLimit(results, limit) {
    if (!limit || limit === 0 || limit === "0") return results;
    const limitNum = parseInt(limit);
    if (isNaN(limitNum)) return results;
    const counts = { "4K": 0, "1080p": 0, "720p": 0, "SD": 0 };
    const filtered = [];
    for (const item of results) {
        const t = (item.title || "").toLowerCase();
        let q = "SD";
        if (REGEX_QUALITY_FILTER["4K"].test(t)) q = "4K";
        else if (REGEX_QUALITY_FILTER["1080p"].test(t)) q = "1080p";
        else if (REGEX_QUALITY_FILTER["720p"].test(t)) q = "720p";
        if (counts[q] < limitNum) {
            filtered.push(item);
            counts[q]++;
        }
    }
    return filtered;
}

function isSafeForItalian(item) {
  if (!item || !item.title) return false;
  const t = item.title;
  
  if (REGEX_TRUSTED_GROUPS.test(t)) return true;
  if (REGEX_STRONG_ITA.test(t)) return true;
  if (REGEX_MULTI_ITA.test(t)) return true;
  if (REGEX_CONTEXT_IT.test(t)) return true;
  
  if (REGEX_ISOLATED_IT.test(t)) {
      if (REGEX_FALSE_IT.test(t)) return false;
      return true;
  }
  
  return false;
}

function validateStreamRequest(type, id) {
  const validTypes = ['movie', 'series'];
  if (!validTypes.includes(type)) {
    throw new Error(`Tipo non valido: ${type}`);
  }
  const cleanIdToCheck = id.replace('ai-recs:', '');
  const idPattern = /^(tt\d+|\d+|tmdb:\d+|kitsu:\d+)(:\d+)?(:\d+)?$/;
  if (!idPattern.test(cleanIdToCheck) && !idPattern.test(id)) {
    throw new Error(`Formato ID non valido: ${id}`);
  }
  return true;
}

async function withTimeout(promise, ms, operation = 'Operation') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new Error(`TIMEOUT: ${operation} exceeded ${ms}ms`)); }, ms);
  });
  try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer);
      return result;
  } catch (error) {
      clearTimeout(timer);
      throw error;
  }
}

async function fetchTmdbMeta(tmdbId, type, userApiKey) {
    if (!tmdbId) return null;
    const apiKey = (userApiKey && userApiKey.length > 1) ? userApiKey : "4b9dfb8b1c9f1720b5cd1d7efea1d845";
    const endpoint = type === 'series' || type === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${apiKey}&language=it-IT`;
    try {
        const { data } = await axios.get(url, { timeout: CONFIG.TIMEOUTS.TMDB });
        return data;
    } catch (e) {
        logger.warn(`TMDB Meta Fetch Error for ${tmdbId}: ${e.message}`);
        return null;
    }
}

async function getMetadata(id, type, config = {}) {
  try {
    const allowedTypes = ["movie", "series"];
    if (!allowedTypes.includes(type)) return null;

    let imdbId = id; 
    let season = 0; 
    let episode = 0;

    if (type === "series" && id.includes(":")) {
        const parts = id.split(":");
        imdbId = parts[0];
        season = parseInt(parts[1]);
        episode = parseInt(parts[2]);
    }
    
    const cleanId = imdbId.match(/^(tt\d+|\d+)$/i)?.[0] || imdbId;
    if (!cleanId) return null;

    try {
        const userTmdbKey = config.tmdb; 
        const { tmdbId } = await imdbToTmdb(cleanId, userTmdbKey);

        if (tmdbId) {
            const tmdbData = await fetchTmdbMeta(tmdbId, type, userTmdbKey);
            if (tmdbData) {
                const title = tmdbData.title || tmdbData.name;
                const originalTitle = tmdbData.original_title || tmdbData.original_name;
                const releaseDate = tmdbData.release_date || tmdbData.first_air_date;
                const year = releaseDate ? releaseDate.split("-")[0] : "";
                logger.info(`✅ [META] Usato TMDB (UserKey: ${!!userTmdbKey}): ${title} (${year}) [ID: ${tmdbId}] Orig: ${originalTitle}`);
                return {
                    title: title,
                    originalTitle: originalTitle, 
                    year: year,
                    imdb_id: cleanId,
                    tmdb_id: tmdbId, 
                    isSeries: type === "series",
                    season: season,
                    episode: episode
                };
            }
        }
    } catch (err) {
        logger.warn(`⚠️ Errore Metadata TMDB, fallback a Cinemeta: ${err.message}`);
    }

    logger.info(`ℹ️ [META] Fallback a Cinemeta per ${cleanId}`);
    const { data: cData } = await axios.get(`${CONFIG.CINEMETA_URL}/meta/${type}/${cleanId}.json`, { timeout: CONFIG.TIMEOUTS.TMDB }).catch(() => ({ data: {} }));
    
    return cData?.meta ? {
      title: cData.meta.name,
      originalTitle: cData.meta.name, 
      year: cData.meta.year?.split("–")[0],
      imdb_id: cleanId,
      isSeries: type === "series",
      season: season,
      episode: episode
    } : null;

  } catch (err) {
    logger.error(`Errore getMetadata Critical: ${err.message}`);
    return null;
  }
}

function saveResultsToDbBackground(meta, results) {
    if (!results || results.length === 0) return;
    (async () => {
        let savedCount = 0;
        for (const item of results) {
            const torrentObj = {
                info_hash: item.hash || item.infoHash,
                title: item.title,
                size: item._size || item.sizeBytes || 0,
                seeders: item.seeders || 0,
                provider: item.source || 'External'
            };
            if (!torrentObj.info_hash) continue;
            const success = await dbHelper.insertTorrent(meta, torrentObj);
            if (success) savedCount++;
        }
        if (savedCount > 0) {
            console.log(`💾 [AUTO-LEARN] Salvati ${savedCount} nuovi torrent nel DB per ${meta.imdb_id}`);
        }
    })().catch(err => console.error("❌ Errore background save:", err.message));
}

// --- RISOLUZIONE DEBRID E FORMATTAZIONE ---
async function resolveDebridLink(config, item, showFake, reqHost, meta) {
    try {
        const service = config.service || 'rd';
        const apiKey = config.key || config.rd;
        if (!apiKey) return null;

        const isAIOActive = aioFormatter.isAIOStreamsEnabled(config);

        let displayTitle = item.title;
        let isPack = item._isPack || /(?:complete|pack|season|stagione|tutta)/i.test(item.title);
        const isSeries = (meta?.season > 0 || meta?.episode > 0);

        if (isAIOActive && isPack && isSeries && meta) {
             const s = meta.season < 10 ? `0${meta.season}` : meta.season;
             const e = meta.episode < 10 ? `0${meta.episode}` : meta.episode;
             displayTitle = `${meta.title} S${s}E${e}`;
        }

        const ensureSize = (size, title, isSeries, isPack) => {
            if (isAIOActive && isPack && isSeries) return 0;
            if (size && size > 0) return size;
            
            let hash = 0;
            const safeTitle = (title || "video").toLowerCase();
            for (let i = 0; i < safeTitle.length; i++) {
                hash = safeTitle.charCodeAt(i) + ((hash << 5) - hash);
            }
            hash = Math.abs(hash);

            if (isSeries) {
                if (/2160p|4k|uhd/i.test(safeTitle)) {
                    const variance = (hash % 500) / 100; 
                    return (3 + variance) * 1024 * 1024 * 1024;
                }
                if (/1080p|fhd/i.test(safeTitle)) {
                    const variance = (hash % 230) / 100;
                    return (1.2 + variance) * 1024 * 1024 * 1024;
                }
                if (/720p|hd/i.test(safeTitle)) {
                    const variance = (hash % 100) / 100; 
                    return (0.5 + variance) * 1024 * 1024 * 1024;
                }
            } else {
                if (/2160p|4k|uhd/i.test(safeTitle)) {
                    const variance = (hash % 2300) / 100;
                    return (12 + variance) * 1024 * 1024 * 1024;
                }
                if (/1080p|fhd/i.test(safeTitle)) {
                    const variance = (hash % 900) / 100; 
                    return (5 + variance) * 1024 * 1024 * 1024;
                }
                if (/720p|hd/i.test(safeTitle)) {
                    const variance = (hash % 350) / 100; 
                    return (2.5 + variance) * 1024 * 1024 * 1024;
                }
            }
            const variance = (hash % 80) / 100;
            return (0.7 + variance) * 1024 * 1024 * 1024;
        };

        // ANALISI DETTAGLI PER TORBOX (e fallback)
        const details = parseTitleDetails(item.title);

        if (service === 'tb') {
            if (item._tbCached) {
                let realSize = item._size || item.sizeBytes || 0;
                realSize = ensureSize(realSize, item.title, isSeries, isPack);
                if (realSize === 0) realSize = ensureSize(0, item.title, isSeries, false);

                // FIX: Gestione corretta di fileIdx
                const fIdx = (item.fileIdx !== undefined && !isNaN(item.fileIdx)) ? item.fileIdx : -1;
                const proxyUrl = `${reqHost}/${config.rawConf}/play_tb/${item.hash}?s=${item.season || 0}&e=${item.episode || 0}&f=${fIdx}`;

                if (isAIOActive) {
                    let quality = details.quality || "SD";
                    if (/4k|2160p/i.test(item.title)) quality = "4K"; 
                    
                    return {
                        name: aioFormatter.formatStreamName({
                            service: 'torbox',
                            cached: true,
                            quality: quality
                        }),
                        title: aioFormatter.formatStreamTitle({
                            title: displayTitle,
                            size: formatBytes(realSize),
                            language: isSafeForItalian(item) ? "🇮🇹 ITA" : (details.languages.join('/') || "🇬🇧/Unknown"),
                            source: item.source,
                            seeders: item.seeders,
                            infoHash: item.hash, 
                            techInfo: `🎞️ ${quality} ${details.tags}`
                        }),
                        url: proxyUrl,
                        infoHash: item.hash,
                        behaviorHints: { notWebReady: false, bingieGroup: `Leviathan|${quality}|TB|${item.hash}` }
                    };
                } else {
                    const { name, title, bingeGroup } = formatStreamSelector(
                        item.title, item.source, realSize, item.seeders, "TB", config, item.hash, false, item._isPack
                    );
                    return { name, title, url: proxyUrl, behaviorHints: { notWebReady: false, bingieGroup: bingeGroup } };
                }
            } else { return null; }
        }

        let streamData = null;
        if (service === 'rd') streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        else if (service === 'ad') streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode);

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) return null;

        let finalSize = streamData.size || item._size || item.sizeBytes || 0;
        finalSize = ensureSize(finalSize, streamData.filename || item.title, isSeries, isPack);
        if (finalSize === 0) finalSize = ensureSize(0, item.title, isSeries, false);

        // USIAMO IL NUOVO PARSER SUL FILE EFFETTIVO (SE DISPONIBILE) O SUL TITOLO
        const fileDetails = parseTitleDetails(streamData.filename || item.title);

        if (isAIOActive) {
             let quality = fileDetails.quality || "SD";
             if (/4k|2160p/i.test(item.title)) quality = "4K"; 
             
             let fullService = 'p2p';
             if (service === 'rd') fullService = 'realdebrid';
             if (service === 'ad') fullService = 'alldebrid';
             if (service === 'tb') fullService = 'torbox';

             return {
                name: aioFormatter.formatStreamName({
                    service: fullService,
                    cached: true,
                    quality: quality
                }),
                title: aioFormatter.formatStreamTitle({
                    title: displayTitle,
                    size: formatBytes(finalSize),
                    language: isSafeForItalian(item) ? "🇮🇹 ITA" : (fileDetails.languages.join('/') || "🇬🇧/Unknown"),
                    source: item.source,
                    seeders: item.seeders,
                    infoHash: item.hash,
                    techInfo: `🎞️ ${quality} ${fileDetails.tags}`
                }),
                url: streamData.url,
                infoHash: item.hash,
                behaviorHints: { notWebReady: false, bingieGroup: `Leviathan|${quality}|${service}|${item.hash}` }
            };
        } else {
            const serviceTag = service.toUpperCase();
            const { name, title, bingeGroup } = formatStreamSelector(
                streamData.filename || item.title, item.source, finalSize, item.seeders, serviceTag, config, item.hash, false, item._isPack
            );
            return { name, title, url: streamData.url, behaviorHints: { notWebReady: false, bingieGroup: bingeGroup } };
        }
    } catch (e) {
        if (showFake) return { name: `[P2P ⚠️]`, title: `${item.title}\n⚠️ Cache Assente`, url: item.magnet, behaviorHints: { notWebReady: true } };
        return null;
    }
}

function generateLazyStream(item, config, meta, reqHost, userConfStr, isLazy = false) {
    const service = config.service || 'rd';
    const serviceTag = service.toUpperCase();
    const isAIOActive = aioFormatter.isAIOStreamsEnabled(config); 
    const isPack = item._isPack || /(?:complete|pack|season|stagione|tutta)/i.test(item.title);
    const isSeries = (meta.season > 0 || meta.episode > 0);

    let displayTitle = item.title;
    let realSize = item._size || item.sizeBytes || 0;

    if (isAIOActive) {
        if (isPack && isSeries) realSize = 0; 
        if (isPack && isSeries) {
            const s = meta.season < 10 ? `0${meta.season}` : meta.season;
            const e = meta.episode < 10 ? `0${meta.episode}` : meta.episode;
            displayTitle = `${meta.title} S${s}E${e}`;
        }
    }

    if (realSize === 0) {
        let hash = 0;
        const safeTitle = (displayTitle || "video").toLowerCase();
        for (let i = 0; i < safeTitle.length; i++) {
            hash = safeTitle.charCodeAt(i) + ((hash << 5) - hash);
        }
        hash = Math.abs(hash);

        if (isSeries) {
            if (/2160p|4k|uhd/i.test(safeTitle)) {
                const v = (hash % 500) / 100; 
                realSize = (3 + v) * 1024 * 1024 * 1024;
            } else if (/1080p|fhd/i.test(safeTitle)) {
                const v = (hash % 230) / 100;
                realSize = (1.2 + v) * 1024 * 1024 * 1024;
            } else if (/720p|hd/i.test(safeTitle)) {
                const v = (hash % 100) / 100;
                realSize = (0.5 + v) * 1024 * 1024 * 1024;
            } else {
                realSize = 400 * 1024 * 1024;
            }
        } else {
            realSize = 1.5 * 1024 * 1024 * 1024;
        }
    }

    if (isAIOActive) {
        // PARSER INTEGRATION
        const details = parseTitleDetails(item.title);
        let quality = details.quality || "SD";
        
        if (/4k|2160p/i.test(item.title)) quality = "4K";
        
        let fullService = 'p2p';
        if (service === 'rd') fullService = 'realdebrid';
        if (service === 'ad') fullService = 'alldebrid';
        if (service === 'tb') fullService = 'torbox';

        const nameStr = aioFormatter.formatStreamName({
            addonName: "Leviathan", 
            service: fullService,
            cached: true,
            quality: quality
        });

        const titleStr = aioFormatter.formatStreamTitle({
            title: displayTitle, 
            size: formatBytes(realSize),
            language: isSafeForItalian(item) ? "🇮🇹 ITA" : (details.languages.join('/') || "🇬🇧/Unknown"), 
            source: item.source,
            seeders: item.seeders,
            infoHash: item.hash,
            techInfo: `🎞️ ${quality} ${details.tags}`
        });

        // FIX: Sanitizzazione di fileIdx per URL
        const fileIdxParam = (item.fileIdx !== undefined && !isNaN(item.fileIdx)) ? item.fileIdx : -1;
        const lazyUrl = `${reqHost}/${userConfStr}/play_lazy/${service}/${item.hash}/${fileIdxParam}?s=${meta.season || 0}&e=${meta.episode || 0}`;

        return {
            name: nameStr,
            title: titleStr,
            url: lazyUrl,
            infoHash: item.hash,
            behaviorHints: { 
                notWebReady: false, 
                bingieGroup: `Leviathan|${quality}|${service}|${item.hash}` 
            }
        };
    } 
    else {
        const { name, title, bingeGroup } = formatStreamSelector(
            item.title, item.source, realSize, item.seeders, serviceTag, config, item.hash, isLazy, item._isPack 
        );
        // FIX: Sanitizzazione di fileIdx per URL
        const fileIdxParam = (item.fileIdx !== undefined && !isNaN(item.fileIdx)) ? item.fileIdx : -1;
        const lazyUrl = `${reqHost}/${userConfStr}/play_lazy/${service}/${item.hash}/${fileIdxParam}?s=${meta.season || 0}&e=${meta.episode || 0}`;
        return {
            name,
            title,
            url: lazyUrl,
            infoHash: item.hash,
            behaviorHints: { notWebReady: false, bingieGroup: bingeGroup }
        };
    }
}

async function queryLocalIndexer(meta, config) { 
    try {
        if (dbHelper && typeof dbHelper.getTorrents === 'function') {
            const s = parseInt(meta.season) || 0;
            const e = parseInt(meta.episode) || 0;
            const results = await dbHelper.getTorrents(meta.imdb_id, s, e);
            if (results && Array.isArray(results) && results.length > 0) {
                const cleanMeta = meta.title.toLowerCase().replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();
                const metaTitleShort = meta.title.split(/ - |: /)[0].toLowerCase().trim();
                
                const langMode = config && config.filters ? (config.filters.language || (config.filters.allowEng ? "all" : "ita")) : "ita";
                
                return results.map(t => {
                    let finalHash = t.info_hash ? t.info_hash.trim().toUpperCase() : "";
                    if ((!finalHash || finalHash.length !== 40) && t.magnet) {
                          const extracted = extractInfoHash(t.magnet);
                          if (extracted) finalHash = extracted.toUpperCase();
                    }
                    let magnetLink = t.magnet || `magnet:?xt=urn:btih:${finalHash}&dn=${encodeURIComponent(t.title || 'video')}`;
                    return {
                        title: t.title || t.name || "Unknown Title",
                        magnet: magnetLink,
                        hash: finalHash,       
                        infoHash: finalHash,  
                        size: "💾 DB", 
                        sizeBytes: parseInt(t.size) || 0,
                        seeders: t.seeders || 0,
                        source: t.provider || 'External', 
                        fileIdx: t.file_index,
                        isExternal: false 
                    };
                }).filter(item => {
                    if (!item.hash || item.hash.length !== 40) return false;
                    const cleanFile = item.title.toLowerCase().replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();
                    const isCorsaro = /corsaro/i.test(item.source);
                    
                    const isItalianTitle = isSafeForItalian(item);
                    
                    if (langMode === 'ita') {
                         if (!isItalianTitle && !isCorsaro) return false;
                    }
                    else if (langMode === 'eng') {
                         if (isItalianTitle) return false;
                    }

                    if (/[а-яА-ЯёЁ]/.test(item.title)) return false;

                    if (meta.isSeries) {
                        const wrongSeasonRegex = /(?:s|stagione|season)\s*0?(\d+)(?!\d)/gi;
                        let match;
                        while ((match = wrongSeasonRegex.exec(cleanFile)) !== null) {
                            const foundSeason = parseInt(match[1]);
                            if (foundSeason !== s) return false; 
                        }
                        const hasRightSeason = new RegExp(`(?:s|stagione|season|^)\\s*0?${s}(?!\\d)`, 'i').test(cleanFile);
                        const hasXFormat = new RegExp(`\\b${s}x0?${e}\\b`, 'i').test(cleanFile);
                        if (hasXFormat) return true;
                        const isExplicitPack = /(?:complete|pack|stagione\s*\d+\s*$|season\s*\d+\s*$|tutta|completa)/i.test(cleanFile);
                        const hasAnyEpisodeTag = /(?:e|x|ep|episode)\s*0?\d+/i.test(cleanFile);
                        const hasRightEpisode = new RegExp(`(?:e|x|ep|episode|^)\\s*0?${e}(?!\\d)`, 'i').test(cleanFile);
                        if (hasRightSeason && (hasRightEpisode || isExplicitPack || !hasAnyEpisodeTag)) {
                            // OK
                        } else {
                            return false; 
                        }
                    }
                    let searchKeyword = cleanMeta.replace(/^(the|a|an|il|lo|la|i|gli|le)\s+/i, "").trim();
                    if (searchKeyword === "rip") {
                          const strictStartRegex = /^(the\s+|il\s+)?rip\b/i;
                          if (!strictStartRegex.test(cleanFile)) return false; 
                          return true; 
                    }
                    if (cleanFile.includes(cleanMeta)) return true;
                    if (cleanFile.includes(metaTitleShort)) return true;
                    return false;
                });
            }
        }
        return [];
    } catch (e) {
        logger.error(`❌ [LOCAL DB] Errore lettura: ${e.message}`);
        return [];
    }
}

async function queryRemoteIndexer(tmdbId, type, season = null, episode = null, config) { 
    if (!CONFIG.INDEXER_URL) return [];
    try {
        logger.info(`🌐 [REMOTE] Query VPS: ${CONFIG.INDEXER_URL} | ID: ${tmdbId} S:${season} E:${episode}`);
        let url = `${CONFIG.INDEXER_URL}/api/get/${tmdbId}`;
        if (season) url += `?season=${season}`;
        if (episode) url += `&episode=${episode}`;
        const { data } = await axios.get(url, { timeout: CONFIG.TIMEOUTS.REMOTE_INDEXER });
        if (!data || !data.torrents || !Array.isArray(data.torrents)) return [];
        
        const mapped = data.torrents.map(t => {
            let magnet = t.magnet || `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.title)}`;
            if(!magnet.includes("tr=")) {
               magnet += "&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce";
            }
            let providerName = t.provider || 'P2P';
            providerName = providerName.replace(/LeviathanDB/i, '').replace(/[()]/g, '').trim();
            if(!providerName) providerName = 'P2P';
            const finalHash = t.info_hash ? t.info_hash.toUpperCase() : extractInfoHash(magnet);
            return {
                title: t.title,
                magnet: magnet,
                hash: finalHash,
                infoHash: finalHash,
                size: "💾 DB",
                sizeBytes: parseInt(t.size),
                seeders: t.seeders,
                source: providerName,
                fileIdx: t.file_index !== undefined ? parseInt(t.file_index) : undefined
            };
        });

        const langMode = config && config.filters ? (config.filters.language || (config.filters.allowEng ? "all" : "ita")) : "ita";
        
        return mapped.filter(item => {
             const isCorsaro = /corsaro/i.test(item.source);
             const isItalian = isSafeForItalian(item);

             if (langMode === 'ita') {
                 if (!isItalian && !isCorsaro) return false;
             } else if (langMode === 'eng') {
                 if (isItalian) return false;
             }
             return true;
        });
    } catch (e) {
        logger.error("Err Remote Indexer:", { error: e.message });
        return [];
    }
}

async function fetchExternalResults(type, finalId) {
    logger.info(`🌐 [EXTERNAL] Start Parallel Fetch...`);
    try {
        const externalResults = await withTimeout(
            fetchExternalAddonsFlat(type, finalId).then(items => {
                return items.map(i => {
                    const title = i.title || i.filename;
                    // Recupero dati mancanti usando il nuovo parser
                    let finalSeeders = i.seeders;
                    if (!finalSeeders && title) finalSeeders = extractSeeders(title);
                    
                    let finalSize = i.mainFileSize;
                    if ((!finalSize || finalSize === 0) && title) finalSize = extractSize(title);
                    
                    // Fallback per visualizzazione stringa
                    let displaySize = i.size;
                    if (!displaySize && finalSize > 0) displaySize = formatBytes(finalSize);

                    return {
                        title: title,
                        magnet: i.magnetLink,
                        size: displaySize,             
                        sizeBytes: finalSize,
                        seeders: finalSeeders,
                        source: i.externalProvider || i.source.replace(/\[EXT\]\s*/, ''),
                        hash: i.infoHash || extractInfoHash(i.magnetLink),
                        infoHash: i.infoHash || extractInfoHash(i.magnetLink),
                        fileIdx: i.fileIdx,
                        isExternal: true
                    };
                });
            }),
            CONFIG.TIMEOUTS.EXTERNAL,
            'External Addons'
        );
        if (externalResults && externalResults.length > 0) {
            logger.info(`✅ [EXTERNAL] Trovati ${externalResults.length} risultati`);
            return externalResults;
        } else {
            logger.info(`❌ [EXTERNAL] Nessun risultato trovato.`);
            return [];
        }
    } catch (err) {
        logger.warn('External Addons fallito/timeout', { error: err.message });
        return [];
    }
}

// --- GENERATE STREAM ---
async function generateStream(type, id, config, userConfStr, reqHost) {
  const hasDebridKey = (config.key && config.key.length > 0) || (config.rd && config.rd.length > 0);
  const isWebEnabled = config.filters && (config.filters.enableVix || config.filters.enableGhd || config.filters.enableGs || config.filters.enableAnimeWorld);
  
  // --- 🆕 P2P CHECK: Leggiamo il flag dalla config ---
  const isP2PEnabled = config.filters && config.filters.enableP2P === true;

  // Se non c'è Debrid, NON ci sono Web Scraper E il P2P è spento, allora mostra errore.
  if (!hasDebridKey && !isWebEnabled && !isP2PEnabled) {
      return { streams: [{ name: "⚠️ CONFIG", title: "Inserisci API Key, Attiva P2P o Attiva WebStream" }] };
  }
  
  const configHash = crypto.createHash('md5').update(userConfStr || 'no-conf').digest('hex');
  const cacheKey = `${type}:${id}:${configHash}`;
  
  const cachedResult = await Cache.getCachedStream(cacheKey);
  if (cachedResult) return cachedResult;

  const userTmdbKey = config.tmdb; 
  let finalId = id.replace('ai-recs:', '');
  
  if (finalId.startsWith("tmdb:")) {
      try {
          const parts = finalId.split(":");
          const imdbId = await tmdbToImdb(parts[1], type, userTmdbKey);
          if (imdbId) {
              if (type === "series" && parts.length >= 4) finalId = `${imdbId}:${parts[2]}:${parts[3]}`;
              else finalId = imdbId;
          }
      } catch (err) {}
  }
  if (finalId.startsWith("kitsu:")) {
      try {
          const parts = finalId.split(":");
          const kData = await kitsuHandler(parts[1]);
          if (kData && kData.imdbID) {
              const s = kData.season || 1;
              finalId = kData.type === 'series' || type === 'series' ? `${kData.imdbID}:${s}:${parts[2] || 1}` : kData.imdbID;
          }
      } catch (err) {}
  }

  const meta = await getMetadata(finalId, type, config);
  if (!meta) return { streams: [] };

  logger.info(`🚀 [SPEED] Start search for: ${meta.title}`);
  
  const tmdbIdLookup = meta.tmdb_id || (await imdbToTmdb(meta.imdb_id, userTmdbKey))?.tmdbId;
  const dbOnlyMode = config.filters?.dbOnly === true; 

  
  // LOGICA LINGUA UNIFICATA (ITA / ENG / ALL)
  const langMode = config.filters?.language || (config.filters?.allowEng ? "all" : "ita");

  // --- FILTRO AGGRESSIVO (LOGICA A 3 VIE: ITA / ALL / ENG) ---
  const aggressiveFilter = (item) => {
      if (!item?.magnet) return false;
      
      const source = (item.source || "").toLowerCase();
      // Filtro globale per fonti indesiderate
      if (source.includes("comet") || source.includes("stremthru")) return false;

      const t = item.title; 
      const tLower = t.toLowerCase();
      
      
      // CASO 1: SOLO ITALIANO (Comportamento Classico)
      if (langMode === "ita") {
           const isTrustedGroup = REGEX_TRUSTED_GROUPS.test(t) || /\bcorsaro\b/i.test(source);
           
           if (!isTrustedGroup) {
               const hasStrongIta = REGEX_STRONG_ITA.test(t) || REGEX_MULTI_ITA.test(t);
               const hasContextIt = REGEX_CONTEXT_IT.test(t);
               let hasIsolatedIt = false;
               if (REGEX_ISOLATED_IT.test(t)) {
                   if (!REGEX_FALSE_IT.test(t)) hasIsolatedIt = true; 
               }

               if (!hasStrongIta && !hasContextIt && !hasIsolatedIt) return false;

               // Controllo Anti-Falsi Positivi (Sub Only)
               const looksLikeSubOnly = REGEX_SUB_ONLY.test(t);
               const hasConfirmedAudio = REGEX_AUDIO_CONFIRM.test(t);
               if (looksLikeSubOnly && !hasConfirmedAudio) {
                   const cleanTitleNoSub = t.replace(REGEX_SUB_ONLY, ""); 
                   const stillHasStrong = REGEX_STRONG_ITA.test(cleanTitleNoSub);
                   const stillHasContext = REGEX_CONTEXT_IT.test(cleanTitleNoSub);
                   if (!stillHasStrong && !stillHasContext) return false; 
               }
           }
      }
      
      // CASO 2: SOLO INGLESE (Escludi attivamente l'Italiano)
      else if (langMode === "eng") {
           const hasStrongIta = REGEX_STRONG_ITA.test(t) || REGEX_MULTI_ITA.test(t);
           const hasContextIt = REGEX_CONTEXT_IT.test(t);
           const isTrustedItaGroup = REGEX_TRUSTED_GROUPS.test(t); // Es: Mux, Corsaro

           // Se è palesemente italiano, via!
           if (hasStrongIta || hasContextIt || isTrustedItaGroup) return false;
      }
      
      // CASO 3: ITALIANO + INGLESE ("all") - Nessun filtro lingua

      // --- FILTRO ANNO ---
      const metaYear = parseInt(meta.year);
      if (metaYear === 2025 && /frankenstein/i.test(meta.title)) {
           if (!item.title.includes("2025")) return false;
      }

      if (!isNaN(metaYear)) {
           const fileYearMatch = item.title.match(REGEX_YEAR);
           if (fileYearMatch) {
               const fileYear = parseInt(fileYearMatch[0]);
               if (Math.abs(fileYear - metaYear) > 1) return false; 
           }
      }

      // --- FILTRO SERIE TV ---
      if (meta.isSeries) {
          const s = meta.season;
          const e = meta.episode;
          
          const wrongSeasonRegex = /(?:s|stagione|season)\s*0?(\d+)(?!\d)/gi;
          let match;
          while ((match = wrongSeasonRegex.exec(tLower)) !== null) {
              const foundSeason = parseInt(match[1]);
              if (foundSeason !== s) return false; 
          }

          const xMatch = tLower.match(/(\d+)x(\d+)/i);
          if (xMatch) {
              if (parseInt(xMatch[1]) !== s) return false;
              if (parseInt(xMatch[2]) !== e) return false;
              return true;
          }

          const hasRightSeason = new RegExp(`(?:s|stagione|season|^)\\s*0?${s}(?!\\d)`, 'i').test(tLower);
          const hasRightEpisode = new RegExp(`(?:e|x|ep|episode|^)\\s*0?${e}(?!\\d)`, 'i').test(tLower);
          
          const hasAnyEpisodeTag = /(?:e|x|ep|episode)\s*0?\d+/i.test(tLower);
          const isExplicitPack = /(?:complete|pack|stagione\s*\d+\s*$|season\s*\d+\s*$|tutta|completa)/i.test(tLower);
          
          if (hasRightSeason && hasRightEpisode) return true;
          if (hasRightSeason && (isExplicitPack || !hasAnyEpisodeTag)) {
              item._isPack = true; 
              return true;
          }
          return false;
      } else {
          // PROTEZIONE FILM: Se è un film, scarta risultati che sembrano episodi/stagioni
          if (/\b(?:S\d{2}|SEASON|STAGIONE)\b/i.test(t)) return false;
          if (/\b\d{1,2}x\d{1,2}\b/.test(t)) return false;
      }

      // --- FILTRO NOME (MATCHING) ---
      const cleanFile = tLower.replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();
      const cleanMeta = meta.title.toLowerCase().replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();
      const metaTitleShort = meta.title.split(/ - |: /)[0].toLowerCase().trim();
      const metaOriginal = (meta.originalTitle || "").toLowerCase().trim();

      const checkMatch = (strToCheck) => {
          if (!strToCheck) return false;
          let searchKeyword = strToCheck.replace(/^(the|a|an|il|lo|la|i|gli|le)\s+/i, "").trim();
          if (searchKeyword === "rip") {
               const strictStartRegex = /^(the\s+|il\s+)?rip\b/i;
               return strictStartRegex.test(cleanFile);
          }
          if (searchKeyword.length <= 3) {
              const regexShort = new RegExp(`\\b${searchKeyword}\\b`, 'i');
              return regexShort.test(cleanFile);
          }
          return cleanFile.includes(searchKeyword);
      };

      if (checkMatch(cleanMeta)) return true;          
      if (checkMatch(metaTitleShort)) return true;  
      if (checkMatch(metaOriginal)) return true;      
      if (smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode)) return true;
      
      return false;
  };

  // --- FONTI VELOCI ---
  const remotePromise = withTimeout(
      queryRemoteIndexer(tmdbIdLookup, type, meta.season, meta.episode, config),
      CONFIG.TIMEOUTS.REMOTE_INDEXER,
      'Remote Indexer'
  ).catch(err => {
      logger.warn('Remote indexer fallito/timeout', { error: err.message });
      return [];
  });

  const localPromise = withTimeout(
      queryLocalIndexer(meta, config),
      CONFIG.TIMEOUTS.LOCAL_DB,
      'Local DB'
  ).catch(err => {
      logger.warn('Local DB fallito', { error: err.message });
      return [];
  });

  let externalPromise = Promise.resolve([]);
  if (!dbOnlyMode) {
      externalPromise = fetchExternalResults(type, finalId);
  }

  const [remoteResults, localResults, externalResults] = await Promise.all([remotePromise, localPromise, externalPromise]);
  logger.info(`📊 [STATS] Remote: ${remoteResults.length} | Local: ${localResults.length} | External: ${externalResults.length}`);

  let fastResults = [...remoteResults, ...localResults, ...externalResults].filter(aggressiveFilter);
  let cleanResults = deduplicateResults(fastResults);
  const validFastCount = cleanResults.length;
  logger.info(`⚡ [FAST CHECK] Trovati ${validFastCount} risultati validi da fonti veloci (Remote+Local+Ext).`);

  if (!dbOnlyMode && validFastCount < 3) {
      logger.info(`⚠️ [HEAVY] Meno di 3 risultati (${validFastCount}). Attivazione Scraper Locali...`);
      let dynamicTitles = [];
      try {
          if (tmdbIdLookup) dynamicTitles = await getTmdbAltTitles(tmdbIdLookup, type, userTmdbKey);
      } catch (e) {}
      
      // Gli scraper devono cercare in inglese se la modalità è 'all' o 'eng'
      const allowEngScraper = (langMode === "all" || langMode === "eng");
      const queries = generateSmartQueries(meta, dynamicTitles, allowEngScraper);
      
      let scrapedResults = [];
      if (queries.length > 0) {
          const allScraperTasks = [];
          queries.forEach(q => {
              SCRAPER_MODULES.forEach(scraper => {
                  if (scraper.searchMagnet) {
                      const searchOptions = { allowEng: allowEngScraper };
                      allScraperTasks.push(
                          LIMITERS.scraper.schedule(() => 
                              withTimeout(
                                  scraper.searchMagnet(q, meta.year, type, finalId, searchOptions),
                                  CONFIG.TIMEOUTS.SCRAPER,
                                  `Scraper ${scraper.name || 'Module'}`
                              ).catch(err => {
                                  logger.warn(`Scraper Timeout/Error: ${err.message}`);
                                  return [];
                              })
                          )
                      );
                  }
              });
          });
          scrapedResults = await Promise.all(allScraperTasks).then(results => results.flat());
          const filteredScraped = scrapedResults.filter(aggressiveFilter);
          const combined = [...cleanResults, ...filteredScraped];
          cleanResults = deduplicateResults(combined);
      }
  }

  if (!dbOnlyMode) {
      saveResultsToDbBackground(meta, cleanResults);
  }

  if (config.filters) {
      cleanResults = cleanResults.filter(item => {
          const t = (item.title || "").toLowerCase();
          if (config.filters.maxSizeGB && config.filters.maxSizeGB > 0) {
              const maxBytes = config.filters.maxSizeGB * 1024 * 1024 * 1024;
              const itemSize = item._size || item.sizeBytes || 0;
              if (itemSize > 0 && itemSize > maxBytes) return false;
          }
          if (config.filters.no4k && REGEX_QUALITY_FILTER["4K"].test(t)) return false;
          if (config.filters.no1080 && REGEX_QUALITY_FILTER["1080p"].test(t)) return false;
          if (config.filters.no720 && REGEX_QUALITY_FILTER["720p"].test(t)) return false;
          if (config.filters.noScr) {
                if (REGEX_QUALITY_FILTER["SD"].test(t)) return false;
                if (/cam|hdcam|ts|telesync|screener|scr\b/i.test(t)) return false;
          }
          if (config.filters.noCam && /cam|hdcam|ts|telesync|screener|scr\b/i.test(t)) return false;
          return true;
      });
  }

  let rankedList = rankAndFilterResults(cleanResults, meta, config);
  const sortMode = config.sort || (config.filters && config.filters.sort) || 'balanced';
  
  if (sortMode !== 'balanced') {
      rankedList.sort((a, b) => {
          const sizeA = a._size || a.sizeBytes || 0;
          const sizeB = b._size || b.sizeBytes || 0;
          if (sortMode === 'size') return sizeB - sizeA;
          if (sortMode === 'resolution') {
              const getResScore = (title) => {
                  const t = title.toLowerCase();
                  if (/2160p|4k|uhd/.test(t)) return 40;
                  if (/1080p|fhd/.test(t)) return 30;
                  if (/720p|hd/.test(t)) return 20;
                  return 10;
              };
              const scoreA = getResScore(a.title);
              const scoreB = getResScore(b.title);
              if (scoreA !== scoreB) return scoreB - scoreA;
              return sizeB - sizeA;
          }
          return 0;
      });
  }

  if (config.filters && config.filters.maxPerQuality) {
      rankedList = filterByQualityLimit(rankedList, config.filters.maxPerQuality);
  }

  
  // LOGICA TORBOX: FILTRO TOTALE (SOLO FILE PRONTI) + ID GRABBER
  if (config.service === 'tb' && hasDebridKey) {
      const apiKey = config.key || config.rd; 
      
      // Verifichiamo i primi 30 risultati
      const checkLimit = 30; 
      
      // Candidati
      const candidates = rankedList.slice(0, checkLimit);
      const remainingItems = rankedList.slice(checkLimit);

      if (candidates.length > 0) {
          logger.info(`📦 [TB CHECK] Scansiono ${candidates.length} torrent alla ricerca di file video reali...`);
          
          // Chiamata sincrona a TorBox 
          const cacheResults = await TbCache.checkCacheSync(candidates, apiKey, dbHelper, checkLimit);
          
          // FILTRO DISTRUTTIVO:
          const verifiedList = [];

          for (const item of candidates) {
              const hash = item.hash.toLowerCase();
              const result = cacheResults[hash];

              // CRITERIO DI AMMISSIONE:
              if (result && result.cached === true) {
                  item._tbCached = true;
                  
                  // Aggiorniamo la dimensione
                  if (result.file_size) {
                      item._size = result.file_size;
                  }

                  //  ASSEGNAZIONE FONDAMENTALE DELL'ID
                  // Questo impedisce l'errore "Idx: NaN" al playback
                  if (result.file_id !== undefined && result.file_id !== null) {
                      item.fileIdx = result.file_id;
                  }
                  
                  verifiedList.push(item);
              }
          }

          logger.info(`📦 [TB CLEANUP] Iniziali: ${candidates.length} -> Rimasti: ${verifiedList.length} (Eliminati ${candidates.length - verifiedList.length} ghost/vuoti)`);
          
          // SOVRASCRIVIAMO LA LISTA PRINCIPALE
          rankedList = verifiedList;
          
          // I rimanenti (oltre il 30esimo) vengono ignorati o salvati in background
          if (remainingItems.length > 0) {
              TbCache.enrichCacheBackground(remainingItems, apiKey, dbHelper);
          }

      } else {
          rankedList = [];
      }
  }
  // =================================================================

  let finalRanked = rankedList.slice(0, CONFIG.MAX_RESULTS);
  const ranked = finalRanked;

  let debridStreams = [];
  
  // CASO 1: UTENTE CON DEBRID 
  if (ranked.length > 0 && hasDebridKey) {
      let TOP_LIMIT = 0; 
      if (type === 'series') {
          TOP_LIMIT = 3;
      }
      const topItems = ranked.slice(0, TOP_LIMIT);
      const lazyItems = ranked.slice(TOP_LIMIT);

      const immediatePromises = topItems.map(item => {
          item.season = meta.season;
          item.episode = meta.episode;
          config.rawConf = userConfStr; 
          return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake, reqHost, meta));
      });

      const lazyStreams = lazyItems.map(item =>
          generateLazyStream(item, config, meta, reqHost, userConfStr, true)
      );

      const resolvedInstant = (await Promise.all(immediatePromises)).filter(Boolean);
      debridStreams = [...resolvedInstant, ...lazyStreams];
  } 
  
  // 🔥🔥🔥 CASO 2: UTENTE P2P (NUOVA LOGICA UNIFICATA CON FORMATTER) 🔥🔥🔥
  else if (ranked.length > 0 && isP2PEnabled) {
      logger.info(`⚡ [P2P MODE] Generating direct streams for ${meta.title}`);
      
      // Passiamo anche 'config' per far funzionare il formatter condiviso
      debridStreams = ranked.map(item => P2P.formatP2PStream(item, config));
  }

  let rawVix = [], formattedGhd = [], formattedGs = [], formattedVix = [], formattedAw = [];

  if (!dbOnlyMode) {
       const vixPromise = searchVix(meta, config, reqHost);
       let ghdPromise = Promise.resolve([]);
       if (config.filters && config.filters.enableGhd) {
           ghdPromise = searchGuardaHD(meta, config).catch(err => {
               logger.warn(`GuardaHD Error: ${err.message}`);
               return [];
           });
       }

       let gsPromise = Promise.resolve([]);
       if (config.filters && config.filters.enableGs) {
           gsPromise = searchGuardaserie(meta, config).catch(err => {
               logger.warn(`GuardaSerie Error: ${err.message}`);
               return [];
           });
       }

       // --- ANIME WORLD INTEGRATION ---
       let awPromise = Promise.resolve([]);
       if (config.filters && config.filters.enableAnimeWorld) {
           awPromise = searchAnimeWorld(meta, config).catch(err => {
               logger.warn(`AnimeWorld Error: ${err.message}`);
               return [];
           });
       }
       // ------------------------------

       [rawVix, formattedGhd, formattedGs, formattedAw] = await Promise.all([vixPromise, ghdPromise, gsPromise, awPromise]);
       
       if (aioFormatter && aioFormatter.isAIOStreamsEnabled(config)) {
           const applyAioStyle = (streamList, sourceName) => {
               if (!streamList || !Array.isArray(streamList)) return;
               streamList.forEach((stream, index) => {
                   let quality = "HD";
                   let qIcon = "📺";
                   let textToCheck = (stream.title + " " + (stream.name || "")).toUpperCase();
                   textToCheck = textToCheck
                       .replace("GUARDAHD", "")
                       .replace("STREAMINGCOMMUNITY", "")
                       .replace("LEVIATHAN", "")
                       .replace("VIX", "");
                   const regex4k = /\b(4K|2160P|UHD)\b/;
                   const regex1080 = /\b(1080P|FHD|FULLHD)\b/;
                   const regex720 = /\b(720P|HD)\b/;
                   const regexSD = /\b(480P|SD)\b/;
                   if (regex4k.test(textToCheck)) { quality = "4K"; qIcon = "🔥"; }
                   else if (regex1080.test(textToCheck)) { quality = "1080p"; qIcon = "🔥"; }
                   else if (regex720.test(textToCheck)) { quality = "720p"; qIcon = "🔥"; }
                   else if (regexSD.test(textToCheck)) { quality = "SD"; qIcon = "🔥"; }
                   else { quality = "WebStreams"; }
                   
                   if (sourceName.includes("StreamingCommunity") || sourceName.includes("Vix")) {
                       if (quality === "SD" && !regexSD.test(textToCheck)) {
                           quality = "1080p"; qIcon = "🔥";
                       }
                   }
                   const techStr = `🎞️ ${quality} ${qIcon}`;
                   stream.name = aioFormatter.formatStreamName({
                       service: "web", 
                       cached: true,
                       quality: quality
                   });
                   stream.title = aioFormatter.formatStreamTitle({
                       title: meta.title,  
                       size: "Web",        
                       language: "🇮🇹 ITA",
                       source: sourceName, 
                       seeders: null,
                       techInfo: techStr 
                   });
                   if (!stream.behaviorHints) stream.behaviorHints = {};
                   stream.behaviorHints.bingieGroup = `Leviathan|${quality}|Web|${sourceName.replace(/\W/g,'')}`;
               });
           };
           if (typeof rawVix !== 'undefined') applyAioStyle(rawVix, "StreamingCommunity");
           if (typeof formattedGhd !== 'undefined') applyAioStyle(formattedGhd, "GuardaHD");
           if (typeof formattedGs !== 'undefined') applyAioStyle(formattedGs, "GuardaSerie");
           
           // Formattazione speciale per AnimeWorld in stile AIO
           if (typeof formattedAw !== 'undefined' && formattedAw.length > 0) {
               formattedAw.forEach(stream => {
                   stream.name = aioFormatter.formatStreamName({ service: "web", cached: true, quality: "HD" });
                   stream.title = aioFormatter.formatStreamTitle({
                       title: meta.title, 
                       size: "Web", 
                       language: "🇯🇵 JPN/ITA", 
                       source: "AnimeWorld", 
                       techInfo: "⛩️ Anime"
                   });
                   if (!stream.behaviorHints) stream.behaviorHints = {};
                   stream.behaviorHints.bingieGroup = `Leviathan|HD|Web|AnimeWorld`;
               });
           }
       }
       formattedVix = rawVix; 
  }

  let finalStreams = [];
  if (config.filters && config.filters.vixLast === true) {
      finalStreams = [...debridStreams, ...formattedGhd, ...formattedGs, ...formattedAw, ...formattedVix];
  } else {
      finalStreams = [...formattedGhd, ...formattedGs, ...formattedAw, ...formattedVix, ...debridStreams];
  }

  if (config.filters) {
      finalStreams = finalStreams.filter(stream => {
          const checkStr = (stream.title + " " + (stream.name || "")).toUpperCase();
          if (config.filters.no720) {
              if (checkStr.includes("720P")) return false;
              const isGenericHD = /\bHD\b/.test(checkStr) && !/1080|2160|4K|FHD|UHD/.test(checkStr);
              if (isGenericHD) return false;
          }
          if (config.filters.no4k && (checkStr.includes("4K") || checkStr.includes("2160P") || checkStr.includes("UHD"))) return false;
          if (config.filters.no1080 && (checkStr.includes("1080P") || checkStr.includes("FHD") || checkStr.includes("FULLHD"))) return false;
          if ((config.filters.noScr || config.filters.noCam) && /CAM|SCR|TS|TELESYNC|HDCAM/.test(checkStr)) return false;
          return true;
      });
  }

  if (finalStreams.length === 0) {
      logger.info(`⚠️ [FALLBACK] Nessun risultato trovato (P2P/Web Locali). Attivo WebStreamr...`);
      const webStreamrResults = await searchWebStreamr(type, finalId);
      if (webStreamrResults.length > 0) {
           finalStreams.push(...webStreamrResults);
           logger.info(`🕷️ [WEBSTREAMR] Aggiunti ${webStreamrResults.length} stream di fallback.`);
      } else {
           logger.info(`❌ [WEBSTREAMR] Nessun risultato trovato.`);
      }
  }

  if (config.filters && config.filters.enableTrailers) {
      try {
         if (meta && meta.title) {
             const trailerStreams = await getTrailerStreams(
                 type,
                 meta.imdb_id,
                 meta.title,
                 meta.season,
                 meta.tmdb_id,
                 'it-IT'
             );
             if (trailerStreams && trailerStreams.length > 0) {
                 finalStreams.unshift(...trailerStreams);
                 logger.info(`🎬 [TRAILER] Aggiunto trailer in testa per: ${meta.title}`);
             }
         }
      } catch (err) {
         logger.warn(`⚠️ Errore recupero Trailer: ${err.message}`);
      }
  }
  
  const resultObj = { streams: finalStreams };
  if (finalStreams.length > 0) {
      await Cache.cacheStream(cacheKey, resultObj, 1800);
      logger.info(`💾 SAVED TO CACHE: ${cacheKey}`);
  }
  return resultObj;
}

app.get("/api/stats", (req, res) => res.json({ status: "ok" }));
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/:conf/play_lazy/:service/:hash/:fileIdx", async (req, res) => {
    const { conf, service, hash, fileIdx } = req.params;
    const { s, e } = req.query; 
    logger.info(`▶️ [LAZY PLAY] Service: ${service} | Hash: ${hash} | Idx: ${fileIdx} | S${s}E${e}`);
    try {
        const config = getConfig(conf);
        const apiKey = config.key || config.rd;
        if (!apiKey) return res.status(400).send("API Key mancante.");
        const trackers = [
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
        ];
        const trackerStr = trackers.map(tr => `&tr=${tr}`).join(""); 
        const magnet = `magnet:?xt=urn:btih:${hash}${trackerStr}`;
        const item = {
            title: `Unknown Video (${hash})`,
            hash: hash,
            season: parseInt(s) || 0,
            episode: parseInt(e) || 0,
            fileIdx: parseInt(fileIdx) === -1 ? undefined : parseInt(fileIdx),
            magnet: magnet 
        };
        let streamData = null;
        if (service === 'tb') {
             const tbFileIdx = item.fileIdx !== undefined ? String(item.fileIdx) : undefined;
             const tbS = String(item.season);
             const tbE = String(item.episode);
             streamData = await TB.getStreamLink(apiKey, item.magnet, tbS, tbE, item.hash, tbFileIdx);
        }
        else if (service === 'rd') {
            streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        }
        else if (service === 'ad') {
            const safeFileIdx = item.fileIdx !== undefined ? item.fileIdx : 0;
            streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode, safeFileIdx);
        }
        if (streamData && streamData.url) {
            if (config.mediaflow && config.mediaflow.proxyDebrid && config.mediaflow.url) {
                try {
                    const mfpBase = config.mediaflow.url.replace(/\/$/, '');
                    let finalUrl = `${mfpBase}/proxy/stream?d=${encodeURIComponent(streamData.url)}`;
                    if (config.mediaflow.pass) finalUrl += `&api_password=${config.mediaflow.pass}`;
                    return res.redirect(finalUrl);
                } catch (e) {}
            }
            return res.redirect(streamData.url);
        } 
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = `${protocol}://${req.get('host')}`;
        const addToCloudUrl = `${host}/${conf}/add_to_cloud/${hash}`;
        return res.redirect(addToCloudUrl);
    } catch (err) {
        logger.error(`Error Lazy Play: ${err.message}`);
        res.status(500).send("Errore nel recupero del link: " + err.message);
    }
});

app.get("/:conf/play_tb/:hash", async (req, res) => {
    const { conf, hash } = req.params;
    const { s, e, f } = req.query; 
    res.redirect(`/${conf}/play_lazy/tb/${hash}/${f || -1}?s=${s}&e=${e}`);
});

app.get("/:conf/add_to_cloud/:hash", async (req, res) => {
    const { conf, hash } = req.params;
    try {
        const config = getConfig(conf);
        const apiKey = config.key || config.rd;
        const service = config.service || 'rd';
        if (!apiKey) return res.status(400).send("API Key mancante.");
        logger.info(`📥 [CACHE BUILDER] Richiesta aggiunta hash ${hash} su ${service.toUpperCase()}`);
        if (service === 'rd') {
            await axios.post("https://api.real-debrid.com/rest/1.0/torrents/addMagnet", 
                `magnet=magnet:?xt=urn:btih:${hash}`, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
        } 
        else if (service === 'ad') {
            await axios.get("https://api.alldebrid.com/v4/magnet/upload", {
                params: { agent: "leviathan", apikey: apiKey, magnet: `magnet:?xt=urn:btih:${hash}` }
            });
        }
        else if (service === 'tb') {
             // 🛠️ CORREZIONE API TORBOX (Errore 404 Fix)
             await axios.post("https://api.torbox.app/v1/api/torrents/createtorrent", 
                { magnet: `magnet:?xt=urn:btih:${hash}`, seed: '1', allow_zip: 'false' }, 
                {
                    headers: { 
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                }
            );
        }
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = `${protocol}://${req.get('host')}`;
        const feedbackVideoUrl = `${host}/confirmed.mp4`;
        res.redirect(feedbackVideoUrl);
    } catch (err) {
        logger.error(`Errore Cache Builder: ${err.message}`);
        res.status(500).send("Errore durante l'aggiunta al cloud: " + err.message);
    }
});

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const validPass = process.env.ADMIN_PASS || "GodTierAccess2024";
    if (authHeader === validPass) next();
    else res.status(403).json({ error: "Password errata" });
};
app.get("/admin/keys", authMiddleware, async (req, res) => { res.json(await Cache.listKeys()); });
app.delete("/admin/key", authMiddleware, async (req, res) => {
  const { key } = req.query;
  if (key) { await Cache.deleteKey(key); res.json({ success: true }); } 
  else res.json({ error: "Key mancante" });
});
app.post("/admin/flush", authMiddleware, async (req, res) => {
  await Cache.flushAll();
  res.json({ success: true });
});

app.get("/health", async (req, res) => {
  const checks = { status: "ok", timestamp: new Date().toISOString(), services: {} };
  try {
    if (dbHelper.healthCheck) await withTimeout(dbHelper.healthCheck(), 1000, "DB Health");
    checks.services.database = "ok";
  } catch (err) {
    checks.services.database = "down";
    checks.status = "degraded";
    logger.error("Health Check DB Fail", { error: err.message });
  }
  try {
    await withTimeout(axios.get(`${CONFIG.INDEXER_URL}/health`), 1000, "Indexer Health");
    checks.services.indexer = "ok";
  } catch (err) {
    checks.services.indexer = "down";
  }
  checks.services.cache = myCache.keys().length > 0 ? "active" : "empty";
  res.status(checks.status === "ok" ? 200 : 503).json(checks);
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/:conf/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/manifest.json", (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json(getManifest()); });

app.get("/:conf/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const manifest = getManifest();
    try {
        const { conf } = req.params;
        const config = getConfig(conf);
        
        // --- 1. LOGICA BANDIERE DINAMICHE ---
        const filters = config.filters || {};
        const langMode = filters.language || (filters.allowEng ? "all" : "ita");

        let flag = "";
        if (langMode === "ita") {
            flag = " 🇮🇹";        // Solo Italiano
        } else if (langMode === "eng") {
            flag = " 🇬🇧";        // Solo Inglese
        } else {
            flag = " 🇮🇹🇬🇧";      // Misto (Doppia bandiera)
        }

        // --- 2. NOME "GRASSETTO E SPAZIATO" (UNICODE) ---
        const appName = "𝗟 𝗘 𝗩 𝗜 𝗔 𝗧 𝗛 𝗔 𝗡";

        const hasRDKey = (config.service === 'rd' && config.key) || config.rd;
        const hasTBKey = (config.service === 'tb' && config.key) || config.torbox;
        const hasADKey = (config.service === 'ad' && config.key) || config.alldebrid;
        const isP2P = filters.enableP2P === true;

        // --- 3. ASSEMBLAGGIO FINALE ---
        if (hasRDKey) {
            manifest.name = `${appName}${flag} 🐋️ RD`;
            manifest.id += ".rd"; 
        } 
        else if (hasTBKey) {
            manifest.name = `${appName}${flag} ⚓ TB`;
            manifest.id += ".tb";
        } 
        else if (hasADKey) {
            manifest.name = `${appName}${flag} 🐚 AD`;
            manifest.id += ".ad";
        }
        else if (isP2P) {
             //   LOGICA P2P
            manifest.name = `${appName}${flag} 🦈 P2P`;
            manifest.id += ".p2p";
            manifest.description += " | ⚠️ P2P Mode (IP Visible)";
        }
        else {
            manifest.name = `${appName}${flag} 🌐 Web`;
            manifest.id += ".web";
        }

    } catch (e) {
        console.error("Errore personalizzazione manifest:", e);
    }
    res.json(manifest);
});
app.get("/:conf/catalog/:type/:id/:extra?.json", async (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json({metas:[]}); });
app.get("/vixsynthetic.m3u8", handleVixSynthetic);

app.get("/:conf/stream/:type/:id.json", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
        validateStreamRequest(req.params.type, req.params.id.replace('.json', ''));
        const { conf, type, id } = req.params;
        const cleanId = id.replace(".json", "");
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = `${protocol}://${req.get('host')}`;
        const result = await generateStream(type, cleanId, getConfig(conf), conf, host);
        res.json(result);
    } catch (err) {
        logger.error('Validazione/Stream Fallito', { error: err.message, params: req.params });
        return res.status(400).json({ streams: [] });
    }
});

function getConfig(configStr) {
  try {
    return JSON.parse(Buffer.from(configStr, "base64").toString());
  } catch (err) {
    logger.error(`Errore parsing config: ${err.message}`);
    return {};
  }
}

const PORT = process.env.PORT || 7000;
const PUBLIC_IP = process.env.PUBLIC_IP || "127.0.0.1";
const PUBLIC_PORT = process.env.PUBLIC_PORT || PORT;

app.listen(PORT, () => {
    console.log(`🚀 Leviathan (God Tier) attivo su porta interna ${PORT}`);
    console.log(`-----------------------------------------------------`);
    console.log(`⚡ MODE: FULL LAZY (All items Lazy)`);
    console.log(`🎬 SERIES: Full Lazy Mode (Pack Support Active)`);
    console.log(`📡 INDEXER URL (ENV): ${CONFIG.INDEXER_URL}`);
    console.log(`🎬 METADATA: TMDB Primary (User Key Priority)`);
    console.log(`💾 SCRITTURA: DB Locale (Auto-Learning attivo)`);
    console.log(`🏠 LETTURA: DB Locale Integrato in Search`);
    console.log(`👁️ SPETTRO VISIVO: Modulo Attivo (Esclusioni 4K/1080/720/SD)`);
    console.log(`⚖️ SIZE LIMITER: Modulo Attivo (GB Filter)`);
    console.log(`🦁 GUARDA HD: Modulo Integrato e Pronto`);
    console.log(`🛡️ GUARDA SERIE: Modulo Integrato e Pronto`);
    console.log(`⛩️ ANIMEWORLD: Modulo Integrato e Pronto`); // <--- NUOVO LOG
    console.log(`🕷️ WEBSTREAMR: Fallback Attivo (Su 0 Risultati)`);
    console.log(`🎬 TRAILER: Attivabile da Config (Default: OFF, Primo Risultato se ON)`);
    console.log(`📦 TORBOX: ADVANCED SMART CACHE + ID GRABBER ENABLED`);
    console.log(`📝 PARSER: ENHANCED (Smart Extraction Active)`); 
    console.log(`⚡ P2P: HANDLER ATTIVO (Graphic Skin + Tracker Fix)`);
    console.log(`🦑 LEVIATHAN CORE: Optimized for High Reliability`);
    console.log(`-----------------------------------------------------`);
});
