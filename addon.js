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

// --- IMPORT ESTERNI ---
const { fetchExternalAddonsFlat } = require("./external-addons");
const PackResolver = require("./leviathan-pack-resolver");
const aioFormatter = require("./aiostreams-formatter.cjs");
// [NUOVO] Import Gestore Fallback
const { searchWebStreamr } = require("./webstreamr_handler");

// --- IMPORT GESTORI WEB (Vix, GuardaHD & GuardaSerie) ---
const { searchVix } = require("./vix/vix_handler");
const { searchGuardaHD } = require("./guardahd/ghd_handler"); 
const { searchGuardaserie } = require("./guardaserie/gs_handler"); 

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
    DB_QUERY: 3000,
    DEBRID: 10000, 
    PACK_RESOLVER: 7000,
    EXTERNAL: 5000 
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
    /\b(STAGIONE|EPISODIO|SERIE COMPLETA|STAGIONE COMPLETA)\b/i,
    /\b(il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle|nel|nello|nella|nei|negli|nelle)\s+/i,
    /\b(tutto|niente|sempre|mai|ancora|già|ora|dove|come|quando|perché|chi|cosa|vita|morte|amore|cuore|mondo|tempo|uomo|donna|bambino|polizia|poliziotto|commissario|squadra|omicidio|indagine|prova)\b/i
];

// [FIX] Spostato 'rip' più avanti per evitare cancellazioni aggressive su titoli come "RIP"
const REGEX_CLEANER = /\b(ita|eng|ger|fre|spa|latino|rus|sub|h264|h265|x264|x265|hevc|avc|vc1|1080p|1080i|720p|480p|4k|2160p|uhd|sdr|hdr|hdr10|dv|dolby|vision|bluray|bd|bdrip|brrip|web-?dl|webrip|hdtv|remux|mux|ac-?3|aac|dts|ddp|flac|truehd|atmos|multi|dual|complete|pack|amzn|nf|dsnp|hmax|atvp|apple|hulu|peacock|rakuten|iyp|dvd|dvdrip|unrated|extended|director|cut|rip)\b.*/yi;

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
    const rawHash = item.infoHash || item.hash || extractInfoHash(item.magnet);
    const finalHash = rawHash ? rawHash.toUpperCase() : null;
    if (!finalHash || finalHash.length !== 40) continue;
    item.hash = finalHash;
    item.infoHash = finalHash;
    const existing = hashMap.get(finalHash);
    if (!existing || (item.seeders || 0) > (existing.seeders || 0)) {
      item._size = parseSize(item.sizeBytes || item.size);
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
        
        if (REGEX_QUALITY["4K"].test(t)) q = "4K";
        else if (REGEX_QUALITY["1080p"].test(t)) q = "1080p";
        else if (REGEX_QUALITY["720p"].test(t)) q = "720p";

        if (counts[q] < limitNum) {
            filtered.push(item);
            counts[q]++;
        }
    }
    return filtered;
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
  cleanTitle = cleanTitle.replace(/[\(\[\-\s]+$/, ""); 
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
  if (/corsaro|knaben/i.test(source) || isSafeForItalian({ title })) {
      lang = "🇮🇹 ITA";
      if (/multi|mui/i.test(t)) lang = "🇮🇹 MULTI";
  }
  
  const audioInfo = extractAudioInfo(title);
  let detailsParts = [];
  if (videoTags.length) detailsParts.push(`🖥️ ${videoTags.join(" ")}`);
  
  // Ritorno 'rawVideoTags' per la logica di Binge Grouping
  return { quality: q, qIcon, info: detailsParts.join(" | "), lang, audioInfo, rawVideoTags: videoTags };
}

function formatStreamTitleCinePro(fileTitle, source, size, seeders, serviceTag = "RD", config = {}, infoHash = null, isLazy = false) {
    const { quality, qIcon, info, lang, audioInfo, rawVideoTags } = extractStreamInfo(fileTitle, source);
    const cleanNameTitle = cleanFilename(fileTitle);

    let sizeString = size ? formatBytes(size) : "";
    if (!sizeString || size === 0) {
        let hash = 0;
        for (let i = 0; i < fileTitle.length; i++) {
            hash = fileTitle.charCodeAt(i) + ((hash << 5) - hash);
        }
        const seed = Math.abs(hash);
        const tLower = fileTitle.toLowerCase();
        let gb = 0;
        if (REGEX_QUALITY["4K"].test(tLower)) gb = 12 + (seed % 1000) / 100;
        else if (REGEX_QUALITY["1080p"].test(tLower)) gb = 1.8 + (seed % 270) / 100;
        else if (REGEX_QUALITY["720p"].test(tLower)) gb = 0.6 + (seed % 80) / 100;
        else gb = 1 + (seed % 200) / 100;
        sizeString = `${gb.toFixed(2)} GB`;
    }

    // --- BINGE GROUPING INTELLIGENTE ---
    // Uniamo Qualità + Tech Specs (HDR, DV, etc) + Service Provider
    // Esempio: "Leviathan|4K|HDR|RD"
    // Questo dice a Stremio: "Per il prossimo episodio, cerca un flusso che sia 4K, HDR e su RD"
    const techClean = rawVideoTags ? rawVideoTags.join("") : "";
    const bingeGroup = `Leviathan|${quality}|${techClean}|${serviceTag}`;

    if (aioFormatter && aioFormatter.isAIOStreamsEnabled(config)) {
        let fullService = 'p2p';
        if (serviceTag === 'RD') fullService = 'realdebrid';
        if (serviceTag === 'AD') fullService = 'alldebrid';
        if (serviceTag === 'TB') fullService = 'torbox';
        
        let displaySource = source;
        if (/corsaro/i.test(source)) {
            displaySource = "ilCorSaRoNeRo";
        } else if (/knaben/i.test(source)) {
            displaySource = "Knaben";
        } else if (/comet/i.test(source)) {
            displaySource = "StremThru";
        } else {
             displaySource = source
                .replace(/MediaFusion/gi, '') 
                .replace(/Torrentio/gi, '')   
                .replace(/TorrentGalaxy|tgx/i, 'TGx')
                .replace(/\b1337\b/i, '1337x')
                .replace(/Fallback/ig, '') 
                .trim();
        }

        const uniqueLine = [quality, sizeString, displaySource].filter(Boolean).join(" • ");
        const name = aioFormatter.formatStreamName({
            addonName: "Leviathan",
            service: fullService,
            cached: true,
            quality: uniqueLine
        });
        const title = aioFormatter.formatStreamTitle({
            title: fileTitle,       
            infoHash: infoHash,     
            size: sizeString || "Unknown",
            language: lang,
            source: displaySource,
            seeders: seeders,
            isPack: false,
            episodeTitle: getEpisodeTag(fileTitle)
        });
        return { name, title, bingeGroup };
    }

    const sizeStr = `🧲 ${sizeString}`;
    const seedersStr = seeders != null ? `👤 ${seeders}` : "";

    let langStr = "🌐 ?";
    if (/multi/i.test(lang || "")) langStr = "🌐 MULTI"; 
    else if (/ita|it\b|italiano/i.test(lang || "")) langStr = "🇮🇹 ITA";
    else if (/eng|en\b|english/i.test(lang || "")) langStr = "🇬🇧 ENG";
    else if (lang) langStr = `🗣️ ${lang.toUpperCase()}`;
    
    let displaySource = source || "P2P";

    if (/1337/i.test(displaySource)) {
        displaySource = "1337x"; 
    } 
    else if (/corsaro/i.test(displaySource)) {
        displaySource = "ilCorSaRoNeRo";
    } 
    else if (/knaben/i.test(displaySource)) {
        displaySource = "Knaben";
    } 
    else if (/comet|stremthru/i.test(displaySource)) {
        displaySource = "StremThru";
    } 
    else if (/rarbg/i.test(displaySource)) {
        displaySource = "RARBG";
    }
    else if (/rd cache/i.test(displaySource)) {
        const groupMatch = fileTitle.match(/[-_]\s*([a-zA-Z0-9]+)(?:\.[a-z0-9]{2,4})?$/i);
        if (groupMatch && groupMatch[1] && groupMatch[1].length < 15 && !/mkv|mp4|avi/i.test(groupMatch[1])) {
            displaySource = groupMatch[1]; 
        } else {
            displaySource = "Cloud"; 
        }
    }
    else {
        displaySource = displaySource
            .replace(/MediaFusion/gi, '') 
            .replace(/[-_]/g, ' ')        
            .replace(/Torrentio/gi, '') 
            .replace(/TorrentGalaxy|tgx/i, 'TGx')
            .replace(/Fallback/ig, '')
            .trim() || "P2P";
    }
    
    // --- FAKE CACHE / LAZY CLEAN ---
    // Rimossa la logica del dado 🎲. Anche se Lazy, mostriamo tag pulito.
    const finalServiceTag = serviceTag;
    
    const sourceLine = `⚡ [${finalServiceTag}] ${displaySource}`;
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
    return { name, title: lines.join("\n"), bingeGroup };
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
    
    // Binge Group Web Unificato
    const bingeGroup = `Leviathan|${quality}|Web|SC`;

    return {
        name: `🌪️ StreamingCommunity\n${qIcon} ${quality}`,
        title: lines.join("\n"),
        url: vixData.url,
        behaviorHints: { notWebReady: false, bingieGroup: bingeGroup }
    };
}

async function filterTorBoxCached(apiKey, items) {
    if (!items || items.length === 0) return [];
    
    const uniqueHashes = [...new Set(items.map(i => i.hash).filter(Boolean))];
    if (uniqueHashes.length === 0) return [];

    const checkChunk = async (hashes) => {
        try {
            const url = "https://api.torbox.app/v1/api/torrents/checkcached";
            
            const { data: response } = await axios.get(url, {
                params: { 
                    hash: hashes.join(','), 
                    format: 'object', 
                    list_files: false 
                },
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 6000 
            });

            if (!response || !response.success || !response.data) {
                return []; 
            }
            
            const confirmed = [];
            const data = response.data;
            
            if (Array.isArray(data)) {
                data.forEach(entry => {
                    if (typeof entry === 'string') confirmed.push(entry.toLowerCase());
                    else if (entry.hash) confirmed.push(entry.hash.toLowerCase());
                });
            } else {
                Object.keys(data).forEach(h => confirmed.push(h.toLowerCase()));
            }
            
            return confirmed;
        } catch (e) {
            logger.warn(`⚠️ [TB CHUNK FAIL] Errore API: ${e.message}`);
            return []; 
        }
    };

    const chunkSize = 40;
    const chunks = [];
    for (let i = 0; i < uniqueHashes.length; i += chunkSize) {
        chunks.push(uniqueHashes.slice(i, i + chunkSize));
    }

    logger.info(`🔍 [TB CHECK] Verifico ${uniqueHashes.length} hash in ${chunks.length} richieste...`);
    const results = await Promise.all(chunks.map(chunk => checkChunk(chunk)));
    const confirmedHashes = new Set(results.flat());

    const cachedItems = items.filter(item => {
        const isCached = item.hash && confirmedHashes.has(item.hash.toLowerCase());
        // [FIX TB] Se confermato in cache, settiamo il flag per resolveDebridLink
        if (isCached) item._tbCached = true;
        return isCached;
    });

    logger.info(`✅ [TB CHECK] Risultato: ${items.length} totali -> ${cachedItems.length} confermati in cache.`);
    return cachedItems;
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
                    originalTitle: originalTitle, // Cruciale per "The Rip - Soldi Sporchi" vs "The Rip"
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

async function resolveDebridLink(config, item, showFake, reqHost) {
    // FUNZIONE DISABILITATA IN FULL LAZY MODE
    // Lasciata qui per compatibilità se si volesse ripristinare in futuro
    return null;
}

function generateLazyStream(item, config, meta, reqHost, userConfStr, isLazy = false) {
    const service = config.service || 'rd';
    const serviceTag = service.toUpperCase();
    
    // --- FULL LAZY: Nessun dado, sembrano tutti cached ---
    const { name, title, bingeGroup } = formatStreamTitleCinePro(
        item.title,
        item.source,
        item._size || item.sizeBytes || 0,
        item.seeders,
        serviceTag,
        config,
        item.hash,
        isLazy // Passiamo il flag
    );

    const fileIdxParam = item.fileIdx !== undefined ? item.fileIdx : -1;
    const lazyUrl = `${reqHost}/${userConfStr}/play_lazy/${service}/${item.hash}/${fileIdxParam}?s=${meta.season || 0}&e=${meta.episode || 0}`;

    return {
        name,
        title,
        url: lazyUrl,
        infoHash: item.hash,
        behaviorHints: { notWebReady: false, bingieGroup: bingeGroup }
    };
}

async function queryRemoteIndexer(tmdbId, type, season = null, episode = null) {
    if (!CONFIG.INDEXER_URL) return [];
    try {
        logger.info(`🌐 [REMOTE] Query VPS: ${CONFIG.INDEXER_URL} | ID: ${tmdbId} S:${season} E:${episode}`);
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
                hash: t.info_hash ? t.info_hash.toUpperCase() : null,
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

// [NUOVO] Funzione per leggere dal DB Locale
async function queryLocalDb(imdbId, type) {
    try {
        // Tenta di recuperare i torrent dal DB locale
        // Assumiamo che dbHelper abbia un metodo getTorrents (standard)
        // Se non trova nulla, ritorna array vuoto
        if (!dbHelper.getTorrents) return [];
        
        const rows = await dbHelper.getTorrents(imdbId);
        if(!rows || !Array.isArray(rows)) return [];

        logger.info(`💾 [LOCAL DB] Trovati ${rows.length} risultati per ${imdbId}`);
        
        return rows.map(t => {
            let magnet = t.magnet || `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.title)}`;
            return {
                title: t.title,
                magnet: magnet,
                hash: t.info_hash ? t.info_hash.toUpperCase() : null,
                size: "💾 DB",
                sizeBytes: parseInt(t.size),
                seeders: t.seeders,
                source: `💾 ${t.provider || 'Local'}`, // Mostra che viene dal DB locale
                fileIdx: t.file_index
            };
        });
    } catch (e) {
        logger.warn(`⚠️ Errore lettura DB Locale: ${e.message}`);
        return [];
    }
}

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

// --- GENERATE STREAM ---
async function generateStream(type, id, config, userConfStr, reqHost) {
  const hasDebridKey = (config.key && config.key.length > 0) || (config.rd && config.rd.length > 0);
  const isWebEnabled = config.filters && (config.filters.enableVix || config.filters.enableGhd || config.filters.enableGs);

  if (!hasDebridKey && !isWebEnabled) {
      return { streams: [{ name: "⚠️ CONFIG", title: "Inserisci API Key o Attiva SC/GuardaHD/GuardaSerie" }] };
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

  // --- FILTRO AGGRESSIVO CON FIX PER "RIP" E TITOLI COMPOSTI ---
  const aggressiveFilter = (item) => {
      if (!item?.magnet) return false;
      if (item.isExternal) return true;

      const source = (item.source || "").toLowerCase();
      // Permetti risultati dal DB Locale
      if (source.includes("local") || source.includes("db")) return true;

      if (source.includes("comet") || source.includes("stremthru")) return false;

      const isItalian = isSafeForItalian(item) || /corsaro/i.test(item.source);
      if (!config.filters?.allowEng && !isItalian) return false;

      const t = item.title.toLowerCase();
      const metaYear = parseInt(meta.year);

      // --- FIX FRANKENSTEIN ---
      if (metaYear === 2025 && /frankenstein/i.test(meta.title)) {
           if (!item.title.includes("2025")) return false;
      }

      // --- LOGICA SERIE TV ---
      if (meta.isSeries) {
          const s = meta.season;
          const e = meta.episode;
          const wrongSeasonRegex = /(?:s|stagione|season)\s*0?(\d+)(?!\d)/gi;
          let match;
          while ((match = wrongSeasonRegex.exec(t)) !== null) {
              const foundSeason = parseInt(match[1]);
              if (foundSeason !== s) return false; 
          }
          const hasRightSeason = new RegExp(`(?:s|stagione|season|^)\\s*0?${s}(?!\\d)`, 'i').test(t);
          const hasRightEpisode = new RegExp(`(?:e|x|ep|episode|^)\\s*0?${e}(?!\\d)`, 'i').test(t);
          const isPack = /(?:complete|pack|stagione\s*\d+\s*$|season\s*\d+\s*$)/i.test(t) && !/e\d+|x\d+/i.test(t);

          if (hasRightSeason && hasRightEpisode) return true;
          if (hasRightSeason && isPack) return true;
          return false;
      }

      // --- LOGICA FILM (POTENZIATA PER "RIP") ---
      // 1337x
      if (source.includes("1337")) {
          const hasIta = /\b(ita|italian)\b/i.test(item.title);
          const isSubbed = /\b(sub|subs|subbed|vost|vostit)\b/i.test(item.title);
          if (!hasIta || isSubbed) return false; 
      }
      // TGX/YTS
      if (source.includes("tgx") || source.includes("torrentgalaxy") || source.includes("yts")) {
          const hasStrictIta = /\b(ita|italian)\b/i.test(item.title);
          if (!hasStrictIta) return false; 
      }

      // Check Anno
      if (!isNaN(metaYear)) {
           const fileYearMatch = item.title.match(REGEX_YEAR);
           if (fileYearMatch) {
               const fileYear = parseInt(fileYearMatch[0]);
               if (Math.abs(fileYear - metaYear) > 1) return false; 
           }
      }

      // --- FIX MATCH TITOLO (Gestione "The Rip - Soldi Sporchi") ---
      
      // 1. Pulizia Standard
      const cleanFile = item.title.toLowerCase().replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();
      const cleanMeta = meta.title.toLowerCase().replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();
      
      // 2. Pulizia "Smart": Rimuove sottotitoli italiani dopo "-" o ":"
      // Es. "The Rip - Soldi Sporchi" diventa "The Rip"
      const metaTitleShort = meta.title.split(/ - |: /)[0].toLowerCase().trim();
      
      // 3. Original Title (da TMDB): Es. "RIP"
      const metaOriginal = (meta.originalTitle || "").toLowerCase().trim();

    const checkMatch = (strToCheck) => {
          if (!strToCheck) return false;

          // 1. Rimuoviamo subito gli articoli per analizzare la "keyword" reale
          let searchKeyword = strToCheck.replace(/^(the|a|an|il|lo|la|i|gli|le)\s+/i, "").trim();

          // 2. FIX SPECIFICO PER "RIP" (Applicato alla keyword pulita)
          // Il problema è che "Rip" è ovunque (WEBRip, BDRip, o "1080p Rip").
          // Se cerchiamo il film "The Rip", imponiamo che il file DEBBA INIZIARE con il titolo.
          if (searchKeyword === "rip") {
               // Regex: L'inizio della stringa (^) deve essere opzionalmente "the " o "il ", seguito da "rip"
               // seguito da un fine parola (\b). Questo esclude "The Strangers... Rip".
               // cleanFile ha già subito la sostituzione di punti/underscore con spazi.
               const strictStartRegex = /^(the\s+|il\s+)?rip\b/i;
               
               // Se il file inizia con "The Rip" o "Rip", è il nostro film.
               if (strictStartRegex.test(cleanFile)) return true;

               // Caso speciale: Se il titolo contiene anche "Soldi Sporchi" (il sottotitolo),
               // la logica precedente (checkMatch cleanMeta) l'avrebbe già preso. 
               // Se siamo qui, stiamo valutando solo la keyword "Rip", quindi scartiamo tutto il resto.
               return false;
          }

          // 3. Se la stringa è molto corta (es "IO", "NO"), usiamo Word Boundary per evitare match parziali
          if (searchKeyword.length <= 3) {
              const regexShort = new RegExp(`\\b${searchKeyword}\\b`, 'i');
              return regexShort.test(cleanFile);
          }
          
          // 4. Match standard (inclusione)
          return cleanFile.includes(searchKeyword);
      };

      // Controllo Gerarchico
      if (checkMatch(cleanMeta)) return true;       // Match intero ("The Rip - Soldi Sporchi")
      if (checkMatch(metaTitleShort)) return true;  // Match parziale ("The Rip")
      if (checkMatch(metaOriginal)) return true;    // Match originale ("RIP")

      if (smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode)) return true;

      return false;
  };

  // --- FASE 1: FONTI VELOCI (VPS + LOCAL DB + EXTERNAL) ---
  const remotePromise = withTimeout(
      queryRemoteIndexer(tmdbIdLookup, type, meta.season, meta.episode),
      CONFIG.TIMEOUTS.REMOTE_INDEXER,
      'Remote Indexer'
  ).catch(err => {
      logger.warn('Remote indexer fallito/timeout', { error: err.message });
      return [];
  });

  // [NUOVO] Query al DB Locale
  const localDbPromise = withTimeout(
      queryLocalDb(meta.imdb_id, type),
      CONFIG.TIMEOUTS.DB_QUERY,
      'Local DB'
  ).catch(err => {
      logger.warn('Local DB query failed', { error: err.message });
      return [];
  });

  let externalPromise = Promise.resolve([]);
  if (!dbOnlyMode) {
      externalPromise = fetchExternalResults(type, finalId);
  }

  // Eseguiamo tutte e 3 le chiamate in parallelo
  const [remoteResults, localResults, externalResults] = await Promise.all([remotePromise, localDbPromise, externalPromise]);
  
  // Uniamo i risultati: Remote + Local + External
  let fastResults = [...remoteResults, ...localResults, ...externalResults].filter(aggressiveFilter);
  let cleanResults = deduplicateResults(fastResults);
  const validFastCount = cleanResults.length;

  logger.info(`⚡ [FAST CHECK] Trovati ${validFastCount} risultati validi da fonti veloci (VPS+DB+Ext).`);

  // --- FASE 2: SCRAPER ---
  if (!dbOnlyMode && validFastCount < 3) {
      logger.info(`⚠️ [HEAVY] Meno di 3 risultati (${validFastCount}). Attivazione Scraper Locali...`);
      
      let dynamicTitles = [];
      try {
          if (tmdbIdLookup) dynamicTitles = await getTmdbAltTitles(tmdbIdLookup, type, userTmdbKey);
      } catch (e) {}

      const allowEng = config.filters?.allowEng === true;
      const queries = generateSmartQueries(meta, dynamicTitles, allowEng);
      
      let scrapedResults = [];
      if (queries.length > 0) {
          const allScraperTasks = [];
          queries.forEach(q => {
              SCRAPER_MODULES.forEach(scraper => {
                  if (scraper.searchMagnet) {
                      const searchOptions = { allowEng };
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

  // --- FINALIZZAZIONE ---
  if (!dbOnlyMode) {
      saveResultsToDbBackground(meta, cleanResults);
  }
  
  if (config.filters) {
      cleanResults = cleanResults.filter(item => {
          const t = (item.title || "").toLowerCase();
          
          // [MODIFICA] Filtro HD con 0 Seeders
          if ((item.seeders === 0 || item.seeders == null)) {
              // Se è HD/1080p/4K e ha 0 seeders -> Rimuovi
              // Mantiene invece gli SD con 0 seeders (spesso roba vecchia rara)
              if (REGEX_QUALITY["4K"].test(t) || REGEX_QUALITY["1080p"].test(t) || REGEX_QUALITY["720p"].test(t) || /\bhd\b/i.test(t)) {
                  return false;
              }
          }

          if (config.filters.maxSizeGB && config.filters.maxSizeGB > 0) {
              const maxBytes = config.filters.maxSizeGB * 1024 * 1024 * 1024;
              const itemSize = item._size || item.sizeBytes || 0;
              if (itemSize > 0 && itemSize > maxBytes) return false;
          }
          if (config.filters.no4k && REGEX_QUALITY["4K"].test(t)) return false;
          if (config.filters.no1080 && REGEX_QUALITY["1080p"].test(t)) return false;
          if (config.filters.no720 && REGEX_QUALITY["720p"].test(t)) return false;
          if (config.filters.noScr) {
               if (REGEX_QUALITY["SD"].test(t)) return false;
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

  let finalRanked = rankedList.slice(0, CONFIG.MAX_RESULTS);

  if (config.service === 'tb' && hasDebridKey) {
      const apiKey = config.key || config.rd; 
      finalRanked = await filterTorBoxCached(apiKey, finalRanked);
  }

  const ranked = finalRanked;

  let debridStreams = [];
  if (ranked.length > 0 && hasDebridKey) {
      // --- MODALITÀ FULL LAZY (FAKE CACHE) ---
      // Tutti i risultati vengono trattati come Lazy, ma formattati come "Cached"
      // Questo elimina il controllo istantaneo (Hybrid) e velocizza la risposta
      // Il link viene risolto solo quando l'utente clicca.
      
      debridStreams = ranked.map(item =>
          generateLazyStream(item, config, meta, reqHost, userConfStr, true)
      );
  }

  // === WEB PROVIDERS ===
  let rawVix = [], formattedGhd = [], formattedGs = [], formattedVix = [];

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

       [rawVix, formattedGhd, formattedGs] = await Promise.all([vixPromise, ghdPromise, gsPromise]);
       
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
                   else if (regex1080.test(textToCheck)) { quality = "1080p"; qIcon = "✨"; }
                   else if (regex720.test(textToCheck)) { quality = "720p"; qIcon = "📺"; }
                   else if (regexSD.test(textToCheck)) { quality = "SD"; qIcon = "🐢"; }
                   else { quality = "WebStreams"; }
                   
                   if (sourceName.includes("StreamingCommunity") || sourceName.includes("Vix")) {
                       if (quality === "SD" && !regexSD.test(textToCheck)) {
                           quality = "1080p"; qIcon = "✨";
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
                   // Binge Group Web Unificato
                   stream.behaviorHints.bingieGroup = `Leviathan|${quality}|Web|${sourceName.replace(/\W/g,'')}`;
               });
           };
           if (typeof rawVix !== 'undefined') applyAioStyle(rawVix, "StreamingCommunity");
           if (typeof formattedGhd !== 'undefined') applyAioStyle(formattedGhd, "GuardaHD");
           if (typeof formattedGs !== 'undefined') applyAioStyle(formattedGs, "GuardaSerie");
       }
       formattedVix = rawVix; 
  }

  let finalStreams = [];
  if (config.filters && config.filters.vixLast === true) {
      finalStreams = [...debridStreams, ...formattedGhd, ...formattedGs, ...formattedVix];
  } else {
      finalStreams = [...formattedGhd, ...formattedGs, ...formattedVix, ...debridStreams];
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

  // --- FALLBACK WEBSTREAMR: SOLO SE 0 RISULTATI (P2P + WEB LOCALI) ---
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
             await axios.post("https://api.torbox.app/v1/api/torrents/create", 
                { magnet: `magnet:?xt=urn:btih:${hash}` }, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
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
        const hasRDKey = (config.service === 'rd' && config.key) || config.rd;
        const hasTBKey = (config.service === 'tb' && config.key) || config.torbox;
        const hasADKey = (config.service === 'ad' && config.key) || config.alldebrid;
        if (hasRDKey) {
            manifest.name = "Leviathan ⚡ RD";
            manifest.id += ".rd"; 
        } 
        else if (hasTBKey) {
            manifest.name = "Leviathan 📦 TB";
            manifest.id += ".tb";
        } 
        else if (hasADKey) {
            manifest.name = "Leviathan 🦅 AD";
            manifest.id += ".ad";
        }
        else {
            manifest.name = "Leviathan 🌐 Web";
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
    console.log(`⚡ MODE: FULL LAZY (All items deferred)`);
    console.log(`🎭 LOOK: Fake Cache Appearance (Instant + Clean)`);
    console.log(`📡 INDEXER URL (ENV): ${CONFIG.INDEXER_URL}`);
    console.log(`🎬 METADATA: TMDB Primary (User Key Priority)`);
    console.log(`💾 SCRITTURA: DB Locale (Auto-Learning attivo)`);
    console.log(`📖 LETTURA DB: ATTIVA (Integrazione Locale Presente)`);
    console.log(`👁️ SPETTRO VISIVO: Modulo Attivo (Esclusioni 4K/1080/720/SD)`);
    console.log(`⚖️ SIZE LIMITER: Modulo Attivo (GB Filter)`);
    console.log(`🚫 NO-GHOST HD: Filtro HD con 0 Seeders ATTIVO`);
    console.log(`🦁 GUARDA HD: Modulo Integrato e Pronto`);
    console.log(`🛡️ GUARDA SERIE: Modulo Integrato e Pronto`);
    console.log(`🕷️ WEBSTREAMR: Fallback Attivo (Su 0 Risultati)`);
    console.log(`📦 TORBOX: True Cache Check Enabled`);
    console.log(`🦑 LEVIATHAN CORE: Optimized for High Reliability`);
    console.log(`-----------------------------------------------------`);
});
