/**
 * ranking.js
 * Corsaro Brain — Ranking Ultra-Intelligente
 */

const DEFAULT_CONFIG = {
  weights: {
    languageITA: 5000,
    languageMULTI: 3000,
    quality4K: 1200,
    quality1080p: 800,
    exactEpisodeBoost: 5000,
    packPenalty: -2000,
    camPenalty: -10000,
    sourceCorsaroBonus: 1000,
    seedersFactor: 1.0,
    seedersTrustBoost: 200,
    seedersTrustThreshold: 50,
    ageDecayPerDay: -2,
    sizeMismatchPenalty: -1500,
    hashKnownBonus: 2500,
    groupReputationFactor: 1.0,
    userReportPenalty: -4000,
    freshnessBoostHours: 48,
    freshnessBoostValue: 500
  },
  heuristics: {
    camRegex: /\b(cam|ts|telecine|telesync|camrip|cam\.)\b/i,
    packRegex: /\b(pack|complete|full ?season|season ?pack|stagione ?completa)\b/i,
    itaPatterns: [
      /\b(ITA|ITALIAN|IT)\b/i,
      /\b(SUB.?ITA|SOTTOTITOLI.?ITA)\b/i,
      /\b(VO.?ITA|AUD.?ITA)\b/i
    ],
    multiPatterns: [/\b(MULTI|MULTILANG|MULTILANGUAGE|ITA ENG|ITA-ENG)\b/i],
    sizeToleranceRatio: 0.25,
    minimalSizeBytes: 512 * 1024
  },
  trust: {
    sourceTrust: {
      "Corsaro": 0.9,
      "1337x": 0.7,
      "ThePirateBay": 0.7
    },
    groupReputation: {
      "YTS": 0.9,
      "RARBG": 0.85,
      "FAKEGRP": -0.8
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

function qualityScoreFromTitle(title, config) {
  const t = (title || "").toLowerCase();
  if (/(2160p|4k|uhd)/i.test(t)) return config.weights.quality4K;
  if (/1080p/i.test(t)) return config.weights.quality1080p;
  return 0;
}

function sizeConsistencyPenalty(item, meta, config) {
  const sizeBytes = parseSizeToBytes(item.size || item.sizeBytes || 0);
  if (!sizeBytes) return 0;
  if (sizeBytes < config.heuristics.minimalSizeBytes) return config.weights.sizeMismatchPenalty;
  if (isPack(item.title, config) && sizeBytes < 50 * 1024 * 1024) return config.weights.sizeMismatchPenalty;
  return 0;
}

function seedersScore(item, config) {
  const s = normalizeNumber(item.seeders);
  const p = normalizeNumber(item.peers);
  let base = 0;
  if (s > 0) {
    base = Math.log10(s + 1) * config.weights.seedersFactor * 100;
  }
  if (s > config.weights.seedersTrustThreshold && (p / (s + 1) > 0.05)) {
    base += config.weights.seedersTrustBoost;
  }
  if (s > 5000 && p < 10) base -= 2000;
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

function freshnessBonus(item, config) {
  const now = config.misc.nowTimestamp();
  if (!item.published) return 0;
  const published = Date.parse(item.published);
  const hours = (now - published) / (1000 * 60 * 60);
  if (hours < config.weights.freshnessBoostHours) return config.weights.freshnessBoostValue;
  return 0;
}

function exactEpisodeBoost(item, meta, config) {
  if (!meta || !meta.isSeries) return 0;
  const sStr = String(meta.season).padStart(2, "0");
  const eStr = String(meta.episode).padStart(2, "0");
  try {
    const title = item.title || "";
    const exactEpRegex = new RegExp(`S${sStr}[^0-9]*E${eStr}`, "i");
    const xEpRegex = new RegExp(`${meta.season}x${eStr}`, "i");
    if (exactEpRegex.test(title) || xEpRegex.test(title)) return config.weights.exactEpisodeBoost;
    if (isPack(title, config)) return config.weights.packPenalty;
  } catch (e) { }
  return 0;
}

function camAndQualityPenalty(item, config) {
  const title = item.title || "";
  if (isLikelyCam(title, config)) return config.weights.camPenalty;
  return 0;
}

function sourceTrustBonus(item, config) {
  const s = (item.source || "").toString();
  const trust = config.trust.sourceTrust[s] || 0;
  return Math.round((trust || 0) * 1000);
}

function groupReputationScore(item, config) {
  const grp = (item.group || "").toString();
  if (!grp) return 0;
  const rep = config.trust.groupReputation[grp] || 0;
  return Math.round(rep * config.weights.groupReputationFactor * 1000);
}

function hashKnownBonus(item, knownHashesSet, config) {
  const h = extractHashFromMagnet(item.magnet) || item.hash;
  if (!h) return 0;
  if (knownHashesSet && knownHashesSet.has(h)) return config.weights.hashKnownBonus;
  return 0;
}

function userReportsPenalty(item, config) {
  try {
    const db = config.userReportsDB || {};
    const key = extractHashFromMagnet(item.magnet) || item.magnet;
    if (db[key] && db[key].reports) {
      const severity = db[key].severity || 1.0;
      return Math.round(config.weights.userReportPenalty * severity);
    }
  } catch (e) {}
  return 0;
}

function computeScore(item, meta, config, knownHashesSet) {
  let score = 0;
  const reasons = [];

  const langScore = languageScoreFromTitle(item.title, config);
  if (langScore) { score += langScore; reasons.push(`lang:${langScore}`); }

  const qScore = qualityScoreFromTitle(item.title, config);
  if (qScore) { score += qScore; reasons.push(`quality:${qScore}`); }

  const sScore = seedersScore(item, config);
  score += sScore; reasons.push(`seeders:${sScore}`);

  const src = sourceTrustBonus(item, config);
  if (src) { score += src; reasons.push(`sourceTrust:${src}`); }

  const gScore = groupReputationScore(item, config);
  if (gScore) { score += gScore; reasons.push(`groupRep:${gScore}`); }

  const aScore = ageScore(item, config);
  if (aScore) { score += aScore; reasons.push(`age:${aScore}`); }
  const fres = freshnessBonus(item, config);
  if (fres) { score += fres; reasons.push(`fresh:${fres}`); }

  const epBoost = exactEpisodeBoost(item, meta, config);
  if (epBoost) { score += epBoost; reasons.push(`ep/pack:${epBoost}`); }

  const cam = camAndQualityPenalty(item, config);
  if (cam) { score += cam; reasons.push(`camPenalty:${cam}`); }

  const sPenalty = sizeConsistencyPenalty(item, meta, config);
  if (sPenalty) { score += sPenalty; reasons.push(`sizePenalty:${sPenalty}`); }

  const hk = hashKnownBonus(item, knownHashesSet, config);
  if (hk) { score += hk; reasons.push(`knownHash:${hk}`); }

  const ur = userReportsPenalty(item, config);
  if (ur) { score += ur; reasons.push(`userReports:${ur}`); }

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
    if (size && size < config.heuristics.minimalSizeBytes) return false;
    return true;
  });

  const scored = prelim.map(item => {
    const { score, reasons } = computeScore(item, meta, config, knownHashesSet);
    item._score = score;
    item._reasons = reasons;
    return item;
  });

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
