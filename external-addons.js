const axios = require("axios");

// --- CONFIGURAZIONE ADDON ESTERNI ---
const EXTERNAL_ADDONS = {
    torrentio: {
        // Configurazione UNICA richiesta
        baseUrls: [
            // URL Aggiornato 
            'https://torrentio.stremioluca.dpdns.org/oResults=false/aHR0cHM6Ly90b3JyZW50aW8uc3RyZW0uZnVuL3Byb3ZpZGVycz15dHMsZXp0dixyYXJiZywxMzM3eCx0aGVwaXJhdGViYXksa2lja2Fzc3RvcnJlbnRzLHRvcnJlbnRnYWxheHksbWFnbmV0ZGwsaG9ycmlibGVzdWJzLG55YWFzaSx0b2t5b3Rvc2hvLGFuaWRleCxydXRvcixydXRyYWNrZXIsY29tYW5kbyxibHVkdix0b3JyZW50OSxpbGNvcnNhcm9uZXJvLG1lam9ydG9ycmVudCx3b2xmbWF4NGssY2luZWNhbGlkYWQsYmVzdHRvcnJlbnRzfGxhbmd1YWdlPWl0YWxpYW4='
        ],
        name: 'Torrentio',
        emoji: '🅣',
        timeout: 4000 
    }
    
};

// ============================================================================

// HELPER FUNCTIONS

// Regex per rilevare contenuto Italiano
const REGEX_STRICT_ITA = /\b(ITA|ITALIAN|ITALY|IT|SUB\s*ITA|VOST|VOSTIT)\b/i;

function isItalianContent(stream) {
    const fullText = (
        (stream.title || "") + " " + 
        (stream.name || "") + " " + 
        (stream.description || "") + " " +
        (stream.behaviorHints?.filename || "")
    ).toUpperCase();

    if (REGEX_STRICT_ITA.test(fullText)) return true;
    if (/CORSARO|ICV|MEGAPHONE|IDN_CREW|MUX|DDN|ITALIAN/.test(fullText)) return true;

    return false;
}

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

function extractOriginalProvider(text) {
    if (!text) return null;
    
    const torrentioMatch = text.match(/🔍\s*([^\n]+)/);
    if (torrentioMatch) return torrentioMatch[1].trim();

    const mfMatch = text.match(/🔗\s*([^\n]+)/);
    if (mfMatch) return mfMatch[1].trim();

    const cometMatch = text.match(/🔎\s*([^\n]+)/);
    if (cometMatch) return cometMatch[1].trim();

    const knownProviders = [
        "ilCorSaRoNeRo", "Corsaro", "1337x", "1337X", "TorrentGalaxy", "TGX", "GalaxyRG",
        "RARBG", "Rarbg", "EZTV", "Eztv", "YTS", "YIFY", "MagnetDL", "TorLock",
        "PirateBay", "TPB", "ThePirateBay", "Nyaa", "RuTracker", "SolidTorrents",
        "KickAss", "KAT", "LimeTorrents", "Zooqle", "GloDLS", "TorrentDownload",
        "YourBittorrent", "BitSearch", "Knaben", "iDope", "TorrentFunk"
    ];

    const lowerText = text.toLowerCase();
    for (const provider of knownProviders) {
        if (lowerText.includes(provider.toLowerCase())) {
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

function normalizeExternalStream(stream, addonKey) {
    const addon = EXTERNAL_ADDONS[addonKey];
    const fullTextSearch = `${stream.title || ''} ${stream.name || ''} ${stream.description || ''}`;
    
    const infoHash = extractInfoHash(stream);
    const filename = extractFilename(stream);
    const quality = extractQuality(stream.name || filename || fullTextSearch);
    const sizeInfo = extractSize(fullTextSearch);
    const seeders = extractSeeders(fullTextSearch);
    const originalProvider = extractOriginalProvider(fullTextSearch);

    let sizeBytes = sizeInfo.bytes;
    if (stream.behaviorHints?.videoSize) sizeBytes = stream.behaviorHints.videoSize;
    if (stream.video_size) sizeBytes = stream.video_size;

    let fileIndex = undefined;
    if (stream.fileIdx !== undefined && stream.fileIdx !== null) {
        fileIndex = stream.fileIdx;
    }

    return {
        infoHash: infoHash,
        fileIdx: fileIndex, 
        title: filename,
        filename: filename,
        websiteTitle: filename,
        quality: quality || stream.resolution?.replace(/[^0-9kp]/gi, '') || '',
        size: sizeInfo.formatted || formatBytes(sizeBytes),
        mainFileSize: sizeBytes,
        seeders: seeders || stream.peers || 0,
        leechers: 0,
        externalProvider: originalProvider, 
        source: addon.name,
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

// ============================================================================

// MAIN FUNCTIONS (CORRETTA E POTENZIATA)
async function fetchExternalAddon(addonKey, type, id) {
    const addon = EXTERNAL_ADDONS[addonKey];
    if (!addon) {
        // Se l'addon è stato rimosso dalla config (es. MediaFusion), non facciamo nulla
        // console.error(`❌ [External] Unknown addon: ${addonKey}`);
        return [];
    }

    // --- LOGICA KITSU/ANIME (COMPATIBILE CON ADDON.JS) ---
    let fetchType = type;
    if (type === 'anime' || id.toString().startsWith('kitsu:')) {
        if (fetchType === 'anime') fetchType = 'series';
    }

    const urlsToTry = [];
    if (addon.baseUrls && Array.isArray(addon.baseUrls)) {
        urlsToTry.push(...addon.baseUrls);
    } else if (addon.baseUrl) {
        urlsToTry.push(addon.baseUrl);
    }

    if (urlsToTry.length === 0) return [];

    for (let i = 0; i < urlsToTry.length; i++) {
        // Pulisce l'URL e lo costruisce
        const baseUrl = urlsToTry[i].replace(/\/$/, '');
        const url = `${baseUrl}/stream/${fetchType}/${id}.json`;
        
        console.log(`🌐 [${addon.name}] Attempt ${i + 1}/${urlsToTry.length} ... (Type: ${fetchType}, ID: ${id})`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), addon.timeout);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'StremioAddon/1.0', 
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`⚠️ [${addon.name}] Link ${i + 1} failed (HTTP ${response.status}). Next...`);
                continue; 
            }

            // Parsing sicuro del JSON
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.warn(`⚠️ [${addon.name}] Link ${i + 1} invalid JSON. Next...`);
                continue;
            }

            let streams = data.streams || [];

            if (streams.length === 0) {
                console.warn(`⚠️ [${addon.name}] Link ${i + 1} returned 0 streams. Trying next mirror...`);
                if (i < urlsToTry.length - 1) {
                    continue; 
                }
            }

            if (addonKey === 'mediafusion' && addon.filterIta === true) {
                const countBefore = streams.length;
                streams = streams.filter(isItalianContent);
                console.log(`🇮🇹 [MediaFusion] Strict Filter: ${countBefore} -> ${streams.length}`);
            }

            // Se abbiamo risultati o è l'ultimo tentativo, restituiamo
            if (streams.length > 0 || i === urlsToTry.length - 1) {
                console.log(`✅ [${addon.name}] Success on URL ${i + 1}. Found ${streams.length} streams.`);
                return streams.map(stream => normalizeExternalStream(stream, addonKey));
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏱️ [${addon.name}] Timeout on URL ${i + 1}.`);
            } else {
                console.warn(`❌ [${addon.name}] Error on URL ${i + 1}: ${error.message}`);
            }
        }
    }

    console.error(`❌ [${addon.name}] All URLs failed or returned 0 results.`);
    return [];
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
