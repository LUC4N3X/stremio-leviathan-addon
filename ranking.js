/**
 * ranking.js
 * Corsaro Brain — Ranking Ultra-Intelligente (Optimized for ITA & Debrid)
 */

const DEFAULT_CONFIG = {
  weights: {
    // 🔥 PRIORITÀ ASSOLUTA ALLA LINGUA
    languageITA: 10000,      // Aumentato drasticamente (era 5000)
    languageMULTI: 4000,
    
    // Qualità
    quality4K: 1500,
    quality1080p: 1000,
    quality720p: 500,
    hevcBonus: 800,          // Nuovo: premia x265/HEVC (qualità/peso migliore)
    
    // Episodi e Pack
    exactEpisodeBoost: 6000, // Se trovo S01E05 esatto
    seasonPackBonus: 3000,   // 🔥 NUOVO: Se trovo "Stagione 1" intera (ottimo per Debrid)
    
    // Penalità
    camPenalty: -20000,      // CAM/TS devono sparire in fondo
    sizeMismatchPenalty: -5000,
    
    // Trust e Seeders
    sourceCorsaroBonus: 2000,
    seedersFactor: 2.0,      // Seeders contano un po' di più
    seedersTrustBoost: 500,
    
    // Età (Ridotto impatto negativo per salvare roba vecchia ITA)
    ageDecayPerDay: -0.5,    // Era -2. Ora penalizza molto meno i torrent vecchi
    
    // Varie
    hashKnownBonus: 3000,
    groupReputationFactor: 1.0,
  },
  heuristics: {
    camRegex: /\b(cam|ts|telecine|telesync|camrip|cam\.|hdcam|hdtc)\b/i,
    // Pack regex migliorata
    packRegex: /\b(pack|complete|tutta|tutte|full ?season|season ?pack|stagione ?(completa)?)\b/i,
    
    // 🔥 COPY-PASTE DELLA REGEX POTENTE DI ENGINES.JS
    itaPatterns: [
      /\b(ITA(LIANO)?|MULTI|DUAL|MD|SUB\.?ITA|SUB-?ITA|ITALUB|FORCED|AC3\.?ITA|DTS\.?ITA|AUDIO\.?ITA|ITA\.?AC3|ITA\.?HD|BDMUX|DVDRIP\.?ITA|CiNEFiLE|NovaRip|MeM|robbyrs|iDN_CreW|SPEEDVIDEO|WMS|TRIDIM)\b/i
    ],
    
    multiPatterns: [/\b(MULTI|MULTILANG|MULTILANGUAGE|ITA.ENG|ITA-ENG)\b/i],
    sizeToleranceRatio: 0.25,
    minimalSizeBytes: 150 * 1024 * 1024 // 150MB minimo (filtra sample e fake)
  },
  trust: {
    sourceTrust: {
      "Corsaro": 1.0,
      "TorrentBay": 0.9,
      "1337x": 0.7,
      "ThePirateBay": 0.6
    },
    groupReputation: {
      "YTS": 0.8,
      "RARBG": 0.9,
      "eztv": 0.8,
      "FAKEGRP": -1.0
    }
  },
  userReportsDB: {},
  misc: {
    nowTimestamp: () => Date.now()
  }
};

function normalizeNumber(n) {
  const x = parseFloat(n);
  return isNaN(x) ? 0 : x;
}

function parseSizeToBytes(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  const m = s.match(/([\d,.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!m) {
    const num = parseFloat(s.replace(/[^\d.]/g, ""));
    return isNaN(num) ? 0 : num;
  }
  const val = parseFloat(m[1].replace(",", "."));
  const unit = m[2].toUpperCase();
  const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return Math.round((mult[unit] || 1) * val);
}

function extractHashFromMagnet(magnet) {
  if (!magnet) return null;
  const m = magnet.match(/btih:([a-f0-9]{40})/i);
  return m ? m[1].toUpperCase() : null;
}

function isLikelyCam(title, config) {
  return config.heuristics.camRegex.test(title || "");
}

function isPack(title, config) {
  return config.heuristics.packRegex.test(title || "");
}

function languageScoreFromTitle(title, config) {
  if (!title) return 0;
  // Controllo regex unificata potente
  for (const p of config.heuristics.itaPatterns) {
    if (p.test(title)) return config.weights.languageITA;
  }
  for (const p of config.heuristics.multiPatterns) {
    if (p.test(title)) return config.weights.languageMULTI;
  }
  return 0;
}

function qualityScoreFromTitle(title, config) {
  const t = (title || "").toLowerCase();
  let score = 0;
  
  // Risoluzione
  if (/(2160p|4k|uhd)/i.test(t)) score += config.weights.quality4K;
  else if (/1080p/i.test(t)) score += config.weights.quality1080p;
  else if (/720p/i.test(t)) score += config.weights.quality720p;

  // Codec Bonus (HEVC è meglio per lo streaming)
  if (/(x265|h265|hevc)/i.test(t)) score += config.weights.hevcBonus;

  return score;
}

function sizeConsistencyPenalty(item, meta, config) {
  const sizeBytes = parseSizeToBytes(item.size || item.sizeBytes || 0);
  if (!sizeBytes) return 0;
  
  // Se è troppo piccolo è fake o sample
  if (sizeBytes < config.heuristics.minimalSizeBytes) return config.weights.sizeMismatchPenalty;
  
  return 0;
}

function seedersScore(item, config) {
  const s = normalizeNumber(item.seeders);
  const p = normalizeNumber(item.peers);
  let base = 0;
  
  // Logarithmic boost: 100 seeders non valgono 10 volte 10 seeders
  if (s > 0) {
    base = Math.log10(s + 1) * config.weights.seedersFactor * 100;
  }
  
  // Trust boost se ratio è sano
  if (s > 50 && (p / (s + 1) < 2.0)) { // Ratio leecher/seeder non sospetto
    base += config.weights.seedersTrustBoost;
  }
  
  // Fake seeders detection (es. 5000 seeders e 0 leecher su file sconosciuti)
  if (s > 5000 && p < 5) base -= 2000;
  
  return Math.round(base);
}

function ageScore(item, config) {
  const now = config.misc.nowTimestamp();
  let published = item.published ? Date.parse(item.published) : null;
  if (!published && item.ageSeconds) published = now - (item.ageSeconds * 1000);
  if (!published) return 0;
  
  const days = Math.max(0, Math.floor((now - published) / (1000 * 60 * 60 * 24)));
  // Penalità ridotta per l'età
  return Math.round(config.weights.ageDecayPerDay * days);
}

// 🔥 LOGICA CHIAVE PER SERIE TV 🔥
function exactEpisodeBoost(item, meta, config) {
  if (!meta || !meta.isSeries) return 0;
  
  const s = meta.season;
  const e = meta.episode;
  const sStr = String(s).padStart(2, "0");
  const eStr = String(e).padStart(2, "0");
  const title = (item.title || "").toUpperCase();

  // 1. Match Esatto (S01E05)
  const exactEpRegex = new RegExp(`S0?${s}[^0-9]*E0?${e}\\b`, "i");
  const xEpRegex = new RegExp(`\\b${s}x0?${e}\\b`, "i");
  
  if (exactEpRegex.test(title) || xEpRegex.test(title)) {
      return config.weights.exactEpisodeBoost;
  }

  // 2. Match Pack Stagione (S01 Pack / Stagione 1 Completa)
  // Per Debrid questo è un bonus, non una penalità!
  if (isPack(title, config)) {
      // Verifica se il pack contiene la stagione che cerchiamo
      const seasonPackRegex = new RegExp(`(S0?${s}|Stagione\\s?0?${s}|Season\\s?0?${s})\\b`, "i");
      if (seasonPackRegex.test(title)) {
          return config.weights.seasonPackBonus;
      }
  }

  return 0;
}

function camAndQualityPenalty(item, config) {
  const title = item.title || "";
  if (isLikelyCam(title, config)) return config.weights.camPenalty;
  return 0;
}

function sourceTrustBonus(item, config) {
  const s = (item.source || "").toString();
  // Cerca parziale (es. "Corsaro" dentro "CorsaroNero")
  const key = Object.keys(config.trust.sourceTrust).find(k => s.includes(k));
  if (key) {
      return Math.round(config.trust.sourceTrust[key] * config.weights.sourceCorsaroBonus);
  }
  return 0;
}

function groupReputationScore(item, config) {
  const grp = (item.group || "").toString();
  if (!grp) return 0;
  const rep = config.trust.groupReputation[grp] || 0;
  return Math.round(rep * config.weights.groupReputationFactor * 1000);
}

function computeScore(item, meta, config, knownHashesSet) {
  let score = 0;
  const reasons = [];

  // 1. Lingua (Peso Massimo)
  const langScore = languageScoreFromTitle(item.title, config);
  if (langScore) { score += langScore; reasons.push(`lang:${langScore}`); }

  // 2. Episodio o Pack (Critico per le serie)
  const epBoost = exactEpisodeBoost(item, meta, config);
  if (epBoost) { score += epBoost; reasons.push(`ep/pack:${epBoost}`); }

  // 3. Qualità
  const qScore = qualityScoreFromTitle(item.title, config);
  if (qScore) { score += qScore; reasons.push(`quality:${qScore}`); }

  // 4. Seeders (Importante ma meno della lingua)
  const sScore = seedersScore(item, config);
  score += sScore; reasons.push(`seeders:${sScore}`);

  // 5. Fonte
  const src = sourceTrustBonus(item, config);
  if (src) { score += src; reasons.push(`sourceTrust:${src}`); }

  // 6. Età (Decay leggero)
  const aScore = ageScore(item, config);
  if (aScore) { score += aScore; reasons.push(`age:${aScore}`); }

  // 7. Penalità CAM/Size
  const cam = camAndQualityPenalty(item, config);
  if (cam) { score += cam; reasons.push(`camPenalty:${cam}`); }

  const sPenalty = sizeConsistencyPenalty(item, meta, config);
  if (sPenalty) { score += sPenalty; reasons.push(`sizePenalty:${sPenalty}`); }

  // Bonus Hash noto
  const hk = extractHashFromMagnet(item.magnet);
  if (hk && knownHashesSet && knownHashesSet.has(hk)) {
      score += config.weights.hashKnownBonus;
      reasons.push(`knownHash`);
  }

  // Bonus lunghezza titolo (titoli descrittivi spesso migliori)
  score += Math.min(100, (item.title || "").length);

  return { score, reasons };
}

function rankAndFilterResults(results = [], meta = {}, optConfig = {}, knownHashesSet = null) {
  const config = mergeDeep(DEFAULT_CONFIG, optConfig || {});

  if (!Array.isArray(results)) return [];

  const prelim = results.filter(it => {
    if (!it) return false;
    if (!it.magnet && !it.url) return false;
    
    // Filtro dimensione minima (evita fake da 1KB)
    const size = parseSizeToBytes(it.size || it.sizeBytes || 0);
    // Tolleranza: se non c'è size (0), lo teniamo e ci fidiamo degli altri parametri
    if (size > 0 && size < config.heuristics.minimalSizeBytes) return false;
    
    return true;
  });

  const scored = prelim.map(item => {
    const { score, reasons } = computeScore(item, meta, config, knownHashesSet);
    item._score = score;
    item._reasons = reasons;
    return item;
  });

  // Ordina per score decrescente
  scored.sort((a, b) => b._score - a._score);
  return scored;
}

function isObject(x) { return x && typeof x === "object" && !Array.isArray(x); }

function mergeDeep(target, source) {
  if (!isObject(target)) return source;
  if (!isObject(source)) return target;
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (isObject(source[k])) {
      out[k] = mergeDeep(target[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

module.exports = {
  rankAndFilterResults,
  DEFAULT_CONFIG
};
