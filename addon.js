require('dotenv').config();
const express = require("express");
const cors = require("cors");
// const helmet = require("helmet"); // DISABILITATO TEMPORANEAMENTE
const compression = require('compression');
const path = require("path");
const axios = require("axios");
const crypto = require("crypto"); 
const Bottleneck = require("bottleneck");
const rateLimit = require("express-rate-limit");
const winston = require('winston');
const NodeCache = require("node-cache");

// --- IMPORT ESTERNI ---
const { fetchExternalAddonsFlat } = require("./external-addons");
// --- [LEVIATHAN] IMPORT RESOLVER ---
const PackResolver = require("./leviathan-pack-resolver");

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
    getCachedMagnets: async (key) => {
        return myCache.get(`magnets:${key}`) || null;
    },
    cacheMagnets: async (key, value, ttl = 3600) => {
        myCache.set(`magnets:${key}`, value, ttl);
    },
    getCachedStream: async (key) => {
        const data = myCache.get(`stream:${key}`);
        if (data) logger.info(`⚡ CACHE HIT: ${key}`);
        return data || null;
    },
    cacheStream: async (key, value, ttl = 1800) => { 
        myCache.set(`stream:${key}`, value, ttl);
    },
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
const { searchVix } = require("./vix/vix_handler");
const { getManifest } = require("./manifest");

// Inizializza DB Locale
dbHelper.initDatabase();

// --- CONFIGURAZIONE CENTRALE ---
const CONFIG = {
  INDEXER_URL: process.env.INDEXER_URL || "http://185.229.239.195:8080", 
  CINEMETA_URL: "https://v3-cinemeta.strem.io",
  REAL_SIZE_FILTER: 80 * 1024 * 1024,
  MAX_RESULTS: 60, 
  TIMEOUTS: {
    TMDB: 2000,
    SCRAPER: 6000, 
    REMOTE_INDEXER: 2500,
    DB_QUERY: 5000,
    DEBRID: 5000,
    PACK_RESOLVER: 8000, 
    EXTERNAL: 4000 
  }
};

const REGEX_YEAR = /(19|20)\d{2}/;
const REGEX_QUALITY = {
    "4K": /2160p|4k|uhd/i,
    "1080p": /1080p/i,
    "720p": /720p/i,
    "SD": /480p|\bsd\b/i
};
const REGEX_AUDIO = {
    channels: /\b(7\.1|5\.1|2\.1|2\.0)\b/,
    atmos: /atmos/i, 
    dtsx: /dts[:\s-]?x/i,
    truehd: /truehd/i, 
    dtshd: /\bdts-?hd\b|\bma\b/i,
    dts: /\bdts\b/i,
    ddp: /\bddp\b|\beac-?3\b|\bdolby\s?digital\s?plus\b/i, 
    dolby: /\bac-?3\b|\bdd\b|\bdolby\b/i, 
    aac: /\baac\b/i,
    flac: /\bflac\b/i 
};

const REGEX_ITA = [
    /\b(ITA|ITALIAN|ITALY)\b/i,
    /\b(AUDIO|LINGUA)\s*[:\-]?\s*(ITA|IT)\b/i,
    /\b(AC-?3|AAC|DDP?|DTS|PCM|TRUEHD|ATMOS|MP3|WMA|FLAC).*(ITA|IT)\b/i,
    /\b(DD|DDP|AAC|DTS)\s*5\.1\s*(ITA|IT)\b/i,
    /\b(MULTI|DUAL|TRIPLE).*(ITA|IT)\b/i,
    /\b(SUB|SUBS|SOTTOTITOLI).*(ITA|IT)\b/i,
    /\b(H\.?264|H\.?265|X264|X265|HEVC|AVC|DIVX|XVID).*(ITA|IT)\b/i,
    /\b(iDN_CreW|CORSARO|MUX|WMS|TRIDIM|SPEEDVIDEO|EAGLE|TRL|MEA|LUX|DNA|LEST|GHIZZO|USAbit|Bric|Dtone|Gaiage|BlackBit|Pantry|Vics|Papeete)\b/i,
    /\b(STAGIONE|EPISODIO|SERIE COMPLETA|STAGIONE COMPLETA)\b/i
];
const REGEX_CLEANER = /\b(ita|eng|ger|fre|spa|latino|rus|sub|h264|h265|x264|x265|hevc|avc|vc1|1080p|1080i|720p|480p|4k|2160p|uhd|sdr|hdr|hdr10|dv|dolby|vision|bluray|bd|bdrip|brrip|web-?dl|webrip|hdtv|rip|remux|mux|ac-?3|aac|dts|ddp|flac|truehd|atmos|multi|dual|complete|pack|amzn|nf|dsnp|hmax|atvp|apple|hulu|peacock|rakuten|iyp|dvd|dvdrip|unrated|extended|director|cut)\b.*/yi;

const LIMITERS = {
  scraper: new Bottleneck({ maxConcurrent: 40, minTime: 10 }), 
  rd: new Bottleneck({ maxConcurrent: 25, minTime: 40 }), 
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

// --- UTILS & HELPERS ---
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

function deduplicateResults(results) {
  const hashMap = new Map();
  for (const item of results) {
    if (!item?.magnet) continue;
    const hashMatch = item.magnet.match(/btih:([a-f0-9]{40})/i);
    if (!hashMatch) continue;
    
    const hash = hashMatch[1].toUpperCase();
    const uniqueKey = `${hash}:${item.fileIdx !== undefined ? item.fileIdx : 'base'}`;

    if (!hashMap.has(uniqueKey) || (item.seeders || 0) > (hashMap.get(uniqueKey).seeders || 0)) {
      item.hash = hash;
      item._size = parseSize(item.size || item.sizeBytes);
      hashMap.set(uniqueKey, item);
    }
  }
  return Array.from(hashMap.values());
}

function isSafeForItalian(item) {
  if (!item || !item.title) return false;
  return REGEX_ITA.some(p => p.test(item.title));
}

function cleanFilename(filename) {
  if (!filename) return "";
  const yearMatch = filename.match(REGEX_YEAR);
  let cleanTitle = filename;
  let year = "";
  if (yearMatch) {
    year = ` (${yearMatch[0]})`;
    cleanTitle = filename.substring(0, yearMatch.index);
  }
  cleanTitle = cleanTitle.replace(/[._]/g, " ");
  cleanTitle = cleanTitle.replace(REGEX_CLEANER, "");
  return `${cleanTitle.trim()}${year}`;
}

function getEpisodeTag(filename) {
    const f = filename.toLowerCase();
    const matchEp = f.match(/s(\d+)[ex](\d+)/i);
    if (matchEp) return `🍿 S${matchEp[1]}E${matchEp[2]}`;
    const matchX = f.match(/(\d+)x(\d+)/i);
    if (matchX) return `🍿 S${matchX[1].padStart(2, '0')}E${matchX[2].padStart(2, '0')}`;
    const sMatch = f.match(/s(\d+)\b|stagione (\d+)|season (\d+)/i);
    if (sMatch) {
        const num = sMatch[1] || sMatch[2] || sMatch[3];
        return `📦 STAGIONE ${num}`;
    }
    return "";
}

function extractAudioInfo(title) {
    const t = String(title).toLowerCase();
    const channelMatch = t.match(REGEX_AUDIO.channels);
    let channels = channelMatch ? channelMatch[1] : "";
    if (channels === "2.0") channels = ""; 
    let audioTag = "";
    if (REGEX_AUDIO.atmos.test(t)) audioTag = "💣 Atmos";
    else if (REGEX_AUDIO.dtsx.test(t)) audioTag = "💣 DTS:X";
    else if (REGEX_AUDIO.truehd.test(t)) audioTag = "🔊 TrueHD";
    else if (REGEX_AUDIO.dtshd.test(t)) audioTag = "🔊 DTS-HD";
    else if (REGEX_AUDIO.ddp.test(t)) audioTag = "🔊 Dolby+";
    else if (REGEX_AUDIO.dts.test(t)) audioTag = "🔊 DTS";
    else if (REGEX_AUDIO.flac.test(t)) audioTag = "🎼 FLAC";
    else if (REGEX_AUDIO.dolby.test(t)) audioTag = "🔈 Dolby";
    else if (REGEX_AUDIO.aac.test(t)) audioTag = "🔈 AAC";
    else if (/\bmp3\b/i.test(t)) audioTag = "🔈 MP3";
    if (!audioTag && (channels === "5.1" || channels === "7.1")) audioTag = "🔊 Surround";
    if (!audioTag) return "🔈 Stereo";
    return channels ? `${audioTag} ${channels}` : audioTag;
}

function extractStreamInfo(title, source) {
  const t = String(title).toLowerCase();
  let q = "HD"; let qIcon = "📺";
  if (REGEX_QUALITY["4K"].test(t)) { q = "4K"; qIcon = "🔥"; }
  else if (REGEX_QUALITY["1080p"].test(t)) { q = "1080p"; qIcon = "✨"; }
  else if (REGEX_QUALITY["720p"].test(t)) { q = "720p"; qIcon = "🎞️"; }
  else if (REGEX_QUALITY["SD"].test(t)) { q = "SD"; qIcon = "🐢"; }
  const videoTags = [];
  if (/hdr/.test(t)) videoTags.push("HDR");
  if (/dolby|vision|\bdv\b/.test(t)) videoTags.push("DV");
  if (/imax/.test(t)) videoTags.push("IMAX");
  if (/x265|h265|hevc/.test(t)) videoTags.push("HEVC");
  let lang = "🇬🇧 ENG"; 
  if (/corsaro/i.test(source) || isSafeForItalian({ title })) {
      lang = "🇮🇹 ITA";
      if (/multi|mui/i.test(t)) lang = "🇮🇹 MULTI";
  } 
  const audioInfo = extractAudioInfo(title);
  let detailsParts = [];
  if (videoTags.length) detailsParts.push(`🖥️ ${videoTags.join(" ")}`);
  return { quality: q, qIcon, info: detailsParts.join(" | "), lang, audioInfo };
}

function formatStreamTitleCinePro(fileTitle, source, size, seeders, serviceTag = "RD") {
    const { quality, qIcon, info, lang, audioInfo } = extractStreamInfo(fileTitle, source);
    const sizeStr = size ? `🧲 ${formatBytes(size)}` : "🧲 ?";
    const seedersStr = seeders != null ? `👤 ${seeders}` : "";
    let langStr = "🌐 ?";
    if (/ita|it\b|italiano/i.test(lang || "")) langStr = "🗣️ ITA";
    else if (/multi/i.test(lang || "")) langStr = "🗣️ MULTI";
    else if (lang) langStr = `🗣️ ${lang.toUpperCase()}`;
    
    let displaySource = source;
    if (/corsaro/i.test(displaySource)) displaySource = "ilCorSaRoNeRo";
    
    const sourceLine = `⚡ [${serviceTag}] ${displaySource}`;
    const name = `🦑 LEVIATHAN\n${qIcon} ${quality}`; 
    const cleanName = cleanFilename(fileTitle)
        .replace(/(s\d{1,2}e\d{1,2}|\d{1,2}x\d{1,2}|s\d{1,2})/ig, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    const epTag = getEpisodeTag(fileTitle);
    const lines = [];
    lines.push(`🎬 ${cleanName}${epTag ? ` ${epTag}` : ""}`);
    const audioLine = [langStr, audioInfo].filter(Boolean).join(" • ");
    if (audioLine) lines.push(audioLine);
    const cleanInfo = info ? info.replace("🖥️ ", "") : "";
    if (cleanInfo) lines.push(`🎞️ ${cleanInfo}`);
    const techLine = [sizeStr, seedersStr].filter(Boolean).join(" • ");
    if (techLine) lines.push(techLine);
    if (sourceLine) lines.push(sourceLine);
    return { name, title: lines.join("\n") };
}

function formatVixStream(meta, vixData) {
    const isFHD = vixData.isFHD;
    const quality = isFHD ? "1080p" : "720p";
    const qIcon = isFHD ? "🌕" : "🌗";
    const lines = [];
    lines.push(`🎬 ${meta.title}`);
    lines.push(`🇮🇹 ITA • 🔊 AAC`);
    lines.push(`🎞️ HLS • Bitrate Variabile`);
    lines.push(`☁️ Web Stream • ⚡ Instant`);
    lines.push(`🍝 StreamingCommunity`); 
    
    return {
        name: `🌪️ StreamingCommunity\n${qIcon} ${quality}`, 
        title: lines.join("\n"),
        url: vixData.url,
        behaviorHints: { notWebReady: false, bingieGroup: "vix-stream" }
    };
}

function validateStreamRequest(type, id) {
  const validTypes = ['movie', 'series'];
  if (!validTypes.includes(type)) {
    logger.error(`Tipo non valido: ${type}`);
    throw new Error(`Tipo non valido: ${type}`);
  }
  
  const cleanIdToCheck = id.replace('ai-recs:', '');
  const idPattern = /^(tt\d+|\d+|tmdb:\d+|kitsu:\d+)(:\d+)?(:\d+)?$/;
  
  if (!idPattern.test(cleanIdToCheck) && !idPattern.test(id)) {
    logger.error(`Formato ID non valido: ${id}`);
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

async function getMetadata(id, type) {
  try {
    const allowedTypes = ["movie", "series"];
    if (!allowedTypes.includes(type)) return null;
    let tmdbId = id, s = 0, e = 0;
    if (type === "series" && id.includes(":")) [tmdbId, s, e] = id.split(":");
    const rawId = tmdbId.split(":")[0];
    const cleanId = rawId.match(/^(tt\d+|\d+)$/i)?.[0] || "";
    if (!cleanId) return null;
    const { data: cData } = await axios.get(`${CONFIG.CINEMETA_URL}/meta/${type}/${cleanId}.json`, { timeout: CONFIG.TIMEOUTS.TMDB }).catch(() => ({ data: {} }));
    return cData?.meta ? {
      title: cData.meta.name,
      originalTitle: cData.meta.name, 
      year: cData.meta.year?.split("–")[0],
      imdb_id: cleanId, 
      isSeries: type === "series",
      season: parseInt(s),
      episode: parseInt(e)
    } : null;
  } catch (err) { 
    logger.error(`Errore getMetadata: ${err.message}`);
    return null; 
  }
}

// --- FUNZIONE SALVAGENTE PER SERIE TV ---
// Ripristina il comportamento "classico" per le serie se smartMatch è troppo severo
function simpleSeriesFallback(meta, filename) {
    if (!meta.isSeries || !filename) return false;
    
    // 1. Normalizza
    const cleanMeta = meta.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanFile = filename.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    // 2. Il titolo deve esserci (anche parziale)
    if (!cleanFile.includes(cleanMeta)) return false;

    // 3. Regex standard SxxExx (molto robusta)
    // Cerca S05E01, 5x01, Season 5 Episode 1, etc.
    const s = meta.season;
    const e = meta.episode;
    
    // Regex dinamica per S{s}E{e}
    // Copre: S05E05, S5E5, 5x5, 05x05
    const re = new RegExp(`(?:s|season|^|\\b|x)0?${s}(?:[ ._x-]*)(?:e|episode|x)?0?${e}(?!\\d)`, 'i');
    
    return re.test(filename);
}

// --- [LEVIATHAN] UPDATED RESOLVE DEBRID LINK ---
async function resolveDebridLink(config, item, showFake, reqHost, meta = null, dbHelper = null) {
    try {
        const service = config.service || 'rd';
        const apiKey = config.key || config.rd;
        if (!apiKey) return null;

        // --- PROTEZIONE FILM ---
        // Se non è esplicitamente una serie, saltiamo TUTTA la logica dei pack.
        const isSeries = meta && meta.isSeries;

        if (isSeries && PackResolver.isSeasonPack(item.title) && item.fileIdx === undefined) {
             try {
                const resolverConfig = { 
                    rd_key: service === 'rd' ? apiKey : null,
                    torbox_key: service === 'tb' ? apiKey : null 
                };
                
                const resolved = await withTimeout(
                    PackResolver.resolveSeriesPackFile(
                        item.hash, 
                        resolverConfig, 
                        meta.imdb_id, 
                        meta.season, 
                        meta.episode, 
                        dbHelper
                    ), 
                    CONFIG.TIMEOUTS.PACK_RESOLVER,
                    'Pack Resolution'
                );

                if (resolved) {
                    item.fileIdx = resolved.fileIndex;
                    item.title = resolved.fileName;
                    item._size = resolved.fileSize;
                    item.source += " [PACK]";
                }
             } catch (err) {
                 logger.warn(`Pack Resolver skipped/failed: ${err.message}`);
             }
        }

        // 2. TorBox Handling
        if (service === 'tb') {
            if (item._tbCached) {
                const serviceTag = "TB";
                const { name, title } = formatStreamTitleCinePro(item.title, item.source, item._size, item.seeders, serviceTag);
                const proxyUrl = `${reqHost}/${config.rawConf}/play_tb/${item.hash}?s=${item.season || 0}&e=${item.episode || 0}`;
                return { name, title, url: proxyUrl, behaviorHints: { notWebReady: false, bingieGroup: `corsaro-tb` } };
            } else { return null; }
        }

        // 3. Real Debrid / All Debrid Generation
        let streamData = null;
        if (service === 'rd') streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode, item.fileIdx);
        else if (service === 'ad') streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode, item.fileIdx);

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) return null;

        const serviceTag = service.toUpperCase();
        const { name, title } = formatStreamTitleCinePro(streamData.filename || item.title, item.source, streamData.size || item.size, item.seeders, serviceTag);
        return { name, title, url: streamData.url, behaviorHints: { notWebReady: false, bingieGroup: `corsaro-${service}` } };
    } catch (e) {
        logger.error(`Errore resolveDebridLink: ${e.message}`);
        if (showFake) return { name: `[P2P ⚠️]`, title: `${item.title}\n⚠️ Cache Assente`, url: item.magnet, behaviorHints: { notWebReady: true } };
        return null;
    }
}

async function queryRemoteIndexer(tmdbId, type, season = null, episode = null) {
    if (!CONFIG.INDEXER_URL) return [];
    try {
        logger.info(`🌐 [REMOTE] Query VPS A: ${tmdbId} S:${season} E:${episode}`);
        let url = `${CONFIG.INDEXER_URL}/api/get/${tmdbId}`;
        if (season) url += `?season=${season}`;
        if (episode) url += `&episode=${episode}`;
        const { data } = await axios.get(url, { timeout: CONFIG.TIMEOUTS.REMOTE_INDEXER });
        if (!data || !data.torrents || !Array.isArray(data.torrents)) return [];
        return data.torrents.map(t => {
            let magnet = t.magnet || `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.title)}`;
            if(!magnet.includes("tr=")) {
               magnet += "&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce";
            }
            let providerName = t.provider || 'P2P';
            providerName = providerName.replace(/LeviathanDB/i, '').replace(/[()]/g, '').trim();
            if(!providerName) providerName = 'P2P';
            return {
                title: t.title,
                magnet: magnet,
                size: "💾 DB", 
                sizeBytes: parseInt(t.size),
                seeders: t.seeders,
                source: providerName,
                fileIdx: t.file_index !== undefined ? parseInt(t.file_index) : undefined 
            };
        });
    } catch (e) {
        logger.error("Err Remote Indexer:", { error: e.message });
        return [];
    }
}

// --- FUNZIONE DI SUPPORTO: External Addons ---
async function fetchExternalResults(type, finalId) {
    logger.info(`🌐 [EXTERNAL] Start Parallel Fetch...`);
    try {
        const externalResults = await withTimeout(
            fetchExternalAddonsFlat(type, finalId).then(items => {
                return items.map(i => ({
                    title: i.title || i.filename,
                    magnet: i.magnetLink,
                    size: i.size,         
                    sizeBytes: i.mainFileSize, 
                    seeders: i.seeders,
                    // Source pulita, niente [EXT]
                    source: i.externalProvider || i.source.replace(/\[EXT\]\s*/, ''), 
                    hash: i.infoHash,
                    fileIdx: i.fileIdx, 
                    isExternal: true 
                }));
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

// --- GENERATE STREAM CON LOGICA PARALLELA + FALLBACK SCRAPER ---
async function generateStream(type, id, config, userConfStr, reqHost) {
  if (!config.key && !config.rd) return { streams: [{ name: "⚠️ CONFIG", title: "Inserisci API Key nel configuratore" }] };
  
  const configHash = crypto.createHash('md5').update(userConfStr || 'no-conf').digest('hex');
  const cacheKey = `${type}:${id}:${configHash}`;
  
  const cachedResult = await Cache.getCachedStream(cacheKey);
  if (cachedResult) {
      return cachedResult; 
  }

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

  const meta = await getMetadata(finalId, type); 
  if (!meta) return { streams: [] };

  logger.info(`🚀 [SPEED] Start TOTAL PARALLEL search: ${meta.title}`);
  const tmdbIdLookup = meta.tmdb_id || (await imdbToTmdb(meta.imdb_id, userTmdbKey))?.tmdbId;

  // --- DEFINIZIONE PROMISE PARALLELE ---
  
  // 1. Indexer Remoto
  const remotePromise = withTimeout(
      queryRemoteIndexer(tmdbIdLookup, type, meta.season, meta.episode),
      CONFIG.TIMEOUTS.REMOTE_INDEXER,
      'Remote Indexer'
  ).catch(err => {
      logger.warn('Remote indexer fallito/timeout', { error: err.message });
      return [];
  });

  // 2. DB Locale
  const dbPromise = withTimeout(
      type === 'movie' 
          ? dbHelper.searchMovie(meta.imdb_id)
          : dbHelper.searchSeries(meta.imdb_id, meta.season, meta.episode),
      CONFIG.TIMEOUTS.DB_QUERY,
      'DB Locale'
  ).catch(err => {
      logger.warn('DB locale fallito/timeout', { error: err.message });
      return [];
  });

  // 3. External Addons (IN PARALLELO, NON CONTA COME SCRAPER)
  const externalPromise = fetchExternalResults(type, finalId);

  // --- ESECUZIONE PARALLELA ---
  const [remoteResults, dbResultsRaw, externalResults] = await Promise.all([
      remotePromise, 
      dbPromise, 
      externalPromise
  ]);

  let dbResults = dbResultsRaw || [];
  
  if (remoteResults.length > 0) logger.info(`✅ [REMOTE] ${remoteResults.length} items`);
  if (dbResults.length > 0) logger.info(`✅ [LOCAL DB] ${dbResults.length} items`);

  // Unione risultati iniziali
  if (dbResults.length > 6) dbResults = dbResults.slice(0, 10);
  let currentResults = [...remoteResults, ...dbResults, ...externalResults];

  // --- LOGICA SCRAPER (Fallback SOLO se < 3 risultati) ---
  let scrapedResults = [];
  if (currentResults.length < 3) { 
      logger.info(`⚠️ Low TOTAL results (${currentResults.length} < 3), triggering SCRAPING (Engines)...`);
      let dynamicTitles = [];
      try {
          if (tmdbIdLookup) dynamicTitles = await getTmdbAltTitles(tmdbIdLookup, type, userTmdbKey);
      } catch (e) {}
      const allowEng = config.filters?.allowEng === true; 
      const queries = generateSmartQueries(meta, dynamicTitles, allowEng);
      
      let promises = [];
      queries.forEach(q => { 
          SCRAPER_MODULES.forEach(scraper => { 
              if (scraper.searchMagnet) { 
                  const searchOptions = { allowEng };
                  promises.push(
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
      scrapedResults = (await Promise.all(promises)).flat();
  } else {
      logger.info(`⚡ SKIP SCRAPER: Have ${currentResults.length} valid results (>= 3).`);
  }

  let resultsRaw = [...currentResults, ...scrapedResults];
  resultsRaw = resultsRaw.filter(item => {
    if (!item?.magnet) return false;
    // --- BYPASS SMARTMATCH PER EXTERNAL ---
    if (item.isExternal) return true; 

    // --- [LEVIATHAN FIX] FILTRO ANNO SOLO PER FILM ---
    // Non filtriamo l'anno per le serie TV per evitare di perdere stagioni recenti.
    if (!meta.isSeries) {
        const fileYearMatch = item.title.match(REGEX_YEAR);
        if (fileYearMatch && Math.abs(parseInt(fileYearMatch[0]) - parseInt(meta.year)) > 1) return false;
    }

    // --- [LEVIATHAN FIX] LOGICA IBRIDA ---
    // 1. Prova il controllo severo (ottimo per film e serie "pulite")
    if (smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode)) return true;

    // 2. Se fallisce ed è una serie, prova il SALVAGENTE (Fix Lucifer)
    // Accetta se c'è il titolo + SxxExx corretto, ignorando altre paranoie.
    if (meta.isSeries && simpleSeriesFallback(meta, item.title)) {
        return true; 
    }

    return false;
  });

  let cleanResults = deduplicateResults(resultsRaw);
  const ranked = rankAndFilterResults(cleanResults, meta, config).slice(0, CONFIG.MAX_RESULTS);

  if (config.service === 'tb' && ranked.length > 0) {
      const hashes = ranked.map(r => r.hash);
      const cachedHashes = await TB.checkCached(config.key || config.rd, hashes);
      const cachedSet = new Set(cachedHashes.map(h => h.toUpperCase()));
      ranked.forEach(item => { if (cachedSet.has(item.hash.toUpperCase())) item._tbCached = true; });
  }

  let debridStreams = [];
  if (ranked.length > 0) {
      const rdPromises = ranked.map(item => {
          item.season = meta.season;
          item.episode = meta.episode;
          config.rawConf = userConfStr; 
          // --- [LEVIATHAN] PASS META & DB HELPER ---
          return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake, reqHost, meta, dbHelper));
      });
      debridStreams = (await Promise.all(rdPromises)).filter(Boolean);
  }

  const vixPromise = searchVix(meta, config);
  const rawVix = await vixPromise; 
  const formattedVix = rawVix.map(v => formatVixStream(meta, v));
  
  const finalStreams = [...formattedVix, ...debridStreams];
  
  const resultObj = { streams: finalStreams.length > 0 ? finalStreams : [{ name: "⛔", title: "Nessun risultato trovato" }] };

  if (finalStreams.length > 0) {
      await Cache.cacheStream(cacheKey, resultObj, 1800);
      logger.info(`💾 SAVED TO CACHE: ${cacheKey}`);
  }

  return resultObj; 
}

// --- ROTTE DI CORTESIA (FIX 404) ---
app.get("/api/stats", (req, res) => res.json({ status: "ok" }));
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/:conf/play_tb/:hash", async (req, res) => {
    const { conf, hash } = req.params;
    const { s, e } = req.query;
    logger.info(`▶️ [TorBox Play] Hash: ${hash} S${s}E${e}`);
    try {
        const config = getConfig(conf);
        if (!config.key && !config.rd) throw new Error("API Key Mancante");
        const magnet = `magnet:?xt=urn:btih:${hash}`;
        const apiKey = config.key || config.rd;
        const streamData = await TB.getStreamLink(apiKey, magnet, s, e, hash);
        if (streamData && streamData.url) {
             res.redirect(streamData.url);
        } else {
             res.status(404).send("Errore TorBox: Limite raggiunto o File non trovato.");
        }
    } catch (err) {
        logger.error(`Error Torbox Play: ${err.message}`);
        res.status(500).send("Errore Server: " + err.message);
    }
});

// --- ADMIN API ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const validPass = process.env.ADMIN_PASS || "GodTierAccess2024"; 
    if (authHeader === validPass) next();
    else {
      logger.warn(`Tentativo accesso admin fallito da IP: ${req.ip}`);
      res.status(403).json({ error: "Password errata" });
    }
};
app.get("/admin/keys", authMiddleware, async (req, res) => { res.json(await Cache.listKeys()); }); 
app.delete("/admin/key", authMiddleware, async (req, res) => { 
  const { key } = req.query;
  if (key) {
    await Cache.deleteKey(key);
    res.json({ success: true });
  } else res.json({ error: "Key mancante" });
});
app.post("/admin/flush", authMiddleware, async (req, res) => { 
  await Cache.flushAll();
  res.json({ success: true }); 
});

// --- HEALTHCHECK ---
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

// --- MAIN ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/:conf/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/manifest.json", (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json(getManifest()); });
app.get("/:conf/manifest.json", (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json(getManifest()); });
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
    console.log(`⚡ MODALITÀ CACHE: Node-Cache (Safe & Fast). TTL 30min.`);
    console.log(`⚡ SPEED LOGIC: TOTALE PARALLELO (DB + Remote + External).`);
    console.log(`🧠 SMART FILTER: Ibrido (Paranoid + Salvagente Serie TV).`);
    console.log(`🦑 PACK RESOLVER: Attivo (FILM SAFE MODE ON).`);
    console.log(`🌍 Addon accessibile su: http://${PUBLIC_IP}:${PUBLIC_PORT}/manifest.json`);
    console.log(`📡 Connesso a Indexer DB: ${CONFIG.INDEXER_URL}`);
    console.log(`🔗 EXTERNAL ADDONS: Integrati (Parallel). SCRAPER (Fallback < 3)`);
    console.log(`-----------------------------------------------------`);
});
