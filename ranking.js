/**
 * ranking.js
 * Corsaro Brain — Ranking Ultra-Intelligente (Optimized for Quality First)
 */

const DEFAULT_CONFIG = {
  weights: {
    // 🔥 PRIORITÀ ASSOLUTA ALLA LINGUA
    // I valori sono altissimi per garantire che l'ITA vinca sempre
    languageITA: 50000,      
    languageMULTI: 25000,
    
    // 🔥 TIER QUALITÀ (GERARCHIA RIGIDA)
    // Lo scarto di 5000 punti tra una risoluzione e l'altra è incolmabile dai seeders
    quality4K: 15000,
    quality1080p: 10000,
    quality720p: 5000,
    
    // Bonus Qualità Aggiuntivi
    hevcBonus: 1500,          // Premia x265/HEVC (miglior rapporto qualità/peso)
    hdrBonus: 1000,           // Premia HDR/Dolby Vision
    
    // Episodi e Pack
    exactEpisodeBoost: 20000, // Fondamentale per trovare l'episodio giusto
    seasonPackBonus: 10000,   // Bonus per i pack di stagione
    
    // Penalità
    camPenalty: -100000,      // CAM/TS vengono affossati
    sizeMismatchPenalty: -5000,
    
    // 🔥 SEEDERS DEPOTENZIATI (SOLO SPAREGGIO)
    sourceCorsaroBonus: 2000,
    seedersFactor: 0.1,       // Fattore ridotto drasticamente (era 2.0)
    seedersTrustBoost: 100,
    
    // Età (Impatto minimo)
    ageDecayPerDay: -0.1,    
    
    // Varie
    hashKnownBonus: 2000,
    groupReputationFactor: 0.5,
  },
  heuristics: {
    camRegex: /\b(cam|ts|telecine|telesync|camrip|cam\.|hdcam|hdtc)\b/i,
    
    packRegex: /\b(pack|complete|tutta|tutte|full ?season|season ?pack|stagione ?(completa)?)\b/i,
    
    // Regex potente per rilevare l'italiano
    itaPatterns: [
      /\b(ITA(LIANO)?|MULTI|DUAL|MD|SUB\.?ITA|SUB-?ITA|ITALUB|FORCED|AC3\.?ITA|DTS\.?ITA|AUDIO\.?ITA|ITA\.?AC3|ITA\.?HD|BDMUX|DVDRIP\.?ITA|CiNEFiLE|NovaRip|MeM|robbyrs|iDN_CreW|SPEEDVIDEO|WMS|TRIDIM)\b/i
    ],
    
    multiPatterns: [/\b(MULTI|MULTILANG|MULTILANGUAGE|ITA.ENG|ITA-ENG)\b/i],
    sizeToleranceRatio: 0.25,
    minimalSizeBytes: 150 * 1024 * 1024 // 150MB minimo
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
  for (const p of config.heuristics.itaPatterns) {
    if (p.test(title)) return config.weights.languageITA;
  }
  for (const p of config.heuristics.multiPatterns) {
    if (p.test(title)) return config.weights.languageMULTI;
  }
  return 0;
}

// 🔥 CALCOLO QUALITÀ AGGIORNATO (Supporto HDR/DV)
function qualityScoreFromTitle(title, config) {
  const t = (title || "").toLowerCase();
  let score = 0;
  
  // 1. Risoluzione (Base del Tier)
  if (/(2160p|4k|uhd)/i.test(t)) score += config.weights.quality4K;
  else if (/1080p/i.test(t)) score += config.weights.quality1080p;
  else if (/720p/i.test(t)) score += config.weights.quality720p;

  // 2. Codec (Bonus)
  if (/(x265|h265|hevc)/i.test(t)) score += config.weights.hevcBonus;

  // 3. HDR / Dolby Vision (Nuovo Bonus)
  if (/(hdr|dolby|vision|\bdv\b)/i.test(t)) score += config.weights.hdrBonus;

  return score;
}

function sizeConsistencyPenalty(item, meta, config) {
  const sizeBytes = parseSizeToBytes(item.size || item.sizeBytes || 0);
  if (!sizeBytes) return 0;
  if (sizeBytes < config.heuristics.minimalSizeBytes) return config.weights.sizeMismatchPenalty;
  return 0;
}

// 🔥 CALCOLO SEEDERS AGGIORNATO (Depotenziato)
function seedersScore(item, config) {
  const s = normalizeNumber(item.seeders);
  if (s <= 0) return 0;
  
  // Logica appiattita: i seeders sono solo uno spareggio (max ~200-300 punti).
  // Non possono mai colmare il divario di 5000 punti tra le risoluzioni.
  let base = Math.log10(s + 1) * config.weights.seedersFactor * 100;
  
  // Piccolo boost se ci sono molti seeders (segno di salute), ma sempre contenuto
  if (s > 50) base += config.weights.seedersTrustBoost;
  
  return Math.round(base);
}

function ageScore(item, config) {
  const now = config.misc.nowTimestamp();
  let published = item.published ? Date.parse(item.published) : null;
  if (!published && item.ageSeconds) published = now - (item.ageSeconds * 1000);
  if (!published) return 0;
  
  const days = Math.max(0, Math.floor((now - published) / (1000 * 60 * 60 * 24)));
  return Math.round(config.weights.ageDecayPerDay * days);
}

function exactEpisodeBoost(item, meta, config) {
  if (!meta || !meta.isSeries) return 0;
  
  const s = meta.season;
  const e = meta.episode;
  const title = (item.title || "").toUpperCase();

  const exactEpRegex = new RegExp(`S0?${s}[^0-9]*E0?${e}\\b`, "i");
  const xEpRegex = new RegExp(`\\b${s}x0?${e}\\b`, "i");
  
  if (exactEpRegex.test(title) || xEpRegex.test(title)) {
      return config.weights.exactEpisodeBoost;
  }

  if (isPack(title, config)) {
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
  const key = Object.keys(config.trust.sourceTrust).find(k => s.includes(k));
  if (key) {
      return Math.round(config.trust.sourceTrust[key] * config.weights.sourceCorsaroBonus);
  }
  return 0;
}

function computeScore(item, meta, config, knownHashesSet) {
  let score = 0;
  const reasons = [];

  // 1. Lingua (Peso Massimo - Intoccabile)
  const langScore = languageScoreFromTitle(item.title, config);
  if (langScore) { score += langScore; reasons.push(`lang:${langScore}`); }

  // 2. Episodio o Pack (Critico per le serie)
  const epBoost = exactEpisodeBoost(item, meta, config);
  if (epBoost) { score += epBoost; reasons.push(`ep/pack:${epBoost}`); }

  // 3. Qualità (Determinante per l'ordinamento visivo)
  const qScore = qualityScoreFromTitle(item.title, config);
  if (qScore) { score += qScore; reasons.push(`quality:${qScore}`); }

  // 4. Seeders (Solo Spareggio)
  const sScore = seedersScore(item, config);
  score += sScore; reasons.push(`seeders:${sScore}`);

  // 5. Fonte & Trust
  const src = sourceTrustBonus(item, config);
  if (src) { score += src; reasons.push(`sourceTrust:${src}`); }

  // 6. Penalità e Correzioni
  const aScore = ageScore(item, config);
  if (aScore) { score += aScore; reasons.push(`age:${aScore}`); }

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

  score += Math.min(100, (item.title || "").length);

  return { score, reasons };
}

function rankAndFilterResults(results = [], meta = {}, optConfig = {}, knownHashesSet = null) {
  const config = mergeDeep(DEFAULT_CONFIG, optConfig || {});

  if (!Array.isArray(results)) return [];

  const prelim = results.filter(it => {
    if (!it) return false;
    if (!it.magnet && !it.url) return false;
    
    const size = parseSizeToBytes(it.size || it.sizeBytes || 0);
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
