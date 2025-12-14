const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const axios = require("axios");
const Bottleneck = require("bottleneck");
const rateLimit = require("express-rate-limit");
const { LRUCache } = require("lru-cache"); 

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

const { getManifest } = require("./manifest");

// --- CONFIGURAZIONE ---
const CONFIG = {
  CINEMETA_URL: "https://v3-cinemeta.strem.io",
  REAL_SIZE_FILTER: 80 * 1024 * 1024, // Filtra file troppo piccoli (sample)
  TIMEOUT_TMDB: 2000,
  SCRAPER_TIMEOUT: 6000, 
  MAX_RESULTS: 40, 
};

// --- STATIC REGEX PATTERNS (Performance Boost) ---
const REGEX_YEAR = /(19|20)\d{2}/;
const REGEX_QUALITY = {
    "4K": /2160p|4k|uhd/i,
    "1080p": /1080p/i,
    "720p": /720p/i,
    "SD": /480p|\bsd\b/i
};
const REGEX_AUDIO = {
    channels: /\b(7\.1|5\.1|2\.1|2\.0)\b/,
    atmos: /atmos/i, // Atmos puro
    dtsx: /dts[:\s-]?x/i, // DTS:X
    truehd: /truehd/i, // TrueHD (senza Atmos)
    dtshd: /\bdts-?hd\b|\bma\b/i, // DTS-HD MA
    dts: /\bdts\b/i,
    ddp: /\bddp\b|\beac-?3\b|\bdolby\s?digital\s?plus\b/i, // Dolby Digital Plus
    dolby: /\bac-?3\b|\bdd\b|\bdolby\b/i, // Dolby Standard
    aac: /\baac\b/i,
    flac: /\bflac\b/i // Alta fedeltà
};

const REGEX_ITA = [
    // 1. Termini Generici e Audio Esplicito
    /\b(ITA|ITALIAN|ITALY)\b/i,
    /\b(AUDIO|LINGUA)\s*[:\-]?\s*(ITA|IT)\b/i, // Es: "Audio: ITA"
    
    // 2. Formati Audio accoppiati a ITA (Più robusto)
    /\b(AC-?3|AAC|DDP?|DTS|PCM|TRUEHD|ATMOS|MP3|WMA|FLAC).*(ITA|IT)\b/i,
    /\b(DD|DDP|AAC|DTS)\s*5\.1\s*(ITA|IT)\b/i, // Es: "DD5.1 ITA"
    
    // 3. Multi/Dual Audio (Spesso include ITA)
    /\b(MULTI|DUAL|TRIPLE).*(ITA|IT)\b/i,
    
    // 4. Sottotitoli (Se vuoi includere chi ha solo i sub, tieni questa, altrimenti rimuovi)
    /\b(SUB|SUBS|SOTTOTITOLI).*(ITA|IT)\b/i,
    
    // 5. Codec Video accoppiati a ITA
    /\b(H\.?264|H\.?265|X264|X265|HEVC|AVC|DIVX|XVID).*(ITA|IT)\b/i,
    
    // 6. Crew e Release Group Italiani (ELENCO AGGIORNATO)
    // Aggiunti: EAGLE, TRL, MEA, LUX, DNA, LEST, GHIZZO, USAbit, etc.
    /\b(iDN_CreW|CORSARO|MUX|WMS|TRIDIM|SPEEDVIDEO|EAGLE|TRL|MEA|LUX|DNA|LEST|GHIZZO|USAbit|Bric|Dtone|Gaiage|BlackBit|Pantry|Vics|Papeete)\b/i,
    
    // 7. Termini Serie TV Italiani
    /\b(STAGIONE|EPISODIO|SERIE COMPLETA|STAGIONE COMPLETA)\b/i
];
const REGEX_CLEANER = /\b(ita|eng|ger|fre|spa|latino|rus|sub|h264|h265|x264|x265|hevc|avc|vc1|1080p|1080i|720p|480p|4k|2160p|uhd|sdr|hdr|hdr10|dv|dolby|vision|bluray|bd|bdrip|brrip|web-?dl|webrip|hdtv|rip|remux|mux|ac-?3|aac|dts|ddp|flac|truehd|atmos|multi|dual|complete|pack|amzn|nf|dsnp|hmax|atvp|apple|hulu|peacock|rakuten|iyp|dvd|dvdrip|unrated|extended|director|cut)\b.*/yi;

// --- CACHE SYSTEM (AGGIORNATO CON LRU-CACHE) ---
const STREAM_CACHE = new LRUCache({
    max: 1000,              // Massimo 1000 stream in memoria (protezione crash)
    ttl: 15 * 60 * 1000,    // 15 minuti di vita
    allowStale: false,
    updateAgeOnGet: true    // Rinnova il TTL se viene richiesto di nuovo
});

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

    // 1. Rilevamento Canali
    const channelMatch = t.match(REGEX_AUDIO.channels);
    let channels = channelMatch ? channelMatch[1] : "";

    // Trasforma "2.0" in stringa vuota 
    
    if (channels === "2.0") channels = ""; 

    // 2. Rilevamento Codec in ordine di "Potenza" (Priority Check)
    let audioTag = "";

    if (REGEX_AUDIO.atmos.test(t)) {
        audioTag = "💣 Atmos"; // Top Tier
    } else if (REGEX_AUDIO.dtsx.test(t)) {
        audioTag = "💣 DTS:X"; // Top Tier
    } else if (REGEX_AUDIO.truehd.test(t)) {
        audioTag = "🔊 TrueHD"; // Lossless
    } else if (REGEX_AUDIO.dtshd.test(t)) {
        audioTag = "🔊 DTS-HD"; // Lossless
    } else if (REGEX_AUDIO.ddp.test(t)) {
        audioTag = "🔊 Dolby+"; // Better than AC3
    } else if (REGEX_AUDIO.dts.test(t)) {
        audioTag = "🔊 DTS";
    } else if (REGEX_AUDIO.flac.test(t)) {
        audioTag = "🎼 FLAC"; // Audiophile
    } else if (REGEX_AUDIO.dolby.test(t)) {
        audioTag = "🔈 Dolby"; // Standard
    } else if (REGEX_AUDIO.aac.test(t)) {
        audioTag = "🔈 AAC";
    } else if (/\bmp3\b/i.test(t)) {
        audioTag = "🔈 MP3";
    }

    // 3. Composizione Finale
    // Se non trova codec ma ci sono canali > 2, assume Surround
    if (!audioTag && (channels === "5.1" || channels === "7.1")) {
        audioTag = "🔊 Surround";
    }

    // Se non trova nulla o solo 2.0
    if (!audioTag) {
        return "🔈 Stereo";
    }

    // Unisce Codec + Canali (es: "💣 Atmos 7.1")
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

    // --- 1. FORMATTAZIONE DATI ---
    const sizeStr = size ? `🧲 ${formatBytes(size)}` : "🧲 ?";
    const seedersStr = seeders != null ? `👤 ${seeders}` : "";

    // --- 2. LINGUA SMART ---
    let langStr = "🌐 ?";
    if (/ita|it\b|italiano/i.test(lang || "")) langStr = "🗣️ ITA";
    else if (/multi/i.test(lang || "")) langStr = "🗣️ MULTI";
    else if (lang) langStr = `🗣️ ${lang.toUpperCase()}`;

    // --- 3. GESTIONE SOURCE E SERVICE ---
    let displaySource = source;
    // Rinomina Corsaro
    if (/corsaro/i.test(displaySource)) {
        displaySource = "ilCorSaRoNeRo";
    }
    
    // Uniamo il Tag del servizio (RD) alla source per pulire il badge
    // Esempio output: "⚡ [RD] ilCorSaRoNeRo"
    const sourceLine = `⚡ [${serviceTag}] ${displaySource}`;

    // --- 4. HEADER (BADGE "LEVIATHAN") ---
    // Qui avviene la magia: Nome Addon + Qualità
    // Usa 🦑 (Calamaro) o 🐲 (Drago) o 🔱 (Tridente) a tua scelta
    const name = `🦑 LEVIATHAN\n${qIcon} ${quality}`; 

    // --- 5. PULIZIA TITOLO ---
    const cleanName = cleanFilename(fileTitle)
        .replace(/(s\d{1,2}e\d{1,2}|\d{1,2}x\d{1,2}|s\d{1,2})/ig, "")
        .replace(/\s{2,}/g, " ")
        .trim();

    const epTag = getEpisodeTag(fileTitle);

    // --- 6. COSTRUZIONE RIGHE ---
    const lines = [];

    // RIGA 1: Titolo
    lines.push(`🎬 ${cleanName}${epTag ? ` ${epTag}` : ""}`);

    // RIGA 2: Lingua e Audio
    const audioLine = [langStr, audioInfo].filter(Boolean).join(" • ");
    if (audioLine) lines.push(audioLine);

    // RIGA 3: Info Video
    const cleanInfo = info ? info.replace("🖥️ ", "") : "";
    if (cleanInfo) lines.push(`🎞️ ${cleanInfo}`);

    // RIGA 4: Size e Seeders
    const techLine = [sizeStr, seedersStr].filter(Boolean).join(" • ");
    if (techLine) lines.push(techLine);

    // RIGA 5: Source + Service Tag (Ben visibile in fondo)
    if (sourceLine) lines.push(sourceLine);

    return {
        name,
        title: lines.join("\n")
    };
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
  
  let dynamicTitles = [];
  try {
      let tmdbIdForSearch = null;
      if (meta.imdb_id.startsWith("tt")) {
          const converted = await imdbToTmdb(meta.imdb_id);
          tmdbIdForSearch = converted.tmdbId;
      } else {
          tmdbIdForSearch = meta.imdb_id;
      }
      if (tmdbIdForSearch) {
          dynamicTitles = await getTmdbAltTitles(tmdbIdForSearch, type);
      }
  } catch (e) {
      console.log("Errore recupero titoli dinamici:", e.message);
  }

  const queries = generateSmartQueries(meta, dynamicTitles);
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

  resultsRaw = resultsRaw.filter(item => {
    if (!item?.magnet) return false;
    const fileYearMatch = item.title.match(REGEX_YEAR);
    if (fileYearMatch) {
        if (Math.abs(parseInt(fileYearMatch[0]) - parseInt(meta.year)) > 1) return false;
    }
    const isSemanticallySafe = smartMatch(meta.title, item.title, meta.isSeries, meta.season, meta.episode);
    if (!isSemanticallySafe) return false;
    if (onlyIta && !isSafeForItalian(item)) return false;
    return true;
  });

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

    // --- LOGICA CACHE AGGIORNATA ---
    if (STREAM_CACHE.has(cacheKey)) {
        console.log(`⚡ [CACHE HIT] Servo "${id}" dalla memoria.`);
        // LRU Cache gestisce il TTL automaticamente, restituiamo solo il valore
        return res.json(STREAM_CACHE.get(cacheKey));
    }

    const result = await generateStream(type, id.replace(".json", ""), getConfig(conf), conf);

    if (result && result.streams && result.streams.length > 0 && result.streams[0].name !== "⛔") {
        // Setta in cache (LRU gestisce eviction e scadenza)
        STREAM_CACHE.set(cacheKey, result);
    }
    res.json(result); 
});

function getConfig(configStr) { try { return JSON.parse(Buffer.from(configStr, "base64").toString()); } catch { return {}; } }
function withTimeout(promise, ms) { return Promise.race([promise, new Promise(r => setTimeout(() => r([]), ms))]); }

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Leviathan (God Tier) attivo su porta ${PORT}`));
