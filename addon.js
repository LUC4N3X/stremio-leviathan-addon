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
const { searchWebStreamr } = require("./webstreamr_handler");

// --- IMPORT GESTORE TRAILER (YouTube/Invidious) ---
const { getTrailerStreams } = require("./trailerProvider"); 

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
// stdTTL: 1800 secondi (30 minuti). 
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

// [MODIFICATO] Regex Qualità Estremamente Precisa
const REGEX_QUALITY = {
    "4K": /\b(?:2160p|4k|uhd|ultra[-.\s]?hd|2160i)\b/i,
    "1080p": /\b(?:1080p|1080i|fhd|full[-.\s]?hd|blu[-.\s]?ray|bd[-.\s]?rip)\b/i,
    "720p": /\b(?:720p|720i|hd[-.\s]?rip|hd)\b/i,
    "SD": /\b(?:480p|576p|sd|dvd|dvd[-.\s]?rip|dvd[-.\s]?scr|cd)\b/i
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

// NUOVA REGEX ITA POTENZIATA PER KNABEN/1337X
const REGEX_ITA = [
    // 1. Espliciti: Audio ITA, Lingua ITA
    /\b(AUDIO|LINGUA|LANG|VO)\s*[:.\-_]?\s*(ITA|IT|ITALIAN)\b/i,
    
    // 2. Codec o Qualità + ITA (es. "AC3 ITA", "1080p ITA", "WebRip.ITA")
    /\b(AC-?3|AAC|DDP?|DTS|PCM|TRUEHD|ATMOS|MP3|FLAC|MD|LD|DD\+?|5\.1|H\.?264|H\.?265|X264|X265|HEVC|AVC|DIVX|XVID|BLURAY|BD|BDRIP|WEBRIP|WEB-?DL|HDTV|1080[pi]|720[pi]|480[pi]|4K|2160[pi])[\s.\-_]+(ITA|IT|ITALIAN)\b/i,
    
    // 3. Multi/Dual che include ITA
    /\b(MULTI|DUAL|TRIPLE).*ITA\b/i,
    
    // 4. ITA seguito da altro (es. "ITA-ENG", "ITA.AC3")
    /\b(ITA|IT|ITALIAN)[\s.\-_]+(ENG|EN|ENGLISH|FRA|GER|SPA|RUS|AC3|AAC|DDP|DTS|H264|H265)\b/i,
    
    // 5. ITA Isolato tra separatori (es. "[ITA]", ".ITA.", "-ITA-", " ITA ")
    /(?:^|[_\-. \[(\/])(ITA|ITALIAN|ITALY)(?:$|[_\-. \])\/])/i,
    
    // 6. Release Groups noti (Aggiungine altri se ne trovi)
    /\b(iDN_CreW|CORSARO|MUX|WMS|TRIDIM|SPEEDVIDEO|EAGLE|TRL|MEA|LUX|DNA|LEST|GHIZZO|USAbit|Bric|Dtone|Gaiage|BlackBit|Pantry|Vics|Papeete|Lidri|MirCrew)\b/i
];

// Regex specifica per escludere i soli sottotitoli (False Positives)
const REGEX_SUB_ONLY = /\b(SUB|SUBS|SUBBED|SOTTOTITOLI|VOST|VOSTIT)\s*[:.\-_]?\s*(ITA|IT|ITALIAN)\b/i;
// Regex per confermare che, anche se c'è scritto SUB, c'è pure l'audio (es. "Audio ITA - Sub ITA")
const REGEX_AUDIO_CONFIRM = /\b(AUDIO|AC3|AAC|DTS|MD|LD|DDP|MP3|LINGUA)[\s.\-_]+(ITA|IT)\b/i;

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

    // Canali audio 
    const channelMatch = t.match(REGEX_AUDIO.channels);
    let channels = channelMatch?.[1] || "";
    if (channels === "2.0") channels = "";

    // CONFIGURAZIONE "LEVIATHAN WAR MODE" ⚔️
    const AUDIO_PRIORITY = [
        { test: REGEX_AUDIO.atmos,  tag: "💥💣 Atmos" },   // Esplosivo
        { test: REGEX_AUDIO.dtsx,   tag: "💥💣 DTS:X" },   // Esplosivo
        { test: REGEX_AUDIO.truehd, tag: "🔊⚡ TrueHD" },  // Potenza pura
        { test: REGEX_AUDIO.dtshd,  tag: "🔊⚡ DTS-HD" },  // Potenza pura
        { test: REGEX_AUDIO.ddp,    tag: "🔊🔥 Dolby+" },  // Caldo
        { test: REGEX_AUDIO.dts,    tag: "🔊🔥 DTS" },     // Caldo
        { test: REGEX_AUDIO.flac,   tag: "🎼🌊 FLAC" },    // Fluido/Musicale
        { test: REGEX_AUDIO.dolby,  tag: "🔈🌑 Dolby" },   // Dark
        { test: REGEX_AUDIO.aac,    tag: "🔈✨ AAC" },     // Crisp
        { test: /\bmp3\b/i,         tag: "🔈🎶 MP3" }      // Basic
    ];

    let audioTag = AUDIO_PRIORITY.find(c => c.test.test(t))?.tag || "";

    // Fallback surround
    if (!audioTag && (channels === "5.1" || channels === "7.1")) {
        audioTag = "🔊🌌 Surround";
    }

    // Fallback stereo
    if (!audioTag) return "🔈⚡ Stereo";

    
    return channels ? `${audioTag} ┃ ${channels}` : audioTag;
}

// --- NUOVA FUNZIONE PER TESTO STILIZZATO (BOLD SANS per Testo, BOLD SERIF per Numeri) ---
function toStylized(text, type = 'std') {
    // Mappa per numeri (Serif Bold - molto elegante per 4K/1080p)
    const numbers = {
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    
    // Mappa per lettere (Sans-Serif Bold - molto leggibile per LEVIATHAN)
    const chars = {
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
        'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
        'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
        'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
        'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇'
    };

    if (type === 'spaced') {
        return text.split('').map(c => (chars[c] || numbers[c] || c) + ' ').join('').trim();
    }

    return text.split('').map(c => {
        if (/[0-9]/.test(c)) return numbers[c] || c;
        return chars[c] || c;
    }).join('');
}

function extractStreamInfo(title, source) {
  const t = String(title).toLowerCase();
  
  // LOGICA ESTRAZIONE QUALITÀ MIGLIORATA
  let q = "SD"; 
  let qIcon = "📼";

  if (REGEX_QUALITY["4K"].test(t)) { 
      q = "4K"; qIcon = "🔥"; 
  }
  else if (REGEX_QUALITY["1080p"].test(t)) { 
      q = "1080p"; qIcon = "👑"; 
  }
  else if (REGEX_QUALITY["720p"].test(t)) { 
      q = "720p"; qIcon = "⚡"; 
  }
  else {
      // Fallback intelligente: se non matcha nulla ma è un file recente
      q = "SD"; qIcon = "📼";
  }
  
  // --- NUOVA LOGICA TAG VIDEO ESTETICI (High Tech B&W + Fix x264/Fallback) ---
  const videoTags = [];
  
  // HDR: "🔥" (Fuoco richiesto) + Bold Text
  if (/hdr/.test(t)) videoTags.push(`🔥 ${toStylized("HDR")}`);
  
  // Dolby Vision: "👁️" + Bold DV
  if (/dolby|vision|\bdv\b/.test(t)) videoTags.push(`👁️ ${toStylized("DV")}`);
  
  // IMAX: "🏟️" + Bold IMAX
  if (/imax/.test(t)) videoTags.push(`🏟️ ${toStylized("IMAX")}`);
  
  // HEVC / AVC / Fallback
  if (/x265|h\.?265|hevc/i.test(t)) {
      videoTags.push(`⚙️ ${toStylized("HEVC")}`);
  } 
  else if (/x264|h\.?264|avc|mpeg-?4/i.test(t)) {
      videoTags.push(`📼 ${toStylized("AVC")}`);
  }
  else {
      videoTags.push(`📼 ${toStylized("AVC")}`);
  }
  
  let lang = "🇬🇧 ENG";
  if (/corsaro/i.test(source) || isSafeForItalian({ title })) {
      lang = "🇮🇹 ITA";
      if (/multi|mui/i.test(t)) lang = "🇮🇹 MULTI";
  }
  
  const audioInfo = extractAudioInfo(title);
  
  // Costruzione stringa info
  let detailsParts = [];
  if (videoTags.length) detailsParts.push(videoTags.join(" • "));
  
  return { quality: q, qIcon, info: detailsParts.join(" "), lang, audioInfo, rawVideoTags: videoTags };
}

function formatStreamTitleCinePro(fileTitle, source, size, seeders, serviceTag = "RD", config = {}, infoHash = null, isLazy = false, isPackItem = false) {
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
            isPack: isPackItem, 
            episodeTitle: isPackItem ? "📦 SEASON PACK" : getEpisodeTag(fileTitle)
        });
        return { name, title, bingeGroup };
    }

    // === MODIFICHE ESTETICHE "HIGH TECH & FIGHE" ===
    
    // 1. Qualità in Serif Bold (es. 𝟒𝐊, 𝟏𝟎𝟖𝟎𝐩) - Molto elegante
    const qualityBold = toStylized(quality);

    // 2. Leviathan Spaziato (es. 𝗟 𝗘 𝗩 𝗜 𝗔 𝗧 𝗛 𝗔 𝗡)
    const leviathanStyled = toStylized("LEVIATHAN", "spaced");

    const sizeStr = `🧲 ${sizeString}`;
    
    // Seeders: Icona Folla
    const seedersStr = seeders != null ? `👥 ${seeders}` : "";

    // Lingua: Omino + Bandiera
    let langStr = "🗣️ ❓";
    if (/multi/i.test(lang || "")) langStr = "🗣️ 🌐"; 
    else if (/ita|it\b|italiano/i.test(lang || "")) langStr = "🗣️ 🇮🇹";
    else if (/eng|en\b|english/i.test(lang || "")) langStr = "🗣️ 🇬🇧";
    else if (lang) langStr = `🗣️ ${lang.toUpperCase()}`;
    
    let displaySource = source || "P2P";

    // Normalizzazione nomi sorgenti
    if (/1337/i.test(displaySource)) displaySource = "1337x"; 
    else if (/corsaro/i.test(displaySource)) displaySource = "ilCorSaRoNeRo";
    else if (/knaben/i.test(displaySource)) displaySource = "Knaben";
    else if (/comet|stremthru/i.test(displaySource)) displaySource = "StremThru";
    else if (/rarbg/i.test(displaySource)) displaySource = "RARBG";
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
    
    const finalServiceTag = serviceTag;

    // --- ICONE SERVIZIO (Cometa confermata per RD) ---
    let serviceIcon = "⚡"; 
    if (finalServiceTag === "TB") serviceIcon = "📦";      
    else if (finalServiceTag === "RD") serviceIcon = "☄️"; // Cometa per RD
    else if (finalServiceTag === "AD") serviceIcon = "🦅"; 
    
    const sourceLine = `${serviceIcon} [${finalServiceTag}] ${displaySource}`;

    // Nome in alto: LEVIATHAN Spaziato + Qualità Bold Serif
    const name = `🦑 ${leviathanStyled}\n${qIcon} ┃ ${qualityBold}`;
    
    const cleanName = cleanFilename(fileTitle)
    .replace(/(s\d{1,2}e\d{1,2}|\d{1,2}x\d{1,2}|s\d{1,2})/ig, "")
    .replace(/\s{2,}/g, " ")
    .trim();
    
    const epTag = getEpisodeTag(fileTitle);
    const finalEpTag = isPackItem ? "📦 SEASON PACK" : epTag;

    const lines = [];
    // Icona Film: 🗂️
    lines.push(`🗂️ ${cleanName}${finalEpTag ? ` ${finalEpTag}` : ""}`);
    
    // Lingua + Audio
    const audioLine = [langStr, audioInfo].filter(Boolean).join(" • ");
    if (audioLine) lines.push(audioLine);
    
    // Info Video
    const cleanInfo = info ? info.replace("🖥️ ", "") : "";
    if (cleanInfo) lines.push(cleanInfo);
    
    // Tech: Size + Seeders
    const techLine = [sizeStr, seedersStr].filter(Boolean).join(" • ");
    if (techLine) lines.push(techLine);
    
    // Sorgente
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

async function resolveDebridLink(config, item, showFake, reqHost) {
    try {
        const service = config.service || 'rd';
        const apiKey = config.key || config.rd;
        if (!apiKey) return null;

        if (service === 'tb') {
            if (item._tbCached) {
                const serviceTag = "TB";
                // Passiamo item._isPack
                const { name, title, bingeGroup } = formatStreamTitleCinePro(item.title, item.source, item._size, item.seeders, serviceTag, config, item.hash, false, item._isPack);
                const proxyUrl = `${reqHost}/${config.rawConf}/play_tb/${item.hash}?s=${item.season || 0}&e=${item.episode || 0}`;
                return { name, title, url: proxyUrl, behaviorHints: { notWebReady: false, bingieGroup: bingeGroup } };
            } else { return null; }
        }

        let streamData = null;
        if (service === 'rd') streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        else if (service === 'ad') streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode);

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) return null;

        const serviceTag = service.toUpperCase();
        const { name, title, bingeGroup } = formatStreamTitleCinePro(streamData.filename || item.title, item.source, streamData.size || item.size, item.seeders, serviceTag, config, item.hash, false, item._isPack);
        return { name, title, url: streamData.url, behaviorHints: { notWebReady: false, bingieGroup: bingeGroup } };
    } catch (e) {
        if (showFake) return { name: `[P2P ⚠️]`, title: `${item.title}\n⚠️ Cache Assente`, url: item.magnet, behaviorHints: { notWebReady: true } };
        return null;
    }
}

function generateLazyStream(item, config, meta, reqHost, userConfStr, isLazy = false) {
    const service = config.service || 'rd';
    const serviceTag = service.toUpperCase();
    
    // Passiamo item._isPack al formattatore
    const { name, title, bingeGroup } = formatStreamTitleCinePro(
        item.title,
        item.source,
        item._size || item.sizeBytes || 0,
        item.seeders,
        serviceTag,
        config,
        item.hash,
        isLazy,
        item._isPack 
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

// Lettura DB con FILTRO LINGUA + KNABEN + BLOCCO RUSSI/ARABI + STRICT SERIES
async function queryLocalIndexer(meta, config) { 
    try {
        if (dbHelper && typeof dbHelper.getTorrents === 'function') {
            const s = parseInt(meta.season) || 0;
            const e = parseInt(meta.episode) || 0;

            const results = await dbHelper.getTorrents(meta.imdb_id, s, e);
            
            if (results && Array.isArray(results) && results.length > 0) {
                const cleanMeta = meta.title.toLowerCase().replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();
                const metaTitleShort = meta.title.split(/ - |: /)[0].toLowerCase().trim();
                
                const allowEng = config && config.filters && config.filters.allowEng === true;

                return results.map(t => {
                    // 1. PULIZIA HASH E MAGNET
                    let finalHash = t.info_hash ? t.info_hash.trim().toUpperCase() : "";
                    if ((!finalHash || finalHash.length !== 40) && t.magnet) {
                          const extracted = extractInfoHash(t.magnet);
                          if (extracted) finalHash = extracted.toUpperCase();
                    }

                    let magnetLink = t.magnet;
                    if (!magnetLink && finalHash && finalHash.length === 40) {
                        magnetLink = `magnet:?xt=urn:btih:${finalHash}&dn=${encodeURIComponent(t.title || 'video')}`;
                    }

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
                        // DB Locale ora viene filtrato (isExternal: false)
                        isExternal: false 
                    };
                }).filter(item => {
                    // --- IL BUTTAFUORI (Gatekeeper) ---
                    if (!item.hash || item.hash.length !== 40) return false;
                    const cleanFile = item.title.toLowerCase().replace(/[\.\_\-\(\)\[\]]/g, " ").replace(/\s{2,}/g, " ").trim();

                    // 1. BLOCCO KNABEN/ENG SENZA PERMESSO (REGOLA UNIVERSALE)
                    const isKnaben = /knaben/i.test(item.source);
                    const isCorsaro = /corsaro/i.test(item.source);
                    
                    // Se l'inglese NON è attivo
                    if (!allowEng) {
                        if (isKnaben) {
                            // Se è Knaben, DEVE avere tag audio forti (non basta ITA nel titolo che è spesso SUB)
                            const hasStrongAudioIta = /\b(AC-?3|AAC|DDP|DTS|MP3|MD|LD|AUDIO|LINGUA).*(ITA|IT)\b/i.test(item.title);
                            if (!hasStrongAudioIta) {
                                logger.warn(`🗑️ [KNABEN PURGE] Rimosso Knaben non-Audio-ITA: "${item.title}"`);
                                return false;
                            }
                        } else {
                            // Per gli altri (non Knaben, non Corsaro), controlla se è ITA
                            const isItalianTitle = isSafeForItalian(item);
                            if (!isItalianTitle && !isCorsaro) {
                                logger.warn(`🗑️ [LANG CHECK] Rimosso file ENG (Config Strict): "${item.title}"`);
                                return false;
                            }
                        }
                    }

                    // 2. BLOCCO CARATTERI STRANI (Russo, Arabo, Cinese)
                    if (/[а-яА-ЯёЁ]/.test(item.title)) {
                        logger.warn(`🗑️ [CYRILLIC PURGE] Rimosso titolo russo: "${item.title}"`);
                        return false;
                    }

                    // 3.  LOGICA STRICT PREVENTIVA PER SERIE TV NEL DB
                    if (meta.isSeries) {
                        // Verifica che il numero stagione nel titolo corrisponda a quello richiesto
                        const wrongSeasonRegex = /(?:s|stagione|season)\s*0?(\d+)(?!\d)/gi;
                        let match;
                        while ((match = wrongSeasonRegex.exec(cleanFile)) !== null) {
                            const foundSeason = parseInt(match[1]);
                            if (foundSeason !== s) return false; 
                        }
                        
                        // Verifica presenza Episodio (o Pack)
                        const hasRightSeason = new RegExp(`(?:s|stagione|season|^)\\s*0?${s}(?!\\d)`, 'i').test(cleanFile);
                        // Supporto formato 1x05
                        const hasXFormat = new RegExp(`\\b${s}x0?${e}\\b`, 'i').test(cleanFile);
                        
                        if (hasXFormat) return true;

                        const isExplicitPack = /(?:complete|pack|stagione\s*\d+\s*$|season\s*\d+\s*$|tutta|completa)/i.test(cleanFile);
                        const hasAnyEpisodeTag = /(?:e|x|ep|episode)\s*0?\d+/i.test(cleanFile);
                        const hasRightEpisode = new RegExp(`(?:e|x|ep|episode|^)\\s*0?${e}(?!\\d)`, 'i').test(cleanFile);

                        // Se è la stagione giusta E (episodio giusto O pack), ok. Altrimenti scarta qui.
                        if (hasRightSeason && (hasRightEpisode || isExplicitPack || !hasAnyEpisodeTag)) {
                            // OK passa
                        } else {
                            logger.warn(`🗑️ [DB SEASON FILTER] Rimosso risultato errato S/E: "${item.title}"`);
                            return false; 
                        }
                    }

                    // 4. FILTRO TITOLO (Anti-Fake)
                    let searchKeyword = cleanMeta.replace(/^(the|a|an|il|lo|la|i|gli|le)\s+/i, "").trim();
                    if (searchKeyword === "rip") {
                          const strictStartRegex = /^(the\s+|il\s+)?rip\b/i;
                          if (!strictStartRegex.test(cleanFile)) return false; 
                          return true; 
                    }

                    // 5. Match Standard
                    if (cleanFile.includes(cleanMeta)) return true;
                    if (cleanFile.includes(metaTitleShort)) return true;

                    logger.warn(`🗑️ [ANTI-FAKE] Rimosso intruso DB: "${item.title}"`);
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
        
        // Mappatura
        const mapped = data.torrents.map(t => {
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

        // FILTRO PREVENTIVO SUL REMOTE (Knaben rule strict)
        const allowEng = config && config.filters && config.filters.allowEng === true;
        return mapped.filter(item => {
             const isKnaben = /knaben/i.test(item.source);
             const isCorsaro = /corsaro/i.test(item.source);

             if (!allowEng) {
                 if (isKnaben) {
                     // Check audio tag forte
                     const hasStrongAudioIta = /\b(AC-?3|AAC|DDP|DTS|MP3|MD|LD|AUDIO|LINGUA).*(ITA|IT)\b/i.test(item.title);
                     if (!hasStrongAudioIta) return false;
                 } else {
                     // Check normale
                     const isItalian = isSafeForItalian(item);
                     if (!isItalian && !isCorsaro) return false;
                 }
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

  // --- FILTRO AGGRESSIVO ---
  const aggressiveFilter = (item) => {
      if (!item?.magnet) return false;
      if (item.isExternal) return true;

      const source = (item.source || "").toLowerCase();
      // Filtri tecnici globali
      if (source.includes("comet") || source.includes("stremthru")) return false;

      // Analisi Titolo
      const t = item.title; 
      const tLower = t.toLowerCase();
      
      const isCorsaro = /corsaro/i.test(source);
      const isKnaben = /knaben/i.test(source);
      const is1337x = /1337/i.test(source);
      const isTgx = /tgx|torrentgalaxy/i.test(source);

      // Check Match Italiano Potenziato
      const matchesItalianRegex = REGEX_ITA.some(r => r.test(t));
      
      // Gestione Config "Solo ITA" (allowEng = false) o Provider Misti
      if (!config.filters?.allowEng) {
          
          // LOGICA KNABEN & 1337x & TGX (Provider Internazionali)
          if (isKnaben || is1337x || isTgx) {
              
              if (!matchesItalianRegex) {
                  // Se non c'è traccia di ITA nelle regex potenti -> VIA
                  return false; 
              }

              
              // Se matcha "SUB ITA" E NON matcha "AUDIO ITA" -> Scarta
              const looksLikeSubOnly = REGEX_SUB_ONLY.test(t);
              const hasConfirmedAudio = REGEX_AUDIO_CONFIRM.test(t);

              if (looksLikeSubOnly && !hasConfirmedAudio) {
                   
                  const cleanTitleNoSub = t.replace(REGEX_SUB_ONLY, ""); 
                  const stillHasIta = REGEX_ITA.some(r => r.test(cleanTitleNoSub));
                  
                  if (!stillHasIta) return false; 
              }
          } 
          // LOGICA GENERALE (Altri Provider)
          else {

              if (!matchesItalianRegex && !isSafeForItalian(item) && !isCorsaro) {
                  return false;
              }
              
              // Anti-Sub Generico
              if (/\b(sub|subs|subbed|vost|vostit)\b/i.test(t) && !REGEX_AUDIO_CONFIRM.test(t) && !isCorsaro) {
                  return false;
              }
          }
      }

      
      const metaYear = parseInt(meta.year);

      // Fix Frankenstein 2025
      if (metaYear === 2025 && /frankenstein/i.test(meta.title)) {
           if (!item.title.includes("2025")) return false;
      }

      // LOGICA SERIE TV
      if (meta.isSeries) {
          const s = meta.season;
          const e = meta.episode;
          
          // 1. Check Stagione Sbagliata
          const wrongSeasonRegex = /(?:s|stagione|season)\s*0?(\d+)(?!\d)/gi;
          let match;
          while ((match = wrongSeasonRegex.exec(tLower)) !== null) {
              const foundSeason = parseInt(match[1]);
              if (foundSeason !== s) return false; 
          }

          // 2. Check 1x05
          const xMatch = tLower.match(/(\d+)x(\d+)/i);
          if (xMatch) {
              if (parseInt(xMatch[1]) !== s) return false;
              if (parseInt(xMatch[2]) !== e) return false;
              return true;
          }

          // 3. Standard Sxx Exx
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
      }

      // LOGICA FILM (Anno)
      if (!isNaN(metaYear)) {
           const fileYearMatch = item.title.match(REGEX_YEAR);
           if (fileYearMatch) {
               const fileYear = parseInt(fileYearMatch[0]);
               if (Math.abs(fileYear - metaYear) > 1) return false; 
           }
      }

      // CHECK MATCH TITOLO
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
  
  // 1. Remote Indexer 
  const remotePromise = withTimeout(
      queryRemoteIndexer(tmdbIdLookup, type, meta.season, meta.episode, config),
      CONFIG.TIMEOUTS.REMOTE_INDEXER,
      'Remote Indexer'
  ).catch(err => {
      logger.warn('Remote indexer fallito/timeout', { error: err.message });
      return [];
  });

  // 2. DB Locale 
  const localPromise = withTimeout(
      queryLocalIndexer(meta, config),
      CONFIG.TIMEOUTS.LOCAL_DB,
      'Local DB'
  ).catch(err => {
      logger.warn('Local DB fallito', { error: err.message });
      return [];
  });

  // 3. Addon Esterni
  let externalPromise = Promise.resolve([]);
  if (!dbOnlyMode) {
      externalPromise = fetchExternalResults(type, finalId);
  }

  // Esegui tutto in parallelo (Remote + Local + External)
  const [remoteResults, localResults, externalResults] = await Promise.all([remotePromise, localPromise, externalPromise]);
  
  logger.info(`📊 [STATS] Remote: ${remoteResults.length} | Local: ${localResults.length} | External: ${externalResults.length}`);

  let fastResults = [...remoteResults, ...localResults, ...externalResults].filter(aggressiveFilter);
  let cleanResults = deduplicateResults(fastResults);
  const validFastCount = cleanResults.length;

  logger.info(`⚡ [FAST CHECK] Trovati ${validFastCount} risultati validi da fonti veloci (Remote+Local+Ext).`);

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
      const isTorBox = config.service === 'tb';
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
          return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake, reqHost));
      });

      const lazyStreams = lazyItems.map(item =>
          generateLazyStream(item, config, meta, reqHost, userConfStr, true)
      );

      const resolvedInstant = (await Promise.all(immediatePromises)).filter(Boolean);
      debridStreams = [...resolvedInstant, ...lazyStreams];
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
            // [MODIFICATO] ICONA COMETA PER IL NOME ADDON
            manifest.name = "Leviathan ☄️ RD";
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
    console.log(`🕷️ WEBSTREAMR: Fallback Attivo (Su 0 Risultati)`);
    console.log(`🎬 TRAILER: Attivabile da Config (Default: OFF, Primo Risultato se ON)`);
    console.log(`📦 TORBOX: True Cache Check Enabled`);
    console.log(`🦑 LEVIATHAN CORE: Optimized for High Reliability`);
    console.log(`-----------------------------------------------------`);
});
