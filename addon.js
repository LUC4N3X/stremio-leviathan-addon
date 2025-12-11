const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const rateLimit = require("express-rate-limit");

// --- IMPORTIAMO MODULI SMART ---
const { generateSmartQueries } = require("./ai_query");
const { smartMatch } = require("./smart_parser");
const { rankAndFilterResults } = require("./ranking");

// --- IMPORTIAMO CONVERTER E DEBRID ---
// 🔥 NOTA: Importiamo anche getTmdbAltTitles e imdbToTmdb
const { tmdbToImdb, imdbToTmdb, getTmdbAltTitles } = require("./id_converter");
const kitsuHandler = require("./kitsu_handler");
const RD = require("./debrid/realdebrid");
const AD = require("./debrid/alldebrid");
const TB = require("./debrid/torbox");

const { getManifest } = require("./manifest");

// --- CONFIGURAZIONE ---
const CONFIG = {
  CINEMETA_URL: "https://v3-cinemeta.strem.io",
  REAL_SIZE_FILTER: 80 * 1024 * 1024, 
  TIMEOUT_TMDB: 2000,
  SCRAPER_TIMEOUT: 6000, 
  MAX_RESULTS: 40, 
};

// --- CACHE SYSTEM ---
const CACHE_TTL = 15 * 60 * 1000; 
const STREAM_CACHE = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of STREAM_CACHE.entries()) {
        if (now > value.expiry) STREAM_CACHE.delete(key);
    }
}, 20 * 60 * 1000);

// --- LIMITERS ---
const LIMITERS = {
  scraper: new Bottleneck({ maxConcurrent: 40, minTime: 10 }), 
  rd: new Bottleneck({ maxConcurrent: 25, minTime: 40 }), 
};

// --- MOTORI DI RICERCA ---
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
app.use(express.static(path.join(__dirname, "public")));

// --- UTILITIES UI (Cleaners) ---
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
  const t = item.title.toUpperCase();
  const itaPatterns = [
    /\bITA\b/, /\bITALIAN\b/, /\bITALY\b/,
    /MULTI.*ITA/, /DUAL.*ITA/, /AUDIO.*ITA/, /AC3.*ITA/, /AAC.*ITA/,
    /SUB.*ITA/, /SUBS.*ITA/, /SOTTOTITOLI.*ITA/,
    /H\.?264.*ITA/, /H\.?265.*ITA/, /X264.*ITA/, /HEVC.*ITA/,
    /STAGIONE/, /EPISODIO/, /MUX/, /iDN_CreW/, /WMS/, /TRIDIM/, /SPEEDVIDEO/, /CORSARO/
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
  cleanTitle = cleanTitle.replace(/[._]/g, " ");
  const uiJunk = /\b(ita|eng|sub|h264|h265|x264|x265|hevc|1080p|720p|4k|2160p|bluray|web-?dl|rip|ac3|aac|dts|multi|truehd|remux|complete|pack)\b.*/yi;
  cleanTitle = cleanTitle.replace(uiJunk, "");
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
  
  let lang = "🇬🇧 ENG"; 
  if (source === "Corsaro" || isSafeForItalian({ title })) {
      lang = "🇮🇹 ITA";
      if (/multi|mui/i.test(t)) lang = "🇮🇹 MULTI";
  } 
  
  let detailsParts = [];
  if (videoTags.length) detailsParts.push(`✨ ${videoTags.join(" ")}`);
  
  return { quality: q, qIcon, info: detailsParts.join(" • "), lang };
}

function formatStreamTitleCinePro(fileTitle, source, size, seeders, serviceTag = "RD") {
    const { quality, qIcon, info, lang } = extractStreamInfo(fileTitle, source);
    const sizeStr = size ? `📦 ${formatBytes(size)}` : "📦 ❓"; 
    const seedersStr = seeders ? `👤 ${seeders}` : "";

    const name = `[${serviceTag} ${qIcon} ${quality}] ${source}`;
    
    let cleanName = cleanFilename(fileTitle)
        .replace(/s\d+e\d+/i, "")
        .replace(/s\d+/i, "")
        .trim();
    const epTag = getEpisodeTag(fileTitle);
    
    const detailLines = [
        `🎬 ${cleanName}${epTag ? ` ${epTag}` : ""} • ${quality}`,
        `${sizeStr}${seedersStr ? ` • ${seedersStr}` : ""}`,
        `🔍 ${source} • 🗣️ ${lang.replace('🌐', '').replace('🇮🇹', 'IT').replace('🇬🇧', 'GB').trim()}`
    ];
    if (info) detailLines.push(`🎞️ ${info}`);

    return { name, title: detailLines.join('\n') };
}

async function getMetadata(id, type) {
  try {
    const allowedTypes = ["movie", "series"];
    if (!allowedTypes.includes(type)) return null;
    let tmdbId = id, s = 1, e = 1;
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

async function resolveDebridLink(config, item, showFake) {
    try {
        const service = config.service || 'rd';
        const apiKey = config.key || config.rd;
        if (!apiKey) return null;

        let streamData = null;
        if (service === 'rd') streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        else if (service === 'ad') streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        else if (service === 'tb') streamData = await TB.getStreamLink(apiKey, item.magnet, item.season, item.episode);

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) return null;

        const serviceTag = service.toUpperCase();
        const { name, title } = formatStreamTitleCinePro(streamData.filename || item.title, item.source, streamData.size || item.size, item.seeders, serviceTag);
        
        return { 
            name, title, url: streamData.url, 
            behaviorHints: { notWebReady: false, bingieGroup: `corsaro-${service}` } 
        };
    } catch (e) {
        if (showFake) return { name: `[P2P ⚠️]`, title: `${item.title}\n⚠️ Cache Assente`, url: item.magnet, behaviorHints: { notWebReady: true } };
        return null;
    }
}

// 🔥 GENERATE STREAM - FUNZIONE PRINCIPALE 🔥
async function generateStream(type, id, config, userConfStr) {
  if (!config.key && !config.rd) return { streams: [{ name: "⚠️ CONFIG", title: "Inserisci API Key nel configuratore" }] };
  
  let finalId = id; 
  if (id.startsWith("tmdb:")) {
      try {
          const parts = id.split(":");
          const imdbId = await tmdbToImdb(parts[1], type);
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
  
  // --- 🔥 NUOVO: LOGICA DINAMICA TITOLI (GOD TIER) 🔥 ---
  let dynamicTitles = [];
  try {
      let tmdbIdForSearch = null;
      // Recupera ID TMDB se abbiamo un IMDB ID
      if (meta.imdb_id.startsWith("tt")) {
          const converted = await imdbToTmdb(meta.imdb_id);
          tmdbIdForSearch = converted.tmdbId;
      } else {
          tmdbIdForSearch = meta.imdb_id; // Probabilmente è già numerico
      }

      if (tmdbIdForSearch) {
          // Chiama TMDB per titoli alternativi (es. "Il Rito Finale" per "The Conjuring")
          dynamicTitles = await getTmdbAltTitles(tmdbIdForSearch, type);
      }
  } catch (e) {
      console.log("Errore recupero titoli dinamici:", e.message);
  }

  // Genera Query passando anche gli alias dinamici
  const queries = generateSmartQueries(meta, dynamicTitles);
  // ------------------------------------------------------

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

  // 3. FILTERING
  resultsRaw = resultsRaw.filter(item => {
    if (!item?.magnet) return false;
    const fileYearMatch = item.title.match(/\b(19|20)\d{2}\b/);
    if (fileYearMatch) {
        if (Math.abs(parseInt(fileYearMatch[0]) - parseInt(meta.year)) > 1) return false;
    }
    const isSemanticallySafe = smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode);
    if (!isSemanticallySafe) return false;
    if (onlyIta && !isSafeForItalian(item)) return false;
    return true;
  });

  // Fallback
  if (resultsRaw.length <= 5) {
    const extPromises = FALLBACK_SCRAPERS.map(fb => 
        LIMITERS.scraper.schedule(() => withTimeout(fb.searchMagnet(queries[0], meta.year, type, finalId), CONFIG.SCRAPER_TIMEOUT).catch(() => []))
    );
    try {
        const extResultsRaw = (await Promise.all(extPromises)).flat();
        if (Array.isArray(extResultsRaw)) {
            const filteredExt = extResultsRaw.filter(item => 
                smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode) &&
                (!onlyIta || isSafeForItalian(item))
            );
            resultsRaw = [...resultsRaw, ...filteredExt];
        }
    } catch (e) {}
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
  
  if (!cleanResults.length) return { streams: [{ name: "⛔", title: "Nessun risultato ITA trovato" }] };

  // Ranking & Debrid
  const ranked = rankAndFilterResults(cleanResults, meta, config).slice(0, CONFIG.MAX_RESULTS);
  const rdPromises = ranked.map(item => {
      item.season = meta.season;
      item.episode = meta.episode;
      return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake));
  });
  
  let streams = (await Promise.all(rdPromises)).filter(Boolean);

  if (streams.length === 0) return { streams: [{ name: "⛔", title: "Nessun link cached trovato" }] };

  return { streams }; 
}

// --- ROUTES ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/:conf/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/manifest.json", (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json(getManifest()); });
app.get("/:conf/manifest.json", (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json(getManifest()); });
app.get("/:conf/catalog/:type/:id/:extra?.json", async (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json({metas:[]}); });

app.get("/:conf/stream/:type/:id.json", async (req, res) => { 
    res.setHeader("Access-Control-Allow-Origin", "*");
    const { conf, type, id } = req.params;
    const cacheKey = `${conf}:${type}:${id}`;

    if (STREAM_CACHE.has(cacheKey)) {
        const cachedEntry = STREAM_CACHE.get(cacheKey);
        if (Date.now() < cachedEntry.expiry) {
            console.log(`⚡ [CACHE HIT] Servo "${id}" dalla memoria.`);
            return res.json(cachedEntry.data);
        } else STREAM_CACHE.delete(cacheKey);
    }

    const result = await generateStream(type, id.replace(".json", ""), getConfig(conf), conf);

    if (result && result.streams && result.streams.length > 0 && result.streams[0].name !== "⛔") {
        STREAM_CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    }
    res.json(result); 
});

function getConfig(configStr) { try { return JSON.parse(Buffer.from(configStr, "base64").toString()); } catch { return {}; } }
function withTimeout(promise, ms) { return Promise.race([promise, new Promise(r => setTimeout(() => r([]), ms))]); }

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Leviathan (God Tier) attivo su porta ${PORT}`));
