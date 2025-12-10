const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const axios = require("axios");
const Bottleneck = require("bottleneck");
// NUOVO: Importiamo il limitatore di richieste
const rateLimit = require("express-rate-limit");

// --- IMPORTIAMO I NUOVI MODULI SMART ---
const { generateSmartQueries } = require("./ai_query");
const { smartMatch } = require("./smart_parser");
// IMPORTIAMO IL RANKING ESTERNO
const { rankAndFilterResults } = require("./ranking");

//  IMPORTIAMO ALTRI MODULI
const { tmdbToImdb } = require("./id_converter");
const kitsuHandler = require("./kitsu_handler");
const RD = require("./debrid/realdebrid");
const AD = require("./debrid/alldebrid");
const TB = require("./debrid/torbox");

// --- IMPORTIAMO IL MANIFEST ---
const { getManifest } = require("./manifest");

// --- CONFIGURAZIONE ---
const CONFIG = {
  CINEMETA_URL: "https://v3-cinemeta.strem.io",
  REAL_SIZE_FILTER: 80 * 1024 * 1024, // Filtra file < 80MB
  TIMEOUT_TMDB: 2000,
  SCRAPER_TIMEOUT: 6000, 
  MAX_RESULTS: 40, 
};

// --- CACHE SYSTEM CONFIGURATION ---
const CACHE_TTL = 15 * 60 * 1000; // 15 Minuti
const STREAM_CACHE = new Map();

// Garbage Collector
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of STREAM_CACHE.entries()) {
        if (now > value.expiry) {
            STREAM_CACHE.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`🧹 [CACHE] Puliti ${cleaned} elementi scaduti.`);
}, 20 * 60 * 1000);

// --- LIMITERS (Interni per API) ---
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

// --- SICUREZZA & RATE LIMITING (FIX CODEQL) ---
app.set('trust proxy', 1); // Necessario se hostato su Render, Heroku, HF, ecc.

// Definiamo il limitatore: Max 300 richieste ogni 15 minuti per IP
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 300, 
	standardHeaders: true, 
	legacyHeaders: false,
    message: "Troppe richieste da questo IP, riprova più tardi."
});

// Applichiamo il limitatore a tutte le richieste
app.use(limiter);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// --- UTILITIES ---
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
//  HELPER DI FORMATTAZIONE & FILTRO
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
  } catch (err) { 
      console.error("Metadata Error:", err.message);
      return null; 
  }
}

async function resolveDebridLink(config, item, showFake) {
    try {
        const service = config.service || 'rd';
        const apiKey = config.key || config.rd;
        
        if (!apiKey) return null;

        let streamData = null;

        if (service === 'rd') {
            streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        } else if (service === 'ad') {
            streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        } else if (service === 'tb') {
            streamData = await TB.getStreamLink(apiKey, item.magnet, item.season, item.episode);
        }

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) return null;

        let serviceTag = "RD";
        if (service === 'ad') serviceTag = "AD";
        if (service === 'tb') serviceTag = "TB";

        const { name, title } = formatStreamTitleCinePro(streamData.filename || item.title, item.source, streamData.size || item.size, item.seeders, serviceTag);
        
        return { 
            name, 
            title, 
            url: streamData.url, 
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
          const tmdbId = parts[1];
          const imdbId = await tmdbToImdb(tmdbId, type);
          if (imdbId) {
              if (type === "series" && parts.length >= 4) {
                  const s = parts[2];
                  const e = parts[3];
                  finalId = `${imdbId}:${s}:${e}`; 
              } else {
                  finalId = imdbId; 
              }
          }
      } catch (err) { console.error("ID Convert Error:", err.message); }
  }

  if (id.startsWith("kitsu:")) {
      try {
          const parts = id.split(":");
          const kitsuId = parts[1];
          const kitsuEp = parts[2] ? parseInt(parts[2]) : 1;
          const kData = await kitsuHandler(kitsuId);
          if (kData && kData.imdbID) {
              if (kData.type === 'series' || type === 'series') {
                  const s = kData.season || 1; 
                  finalId = `${kData.imdbID}:${s}:${kitsuEp}`;
              } else {
                  finalId = kData.imdbID;
              }
          }
      } catch (err) { console.error("🦊 Kitsu Error:", err.message); }
  }

  const meta = await getMetadata(finalId, type); 
  if (!meta) return { streams: [] };
  
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

  // 3. FILTERING
  resultsRaw = resultsRaw.filter(item => {
    if (!item?.magnet) return false;
    
    const fileYearMatch = item.title.match(/\b(19|20)\d{2}\b/);
    if (fileYearMatch) {
        const fileYear = parseInt(fileYearMatch[0]);
        const metaYear = parseInt(meta.year);
        if (Math.abs(fileYear - metaYear) > 1) return false;
        
        if (/\bLisa\b/i.test(item.title) && !/\bLisa\b/i.test(meta.title)) return false;

        const tLower = item.title.toLowerCase();
        const mLower = meta.title.toLowerCase();
        const idx = tLower.indexOf(mLower);
        if (idx > 0) {
            const prefix = tLower.substring(0, idx).trim();
            if (/[a-z0-9]$/i.test(prefix)) {
                const words = prefix.split(/[^a-z0-9]+/);
                const lastWord = words[words.length - 1];
                const badPrefixes = ["lisa", "bride", "son", "curse", "house", "i", "return", "revenge"];
                if (badPrefixes.includes(lastWord)) return false;
            }
        }
    }

    const isSemanticallySafe = smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode);
    if (!isSemanticallySafe) return false;

    if (onlyIta && !isSafeForItalian(item)) return false;
    return true;
  });

  // Fallback se pochi risultati iniziali
  if (resultsRaw.length <= 5) {
    const extPromises = FALLBACK_SCRAPERS.map(fb => {
        return LIMITERS.scraper.schedule(async () => {
            try {
                return await withTimeout(fb.searchMagnet(queries[0], meta.year, type, finalId), CONFIG.SCRAPER_TIMEOUT);
            } catch (err) { return []; }
        });
    });

    try {
        let timeoutHandle;
        const timeoutPromise = new Promise(resolve => {
            timeoutHandle = setTimeout(() => { resolve([]); }, CONFIG.SCRAPER_TIMEOUT + 1500); 
        });
        const searchPromise = Promise.all(extPromises).then(res => { clearTimeout(timeoutHandle); return res; });
        const extResultsRaw = await Promise.race([searchPromise, timeoutPromise]);
        
        if (Array.isArray(extResultsRaw)) {
            const filteredExt = extResultsRaw.flat().filter(item => 
                smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode)
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
  
  if (!cleanResults.length) return { streams: [{ name: "⛔", title: "Nessun risultato trovato" }] };

  // Ranking
  const ranked = rankAndFilterResults(cleanResults, meta, config).slice(0, CONFIG.MAX_RESULTS);
  
  // Risoluzione Link Debrid
  const rdPromises = ranked.map(item => {
      item.season = meta.season;
      item.episode = meta.episode;
      return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake));
  });
  
  let streams = (await Promise.all(rdPromises)).filter(Boolean);

  // 🔥🔥🔥 FALLBACK ESTREMO: SE RD NON RESTITUISCE NULLA 🔥🔥🔥
  if (streams.length === 0) {
    console.log(`⚠️ Tutti i link RD iniziali sono uncached/falliti. Attivo EXTERNAL.JS di emergenza...`);
    
    try {
        // Forza l'uso di External anche se non è stato usato prima
        const externalEngine = require("./external");
        
        // Cerca usando la query principale (la più accurata)
        const fallbackRaw = await withTimeout(
            externalEngine.searchMagnet(queries[0], meta.year, type, finalId),
            CONFIG.SCRAPER_TIMEOUT + 1000
        );

        if (Array.isArray(fallbackRaw)) {
            // Filtra e prepara
            const fallbackFiltered = fallbackRaw.filter(item => 
                smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode)
            );

            // Deduplica rapida (opzionale, per evitare di riprocessare gli stessi hash se external era già partito)
            const newItems = fallbackFiltered.filter(item => {
                const hashMatch = item.magnet.match(/btih:([a-f0-9]{40})/i);
                const hash = hashMatch ? hashMatch[1].toUpperCase() : item.magnet;
                return !seen.has(hash);
            });

            console.log(`🔥 External Emergency Found: ${newItems.length} nuovi candidati.`);

            // Risolvi RD sui nuovi item
            const fallbackRdPromises = newItems.map(item => {
                item.season = meta.season;
                item.episode = meta.episode;
                return LIMITERS.rd.schedule(() => resolveDebridLink(config, item, config.filters?.showFake));
            });

            const fallbackStreams = (await Promise.all(fallbackRdPromises)).filter(Boolean);
            streams = fallbackStreams; // Assegna i nuovi stream
        }
    } catch (e) {
        console.error("External Fallback Error:", e.message);
    }
  }

  // Se ancora vuoto, mostra messaggio
  if (!streams.length) return { streams: [{ name: "⛔", title: "Nessun link cached trovato" }] };

  return { streams }; 
}

// --- ROUTES ---

// 1. Home Page
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// 2. Configurazione Esistente
app.get("/:conf/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// 3. Nuova Configurazione (FIX PER I TUOI ERRORI)
app.get("/configure", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// 4. Manifest
app.get("/manifest.json", (req, res) => { const manifest = getManifest(); res.setHeader("Access-Control-Allow-Origin", "*"); res.json(manifest); });
app.get("/:conf/manifest.json", (req, res) => { const manifest = getManifest(); res.setHeader("Access-Control-Allow-Origin", "*"); res.json(manifest); });

// 5. Catalog (Dummy)
app.get("/:conf/catalog/:type/:id/:extra?.json", async (req, res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.json({metas:[]}); });

// 6. STREAMING CON CACHE
app.get("/:conf/stream/:type/:id.json", async (req, res) => { 
    res.setHeader("Access-Control-Allow-Origin", "*");

    const { conf, type, id } = req.params;
    const cacheKey = `${conf}:${type}:${id}`;

    // 1. Controllo Cache
    if (STREAM_CACHE.has(cacheKey)) {
        const cachedEntry = STREAM_CACHE.get(cacheKey);
        if (Date.now() < cachedEntry.expiry) {
            console.log(`⚡ [CACHE HIT] Servo "${id}" dalla memoria.`);
            return res.json(cachedEntry.data);
        } else {
            STREAM_CACHE.delete(cacheKey);
        }
    }

    // 2. Generazione
    const result = await generateStream(type, id.replace(".json", ""), getConfig(conf), conf);

    // 3. Salvataggio Cache
    if (result && result.streams && result.streams.length > 0 && result.streams[0].name !== "⛔") {
        STREAM_CACHE.set(cacheKey, {
            data: result,
            expiry: Date.now() + CACHE_TTL
        });
    }

    res.json(result); 
});

function getConfig(configStr) { try { return JSON.parse(Buffer.from(configStr, "base64").toString()); } catch { return {}; } }
function withTimeout(promise, ms) { return Promise.race([promise, new Promise(r => setTimeout(() => r([]), ms))]); }

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Leviathan (AI-Core) v31.3 attivo su porta ${PORT}`));
