const axios = require('axios');

// --- CONFIGURAZIONE ---
const URLS = {
    FRIBB: "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json",
    THEBEAST: "https://raw.githubusercontent.com/TheBeastLT/stremio-kitsu-anime/master/static/data/imdb_mapping.json",
    KITSU_API: "https://kitsu.io/api/edge/anime"
};

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 ore

// Cache in memoria
let mappingCache = {
    map: new Map(),
    lastFetch: 0,
    isLoaded: false,
    isLoading: false // Flag per evitare richieste doppie
};

/**
 * Normalizza il tipo di contenuto
 */
function normalizeType(kitsuType) {
    if (!kitsuType) return 'series';
    const t = kitsuType.toLowerCase();
    return (t === 'tv' || t === 'ova' || t === 'ona' || t === 'current') ? 'series' : 'movie';
}

/**
 * Aggiorna la cache dai database statici in BACKGROUND
 */
async function updateCache() {
    const now = Date.now();
    
    // Se è già caricata e valida, o se sta già caricando, esci
    if ((mappingCache.isLoaded && (now - mappingCache.lastFetch < CACHE_DURATION)) || mappingCache.isLoading) {
        return;
    }

    mappingCache.isLoading = true;
    console.log("🐉 [KITSU] Avvio download database mapping in background...");

    try {
        const [fribbRes, beastRes] = await Promise.allSettled([
            axios.get(URLS.FRIBB, { timeout: 20000 }), 
            axios.get(URLS.THEBEAST, { timeout: 20000 })
        ]);

        const tempMap = new Map();

        // A. Carica FRIBB
        if (fribbRes.status === 'fulfilled' && Array.isArray(fribbRes.value.data)) {
            fribbRes.value.data.forEach(item => {
                if (item.kitsu_id && item.imdb_id) {
                    tempMap.set(String(item.kitsu_id), {
                        imdb_id: item.imdb_id,
                        type: normalizeType(item.type),
                        season: 1,
                        episode: 1
                    });
                }
            });
        }

        // B. Carica THEBEASTLT
        if (beastRes.status === 'fulfilled' && beastRes.value.data) {
            const data = beastRes.value.data;
            Object.keys(data).forEach(kID => {
                const entry = data[kID];
                if (entry.imdb_id) {
                    tempMap.set(String(kID), {
                        imdb_id: entry.imdb_id,
                        type: 'series',
                        season: entry.fromSeason || 1,
                        episode: entry.fromEpisode || 1
                    });
                }
            });
        }

        if (tempMap.size > 0) {
            mappingCache.map = tempMap;
            mappingCache.lastFetch = now;
            mappingCache.isLoaded = true;
            console.log(`🐉 [KITSU] Cache Rigenerata. Totale Anime: ${tempMap.size}`);
        }

    } catch (e) {
        console.error("❌ Errore update Kitsu cache:", e.message);
    } finally {
        mappingCache.isLoading = false;
    }
}

/**
 * Fallback Live: Interroga Kitsu API direttamente
 */
async function fetchKitsuLive(kitsuID) {
    try {
        // console.log(`⚡ [KITSU LIVE] Fetch ID: ${kitsuID}`);
        const url = `${URLS.KITSU_API}/${kitsuID}?include=mappings`;
        const res = await axios.get(url, { timeout: 2500 }); // Timeout breve
        
        const data = res.data?.data;
        const included = res.data?.included;

        if (!data || !included) return null;

        const imdbMapping = included.find(m => 
            m.type === 'mappings' && 
            m.attributes?.externalSite === 'imdb'
        );

        if (imdbMapping && imdbMapping.attributes?.externalId) {
            const kType = data.attributes?.subtype || 'TV';
            const result = {
                imdb_id: imdbMapping.attributes.externalId,
                type: normalizeType(kType),
                season: 1,
                episode: 1
            };
            return result;
        }
    } catch (e) {
        // console.warn(`⚠️ Kitsu Live Check fallito: ${e.message}`);
    }
    return null;
}

/**
 * --- MAIN HANDLER ---
 */
async function kitsuHandler(kitsuID) {
    if (!kitsuID) return null;
    const strID = String(kitsuID);

    // 1. Strategia Ibrida: Se la cache non è pronta, usa la Live API subito
    // Non aspettiamo il download del file JSON gigante
    if (!mappingCache.isLoaded) {
        // Avvia il download in background se non è già partito
        updateCache().catch(e => console.error(e));
        
        // Nel frattempo usa la Live API per rispondere subito all'utente
        return await fetchKitsuLive(kitsuID);
    }
    
    // 2. Cerca nella Cache Veloce
    let entry = mappingCache.map.get(strID);

    // 3. Se non trovato in cache (es. anime nuovissimo), prova Live
    if (!entry) {
        entry = await fetchKitsuLive(kitsuID);
        // Salviamo in cache temporanea per non rifare la chiamata subito
        if (entry) mappingCache.map.set(strID, entry);
    }

    if (!entry) return null;

    return {
        imdbID: entry.imdb_id,
        season: entry.season,
        episode: entry.episode,
        type: entry.type
    };
}

// Avvia il pre-fetching all'avvio del server (senza awaitare)
updateCache();

module.exports = kitsuHandler;
