const EXTERNAL_ADDONS = {
    torrentio: {
        // Configurazione con FAILOVER (triplo link)
        baseUrls: [
            // 1. Nuovo link (torrentioita)
            'https://torrentioita.stremio.dpdns.org/oResults=false/aHR0cHM6Ly90b3JyZW50aW8uc3RyZW0uZnVuL3Byb3ZpZGVycz15dHMsZXp0dixyYXJiZywxMzM3eCx0aGVwaXJhdGViYXksa2lja2Fzc3RvcnJlbnRzLHRvcnJlbnRnYWxheHksbWFnbmV0ZGwsaG9ycmlibGVzdWJzLG55YWFzaSx0b2t5b3Rvc2hvLGFuaWRleCxydXRvcixydXRyYWNrZXIsY29tYW5kbyxibHVkdix0b3JyZW50OSxpbGNvcnNhcm9uZXJvLG1lam9ydG9ycmVudCx3b2xmbWF4NGssY2luZWNhbGlkYWQsYmVzdHRvcnJlbnRzfGxhbmd1YWdlPWl0YWxpYW4=',
            
            // 2. Vecchio link (stremioluca) come backup
            'https://torrentio.stremioluca.dpdns.org/oResults=false/aHR0cHM6Ly90b3JyZW50aW8uc3RyZW0uZnVuL3Byb3ZpZGVycz15dHMsZXp0dixyYXJiZywxMzM3eCx0aGVwaXJhdGViYXksa2lja2Fzc3RvcnJlbnRzLHRvcnJlbnRnYWxheHksbWFnbmV0ZGwsaG9ycmlibGVzdWJzLG55YWFzaSx0b2t5b3Rvc2hvLGFuaWRleCxydXRvcixydXRyYWNrZXIsY29tYW5kbyxibHVkdix0b3JyZW50OSxpbGNvcnNhcm9uZXJvLG1lam9ydG9ycmVudCx3b2xmbWF4NGssY2luZWNhbGlkYWQsYmVzdHRvcnJlbnRzfGxhbmd1YWdlPWl0YWxpYW4=',
            
            // 3. Link di EMERGENZA (Solo ITA/Nyaa - Filtrato rigorosamente)
            'https://torrentio.strem.fun/providers=nyaasi,ilcorsaronero%7Clanguage=italian%7Cdebridoptions=nodownloadlinks'
        ],
        name: 'Torrentio',
        emoji: '🅣',
        timeout: 4500
    },
    mediafusion: {
        // ATTIVATO
        baseUrl: 'https://mediafusion.stremio.ru/D-T67taQDYh1r-Zq9_jdKJwgJfyPyZypBcztc8rIcsLJqQDS1eBLvFIssvKFXj-u0U',
        name: 'MediaFusion',
        emoji: '🅜',
        timeout: 4500
    },
    /* DISABILITATO SU RICHIESTA
    comet: {
        baseUrl: 'https://comet.elfhosted.com', 
        name: 'Comet',
        emoji: '🅒',
        timeout: 4500
    }
    */
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

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function fetchExternalAddon(addonKey, type, id) {
    const addon = EXTERNAL_ADDONS[addonKey];
    if (!addon) {
        console.error(`❌ [External] Unknown addon: ${addonKey}`);
        return [];
    }

    // Costruisce la lista di URL da provare (supporta sia baseUrls array che baseUrl stringa singola)
    const urlsToTry = [];
    if (addon.baseUrls && Array.isArray(addon.baseUrls)) {
        urlsToTry.push(...addon.baseUrls);
    } else if (addon.baseUrl) {
        urlsToTry.push(addon.baseUrl);
    }

    if (urlsToTry.length === 0) {
        console.error(`❌ [External] No URLs configured for: ${addon.name}`);
        return [];
    }

    // Ciclo sui vari URL (Logica di Failover)
    for (let i = 0; i < urlsToTry.length; i++) {
        const baseUrl = urlsToTry[i];
        const url = `${baseUrl}/stream/${type}/${id}.json`;
        console.log(`🌐 [${addon.name}] Attempt ${i + 1}/${urlsToTry.length}: Fetching ${type}/${id} ...`);

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
                console.warn(`⚠️ [${addon.name}] HTTP ${response.status} on URL ${i + 1}. Trying next if available...`);
                continue; // Prova il prossimo URL
            }

            const data = await response.json();
            const streams = data.streams || [];
            console.log(`✅ [${addon.name}] Success on URL ${i + 1}. Received ${streams.length} streams`);
            
            // Logica EXTRA per il link di EMERGENZA (filtro ITA)
            // Se siamo sull'ultimo URL (quello di emergenza), filtriamo via tutto ciò che non sembra ITA
            // Questo è un controllo di sicurezza aggiuntivo lato codice, oltre alla configurazione del link
            if (i === 2 && addonKey === 'torrentio') { 
                 const filteredStreams = streams.filter(s => {
                    const txt = (s.title + " " + s.name + " " + (s.description||"")).toLowerCase();
                    // Accetta solo se contiene ita/italian o è nyaa (anime spesso multi/sub)
                    return txt.includes('ita') || txt.includes('italian') || txt.includes('nyaa');
                });
                console.log(`⚠️ [Emergenza] Filtrati ${streams.length - filteredStreams.length} stream non-ITA.`);
                return filteredStreams.map(stream => normalizeExternalStream(stream, addonKey));
            }

            // Se ha successo, ritorna subito e ferma il ciclo
            return streams.map(stream => normalizeExternalStream(stream, addonKey));

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏱️ [${addon.name}] Timeout on URL ${i + 1} (${addon.timeout}ms).`);
            } else {
                console.warn(`❌ [${addon.name}] Error on URL ${i + 1}:`, error.message);
            }
            // Continua al prossimo giro del ciclo per provare il prossimo URL
        }
    }

    console.error(`❌ [${addon.name}] All URLs failed.`);
    return [];
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
    const originalProvider = extractOriginalProvider(fullTextSearch);

    let sizeBytes = sizeInfo.bytes;
    if (stream.behaviorHints?.videoSize) {
        sizeBytes = stream.behaviorHints.videoSize;
    }
    if (stream.video_size) {
        sizeBytes = stream.video_size;
    }

    // 🔥 FIX PACK RESOLVER: Se fileIdx non c'è, mettiamo undefined (NON 0).
    // Questo permette a Leviathan di capire che è un pack da esplorare.
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
