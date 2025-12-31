const EXTERNAL_ADDONS = {
    torrentio: {
        baseUrl: 'https://torrentio.strem.fun/providers=rarbg,1337x,ilcorsaronero%7Clanguage=italian%7Climit=5%7Cdebridoptions=nodownloadlinks',
        name: 'Torrentio',
        emoji: '🅣',
        timeout: 4500
    },
    mediafusion: {
        baseUrl: 'https://mediafusion.elfhosted.com/D-eX-S0MgfjbkgX-RCYPkCCvGKtrpBi3gaqyHsZS5HwxhrUYUDDvRwy4GhWUfcR6vbD6gw1fsASGluQzLWBphgGcBq_MmwGZwgKb24x7WlOO7OjmL6KfX3Zyg0mvIqGyajrkFQ7rld9uzzjph2jyNMAvFxF82F_-AmPIZ6xHreXztAADuN4rcro67zzvBhoNCJlXtsF5HrvmDedt4gTeeu-g',
        name: 'MediaFusion',
        emoji: '🅜',
        timeout: 4500
    },
    comet: {
        baseUrl: '',
        name: 'Comet',
        emoji: '🅒',
        timeout: 4500
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractInfoHash(stream) {
    if (stream.infoHash) {
        return stream.infoHash.toUpperCase();
    }
    if (stream.url && stream.url.includes('btih:')) {
        const match = stream.url.match(/btih:([A-Fa-f0-9]{40}|[A-Za-z2-7]{32})/i);
        if (match) return match[1].toUpperCase();
    }
    return null;
}

function extractQuality(text) {
    if (!text) return '';
    const qualityPatterns = [
        /\b(2160p|4k|uhd)\b/i,
        /\b(1080p)\b/i,
        /\b(720p)\b/i,
        /\b(480p|sd)\b/i
    ];
    for (const pattern of qualityPatterns) {
        const match = text.match(pattern);
        if (match) return match[1].toLowerCase();
    }
    return '';
}

function extractSeeders(text) {
    if (!text) return 0;
    const match = text.match(/👤\s*(\d+)|[Ss](?:eeders)?:\s*(\d+)/);
    if (match) return parseInt(match[1] || match[2]) || 0;
    return 0;
}

function extractSize(text) {
    if (!text) return { formatted: '', bytes: 0 };
    const match = text.match(/(?:📦|💾|Size:?)\s*([\d.,]+)\s*(B|KB|MB|GB|TB)/i);
    if (!match) return { formatted: '', bytes: 0 };

    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();

    const multipliers = { 'B': 1, 'KB': 1024, 'MB': 1024 ** 2, 'GB': 1024 ** 3, 'TB': 1024 ** 4 };
    const bytes = Math.round(value * (multipliers[unit] || 1));
    return { formatted: `${value} ${unit}`, bytes };
}

/**
 * [NUOVO] Estrazione "Forza Bruta" del Provider
 * Cerca prima i pattern noti di Torrentio, poi scansiona parole chiave.
 */
function extractOriginalProvider(text) {
    if (!text) return null;
    
    // 1. Pattern classici Torrentio/Stremio (Emoji)
    const torrentioMatch = text.match(/🔍\s*([^\n]+)/);
    if (torrentioMatch) return torrentioMatch[1].trim();

    const mfMatch = text.match(/🔗\s*([^\n]+)/);
    if (mfMatch) return mfMatch[1].trim();

    const cometMatch = text.match(/🔎\s*([^\n]+)/);
    if (cometMatch) return cometMatch[1].trim();

    // 2. DIZIONARIO PROVIDER (Case Insensitive)
    // Se non trova l'emoji, cerca queste parole nel testo.
    const knownProviders = [
        "ilCorSaRoNeRo", "Corsaro",
        "1337x", "1337X",
        "TorrentGalaxy", "TGX", "GalaxyRG",
        "RARBG", "Rarbg",
        "EZTV", "Eztv",
        "YTS", "YIFY",
        "MagnetDL",
        "TorLock",
        "PirateBay", "TPB", "ThePirateBay",
        "Nyaa",
        "RuTracker",
        "SolidTorrents",
        "KickAss", "KAT",
        "LimeTorrents",
        "Zooqle",
        "GloDLS",
        "TorrentDownload",
        "YourBittorrent",
        "BitSearch",
        "Knaben",
        "iDope",
        "TorrentFunk"
    ];

    const lowerText = text.toLowerCase();
    for (const provider of knownProviders) {
        // Cerca la parola chiave delimitata (evita falsi positivi parziali)
        // O semplicemente se è contenuta (più aggressivo)
        if (lowerText.includes(provider.toLowerCase())) {
            // Restituisce il nome formattato dalla lista, non quello trovato raw
            return provider;
        }
    }

    return null;
}

function extractFilename(stream) {
    if (stream.behaviorHints?.filename) {
        return stream.behaviorHints.filename;
    }
    const text = stream.title || stream.description || '';
    const match = text.match(/📄\s*([^\n]+)/);
    if (match) return match[1].trim();
    return stream.name || '';
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function fetchExternalAddon(addonKey, type, id) {
    const addon = EXTERNAL_ADDONS[addonKey];
    if (!addon) {
        console.error(`❌ [External] Unknown addon: ${addonKey}`);
        return [];
    }

    const url = `${addon.baseUrl}/stream/${type}/${id}.json`;
    console.log(`🌐 [${addon.name}] Fetching: ${type}/${id}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), addon.timeout);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'IlCorsaroViola/1.0 (Stremio Addon)',
                'Accept': 'application/json'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`❌ [${addon.name}] HTTP ${response.status}`);
            return [];
        }

        const data = await response.json();
        const streams = data.streams || [];
        console.log(`✅ [${addon.name}] Received ${streams.length} streams`);
        return streams.map(stream => normalizeExternalStream(stream, addonKey));

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`⏱️ [${addon.name}] Timeout after ${addon.timeout}ms`);
        } else {
            console.error(`❌ [${addon.name}] Error:`, error.message);
        }
        return [];
    }
}

function normalizeExternalStream(stream, addonKey) {
    const addon = EXTERNAL_ADDONS[addonKey];
    
    // Combina Titolo, Nome e Descrizione per cercare il provider ovunque
    const fullTextSearch = `${stream.title || ''} ${stream.name || ''} ${stream.description || ''}`;
    
    const infoHash = extractInfoHash(stream);
    const filename = extractFilename(stream);
    const quality = extractQuality(stream.name || filename || fullTextSearch);
    const sizeInfo = extractSize(fullTextSearch);
    const seeders = extractSeeders(fullTextSearch);
    
    // Estrae il provider originale usando la logica potenziata
    const originalProvider = extractOriginalProvider(fullTextSearch);

    let sizeBytes = sizeInfo.bytes;
    if (stream.behaviorHints?.videoSize) {
        sizeBytes = stream.behaviorHints.videoSize;
    }
    if (stream.video_size) {
        sizeBytes = stream.video_size;
    }

    return {
        infoHash: infoHash,
        fileIdx: stream.fileIdx ?? 0,
        title: filename,
        filename: filename,
        websiteTitle: filename,
        quality: quality || stream.resolution?.replace(/[^0-9kp]/gi, '') || '',
        size: sizeInfo.formatted || formatBytes(sizeBytes),
        mainFileSize: sizeBytes,
        seeders: seeders || stream.peers || 0,
        leechers: 0,
        // Qui salviamo il provider estratto (es. "1337x")
        externalProvider: originalProvider, 
        source: addon.name, // Fallback temporaneo
        sourceEmoji: addon.emoji,
        magnetLink: buildMagnetLink(infoHash, stream.sources),
        pubDate: new Date().toISOString()
    };
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function buildMagnetLink(infoHash, sources) {
    if (!infoHash) return null;
    let magnet = `magnet:?xt=urn:btih:${infoHash}`;
    if (sources && Array.isArray(sources)) {
        const trackers = sources
            .filter(s => s.startsWith('tracker:') || s.startsWith('udp://') || s.startsWith('http'))
            .map(s => s.replace(/^tracker:/, ''))
            .slice(0, 10);
        for (const tracker of trackers) {
            magnet += `&tr=${encodeURIComponent(tracker)}`;
        }
    }
    return magnet;
}

async function fetchAllExternalAddons(type, id, options = {}) {
    const enabledAddons = options.enabledAddons || Object.keys(EXTERNAL_ADDONS);
    console.log(`\n🔗 [External Addons] Fetching from: ${enabledAddons.join(', ')}`);
    const startTime = Date.now();
    const promises = enabledAddons.map(async (addonKey) => {
        const results = await fetchExternalAddon(addonKey, type, id);
        return { addonKey, results };
    });
    const settledResults = await Promise.allSettled(promises);
    const resultsByAddon = {};
    let totalResults = 0;
    for (const result of settledResults) {
        if (result.status === 'fulfilled') {
            const { addonKey, results } = result.value;
            resultsByAddon[addonKey] = results;
            totalResults += results.length;
        } else {
            console.error(`❌ [External] Promise rejected:`, result.reason);
        }
    }
    const elapsed = Date.now() - startTime;
    console.log(`✅ [External Addons] Total: ${totalResults} results in ${elapsed}ms`);
    return resultsByAddon;
}

async function fetchExternalAddonsFlat(type, id, options = {}) {
    const resultsByAddon = await fetchAllExternalAddons(type, id, options);
    const allResults = [];
    for (const addonKey of Object.keys(resultsByAddon)) {
        allResults.push(...resultsByAddon[addonKey]);
    }
    return allResults;
}

module.exports = {
    EXTERNAL_ADDONS,
    fetchExternalAddon,
    fetchAllExternalAddons,
    fetchExternalAddonsFlat,
    normalizeExternalStream,
    extractInfoHash
};
