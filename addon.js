require('dotenv').config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto"); 
const Bottleneck = require("bottleneck");
const rateLimit = require("express-rate-limit");

// --- MODULO CACHE REDIS (GOD TIER) ---
const Cache = require("./cache"); 

const { handleVixSynthetic } = require("./vix/vix_proxy");
// --- IMPORTIAMO MODULI SMART ---
const { generateSmartQueries } = require("./ai_query");
const { smartMatch } = require("./smart_parser");
const { rankAndFilterResults } = require("./ranking");

// --- IMPORTIAMO CONVERTER E DEBRID ---
const { tmdbToImdb, imdbToTmdb, getTmdbAltTitles } = require("./id_converter");
const kitsuHandler = require("./kitsu_handler");
const RD = require("./debrid/realdebrid");
const AD = require("./debrid/alldebrid");
const TB = require("./debrid/torbox");
const dbHelper = require("./db-helper"); 
const { searchVix } = require("./vix/vix_handler");
const { getManifest } = require("./manifest");

// Inizializza DB Locale (Se presente)
dbHelper.initDatabase();

const CONFIG = {
  CINEMETA_URL: "https://v3-cinemeta.strem.io",
  REAL_SIZE_FILTER: 80 * 1024 * 1024,
  TIMEOUT_TMDB: 2000,
  SCRAPER_TIMEOUT: 6000, 
  MAX_RESULTS: 40, 
};

// --- STATIC REGEX PATTERNS ---
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
const FALLBACK_SCRAPERS = [ require("./external") ];

const app = express();
app.set('trust proxy', 1);

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 300, 
	standardHeaders: true, 
	legacyHeaders: false,
    message: "Troppe richieste da questo IP, riprova più tardi."
});

app.use(limiter);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json()); // Necessario per Admin API
app.use(express.static(path.join(__dirname, "public")));

// --- FORMATTERS ---

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
  if (REGEX_QUALITY["4K"].test(t)) { q = "4K"; qIcon = "✨"; }
  else if (REGEX_QUALITY["1080p"].test(t)) { q = "1080p"; qIcon = "🌕"; }
  else if (REGEX_QUALITY["720p"].test(t)) { q = "720p"; qIcon = "🌗"; }
  else if (REGEX_QUALITY["SD"].test(t)) { q = "SD"; qIcon = "🌑"; }
  const videoTags = [];
  if (/hdr/.test(t)) videoTags.push("HDR");
  if (/dolby|vision|\bdv\b/.test(t)) videoTags.push("DV");
  if (/imax/.test(t)) videoTags.push("IMAX");
  if (/x265|h265|hevc/.test(t)) videoTags.push("HEVC");
  let lang = "🇬🇧 ENG"; 
  if (source === "Corsaro" || isSafeForItalian({ title })) {
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

async function getMetadata(id, type) {
  try {
    const allowedTypes = ["movie", "series"];
    if (!allowedTypes.includes(type)) return null;
    let tmdbId = id, s = 0, e = 0;
    if (type === "series" && id.includes(":")) [tmdbId, s, e] = id.split(":");
    const rawId = tmdbId.split(":")[0];
    const cleanId = rawId.match(/^(tt\d+|\d+)$/i)?.[0] || "";
    if (!cleanId) return null;
    const { data: cData } = await axios.get(`${CONFIG.CINEMETA_URL}/meta/${type}/${cleanId}.json`, { timeout: CONFIG.TIMEOUT_TMDB }).catch(() => ({ data: {} }));
    return cData?.meta ? {
      title: cData.meta.name,
      originalTitle: cData.meta.name, 
      year: cData.meta.year?.split("–")[0],
      imdb_id: cleanId, 
      isSeries: type === "series",
      season: parseInt(s),
      episode: parseInt(e)
    } : null;
  } catch (err) { return null; }
}

async function resolveDebridLink(config, item, showFake, reqHost) {
    try {
        const service = config.service || 'rd';
        const apiKey = config.key || config.rd;
        if (!apiKey) return null;

        if (service === 'tb') {
            if (item._tbCached) {
                const serviceTag = "TB";
                const { name, title } = formatStreamTitleCinePro(item.title, item.source, item._size, item.seeders, serviceTag);
                const proxyUrl = `${reqHost}/${config.rawConf}/play_tb/${item.hash}?s=${item.season || 0}&e=${item.episode || 0}`;
                return { name, title, url: proxyUrl, behaviorHints: { notWebReady: false, bingieGroup: `corsaro-tb` } };
            } else { return null; }
        }

        let streamData = null;
        if (service === 'rd') streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        else if (service === 'ad') streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode);

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) return null;

        const serviceTag = service.toUpperCase();
        const { name, title } = formatStreamTitleCinePro(streamData.filename || item.title, item.source, streamData.size || item.size, item.seeders, serviceTag);
        return { name, title, url: streamData.url, behaviorHints: { notWebReady: false, bingieGroup: `corsaro-${service}` } };
    } catch (e) {
        if (showFake) return { name: `[P2P ⚠️]`, title: `${item.title}\n⚠️ Cache Assente`, url: item.magnet, behaviorHints: { notWebReady: true } };
        return null;
    }
}

const hashConfig = (conf) => crypto.createHash("md5").update(conf).digest("hex");

async function generateStream(type, id, config, userConfStr, reqHost) {
  if (!config.key && !config.rd) return { streams: [{ name: "⚠️ CONFIG", title: "Inserisci API Key nel configuratore" }] };
  
  const userTmdbKey = config.tmdb; 
  let finalId = id; 
  if (id.startsWith("tmdb:")) {
      try {
          const parts = id.split(":");
          const imdbId = await tmdbToImdb(parts[1], type, userTmdbKey);
          if (imdbId) {
              if (type === "series" && parts.length >= 4) finalId = `${imdbId}:${parts[2]}:${parts[3]}`; 
              else finalId = imdbId; 
          }
      } catch (err) {}
  }
  if (id.startsWith("kitsu:")) {
      try {
          const parts = id.split(":");
          const kData = await kitsuHandler(parts[1]);
          if (kData && kData.imdbID) {
              const s = kData.season || 1; 
              finalId = kData.type === 'series' || type === 'series' ? `${kData.imdbID}:${s}:${parts[2] || 1}` : kData.imdbID;
          }
      } catch (err) {}
  }

  const meta = await getMetadata(finalId, type); 
  if (!meta) return { streams: [] };

  // --- LOGICA REDIS (GOD TIER) ---
  let cleanResults = await Cache.getCachedMagnets(type, finalId);
  
  if (cleanResults) {
      console.log(`⚡ [REDIS HIT] Cache Globale: ${meta.title} (${cleanResults.length} magnets)`);
  } else {
      console.log(`🐢 [REDIS MISS] Avvio Scraping per: ${meta.title}`);

      // --- START SCRAPING LOGIC ---
      console.log(`\n🔍 [DB] Cerco nel database: ${meta.imdb_id}`);
      let dbResults = [];
      try {
          if (type === 'movie') dbResults = await dbHelper.searchMovie(meta.imdb_id);
          else if (type === 'series') dbResults = await dbHelper.searchSeries(meta.imdb_id, meta.season, meta.episode);
          
          // --- LIMITER DB: RIMOSSO (Tutti i risultati) ---
          if (dbResults && dbResults.length > 0) {
              // Ordiniamo per seeders (i migliori in alto)
              dbResults.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
              
              // CODICE RIMOSSO:
              // if (dbResults.length > 6) {
              //    dbResults = dbResults.slice(0, 6);
              // }
          }
          // ----------------------------------------------

      } catch (err) { console.error("❌ Errore ricerca DB:", err.message); }
      
      let dynamicTitles = [];
      try {
          let tmdbIdForSearch = meta.imdb_id.startsWith("tt") ? (await imdbToTmdb(meta.imdb_id, userTmdbKey)).tmdbId : meta.imdb_id;
          if (tmdbIdForSearch) dynamicTitles = await getTmdbAltTitles(tmdbIdForSearch, type, userTmdbKey);
      } catch (e) {}

      const allowEng = config.filters?.allowEng === true; 
      const queries = generateSmartQueries(meta, dynamicTitles, allowEng);
      
      console.log(`\n🧠 [AI-CORE] Cerco "${meta.title}": ${queries.length} varianti.`);

      let promises = [];
      queries.forEach(q => { 
          SCRAPER_MODULES.forEach(scraper => { 
              if (scraper.searchMagnet) { 
                  const searchOptions = { allowEng };
                  promises.push(LIMITERS.scraper.schedule(() => withTimeout(scraper.searchMagnet(q, meta.year, type, finalId, searchOptions), CONFIG.SCRAPER_TIMEOUT).catch(err => []))); 
              } 
          }); 
      });

      let resultsRaw = (await Promise.all(promises)).flat();
      resultsRaw = [...dbResults, ...resultsRaw]; 

      resultsRaw = resultsRaw.filter(item => {
        if (!item?.magnet) return false;
        const fileYearMatch = item.title.match(REGEX_YEAR);
        if (fileYearMatch && Math.abs(parseInt(fileYearMatch[0]) - parseInt(meta.year)) > 1) return false;
        const isSemanticallySafe = smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode);
        if (!isSemanticallySafe) return false;
        if (!allowEng && !isSafeForItalian(item)) return false;
        return true;
      });

      if (resultsRaw.length <= 5) {
          const extPromises = FALLBACK_SCRAPERS.map(fb => LIMITERS.scraper.schedule(() => withTimeout(fb.searchMagnet(queries[0], meta.year, type, finalId), CONFIG.SCRAPER_TIMEOUT).catch(() => [])));
          try {
            const extResultsRaw = (await Promise.all(extPromises)).flat();
            if (Array.isArray(extResultsRaw)) {
                const filteredExt = extResultsRaw.filter(item => smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode) && (!allowEng ? isSafeForItalian(item) : true));
                resultsRaw = [...resultsRaw, ...filteredExt];
            }
          } catch (e) {}
      }

      const seen = new Set(); 
      cleanResults = [];
      for (const item of resultsRaw) {
        if (!item || !item.magnet) continue;
        try {
            const hashMatch = item.magnet.match(/btih:([a-f0-9]{40})/i);
            const hash = hashMatch ? hashMatch[1].toUpperCase() : item.magnet;
            if (seen.has(hash)) continue;
            seen.add(hash);
            item._size = parseSize(item.size || item.sizeBytes);
            item.hash = hash; 
            cleanResults.push(item);
        } catch (err) { continue; }
      }
      // --- END SCRAPING LOGIC ---

      // SALVA IN REDIS
      if (cleanResults && cleanResults.length > 0) {
          Cache.cacheMagnets(type, finalId, cleanResults);
      }
  }

  const ranked = rankAndFilterResults(cleanResults, meta, config).slice(0, CONFIG.MAX_RESULTS);

  // TORBOX CHECK
  if (config.service === 'tb' && ranked.length > 0) {
      const hashes = ranked.map(r => r.hash);
      console.log(`🔎 [TorBox] Controllo cache per ${hashes.length} elementi...`);
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
          return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake, reqHost));
      });
      debridStreams = (await Promise.all(rdPromises)).filter(Boolean);
  }

  // VIX (StreamingCommunity) - Non cachato in Redis Magnet ma in Stream Cache
  const vixPromise = searchVix(meta, config);
  const rawVix = await vixPromise; 
  const formattedVix = rawVix.map(v => formatVixStream(meta, v));
  
  const finalStreams = [...formattedVix, ...debridStreams];
  if (finalStreams.length === 0) return { streams: [{ name: "⛔", title: "Nessun risultato trovato" }] };
  return { streams: finalStreams }; 
}

app.get("/:conf/play_tb/:hash", async (req, res) => {
    const { conf, hash } = req.params;
    const { s, e } = req.query;
    console.log(`\n▶️ [TorBox Play] Hash: ${hash} S${s}E${e}`);
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
        res.status(500).send("Errore Server: " + err.message);
    }
});

// --- ADMIN API ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const validPass = process.env.ADMIN_PASS || "GodTierAccess2024"; 
    if (authHeader === validPass) next();
    else res.status(403).json({ error: "Password errata" });
};

app.get("/admin/keys", authMiddleware, async (req, res) => {
    try { res.json(await Cache.listKeys()); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/admin/key", authMiddleware, async (req, res) => {
    try { await Cache.deleteKey(req.body.key); res.json({ success: true }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/admin/flush", authMiddleware, async (req, res) => {
    try { await Cache.flushAll(); res.json({ success: true }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
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
    const { conf, type, id } = req.params;
    const cleanId = id.replace(".json", "");
    const confHash = crypto.createHash("md5").update(conf).digest("hex");

    // 1. CHECK CACHE UTENTE (REDIS)
    const cachedStream = await Cache.getCachedStream(confHash, type, cleanId);
    if (cachedStream) {
        console.log(`🚀 [REDIS HIT] Stream Istantaneo per ${cleanId}`);
        return res.json(cachedStream);
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = `${protocol}://${req.get('host')}`;
    
    // 2. GENERAZIONE STREAM
    const result = await generateStream(type, cleanId, getConfig(conf), conf, host);
    
    // 3. SALVATAGGIO CACHE
    if (result && result.streams && result.streams.length > 0) {
        Cache.cacheStream(confHash, type, cleanId, result);
    }
    res.json(result); 
});

function getConfig(configStr) { try { return JSON.parse(Buffer.from(configStr, "base64").toString()); } catch { return {}; } }
function withTimeout(promise, ms) { return Promise.race([promise, new Promise(r => setTimeout(() => r([]), ms))]); }

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Leviathan (God Tier) attivo su porta ${PORT}`));
