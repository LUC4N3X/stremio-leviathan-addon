const axios = require('axios');

// --- CONFIGURAZIONE ---
const URLS = {
    FRIBB: "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json",
    THEBEAST: "https://raw.githubusercontent.com/TheBeastLT/stremio-kitsu-anime/master/static/data/imdb_mapping.json",
    // API ufficiale Kitsu per i dati in tempo reale
    KITSU_API: "https://kitsu.io/api/edge/anime"
};

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 ore

// Cache in memoria
let mappingCache = {
    map: new Map(),
    lastFetch: 0,
    isLoaded: false
};

/**
 * Normalizza il tipo di contenuto basandosi sui dati Kitsu
 * TV, OVA, ONA -> series
 * Movie, Music, Special -> movie
 */
function normalizeType(kitsuType) {
    if (!kitsuType) return 'series'; // Default a series se mancante
    const t = kitsuType.toLowerCase();
    return (t === 'tv' || t === 'ova' || t === 'ona' || t === 'current') ? 'series' : 'movie';
}

/**
 * 1. Aggiorna la cache dai database statici (Fribb + TheBeast)
 */
async function updateCache() {
    const now = Date.now();
    if (mappingCache.isLoaded && (now - mappingCache.lastFetch < CACHE_DURATION)) {
        return;
    }

    try {
        const [fribbRes, beastRes] = await Promise.allSettled([
            axios.get(URLS.FRIBB, { timeout: 15000 }), // Timeout aumentato per sicurezza
            axios.get(URLS.THEBEAST, { timeout: 15000 })
        ]);

        const tempMap = new Map();

        // A. Carica FRIBB (Base Layer)
        if (fribbRes.status === 'fulfilled' && Array.isArray(fribbRes.value.data)) {
            fribbRes.value.data.forEach(item => {
                if (item.kitsu_id && item.imdb_id) {
                    tempMap.set(String(item.kitsu_id), {
                        imdb_id: item.imdb_id,
                        type: normalizeType(item.type), // Normalizzazione immediata
                        season: 1, // Default
                        episode: 1
                    });
                }
            });
        }

        // B. Carica THEBEASTLT (Overlay Layer - Correzione Stagioni)
        // Questo è vitale per anime come "Attack on Titan S2" che su IMDb è "S2" della serie principale
        if (beastRes.status === 'fulfilled' && beastRes.value.data) {
            const data = beastRes.value.data;
            Object.keys(data).forEach(kID => {
                const entry = data[kID];
                if (entry.imdb_id) {
                    // Sovrascrive o crea nuova entry
                    tempMap.set(String(kID), {
                        imdb_id: entry.imdb_id,
                        type: 'series', // Se è in TheBeast con stagioni, è una serie al 99%
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
        // Non blocchiamo: se fallisce l'update, useremo la cache vecchia o la API live
    }
}

/**
 * 2. Fallback Live: Interroga Kitsu API direttamente se non è nella lista statica
 * Utile per anime usciti oggi o molto di nicchia
 */
async function fetchKitsuLive(kitsuID) {
    try {
        // Chiediamo a Kitsu i mappings (IMDb, MyAnimeList, ecc)
        const url = `${URLS.KITSU_API}/${kitsuID}?include=mappings`;
        const res = await axios.get(url, { timeout: 3000 });
        
        const data = res.data?.data;
        const included = res.data?.included;

        if (!data || !included) return null;

        // Cerca ID IMDB nei mappings inclusi
        const imdbMapping = included.find(m => 
            m.type === 'mappings' && 
            m.attributes?.externalSite === 'imdb'
        );

        if (imdbMapping && imdbMapping.attributes?.externalId) {
            const kType = data.attributes?.subtype || 'TV';
            
            // Salviamo in cache per non richiederlo subito dopo
            const result = {
                imdb_id: imdbMapping.attributes.externalId,
                type: normalizeType(kType),
                season: 1,
                episode: 1
            };
            
            // Aggiungiamo alla cache in memoria per velocità future
            mappingCache.map.set(String(kitsuID), result);
            return result;
        }

    } catch (e) {
        // 404 o errore rete
        // console.warn(`⚠️ Kitsu Live Check fallito per ID ${kitsuID}`);
    }
    return null;
}

/**
 * --- MAIN HANDLER ---
 */
async function kitsuHandler(kitsuID) {
    if (!kitsuID) return null;
    
    // 1. Assicura che la cache statica sia presente (lazy loading)
    await updateCache();

    const strID = String(kitsuID);
    
    // 2. Cerca nella Cache (Fribb + TheBeast)
    let entry = mappingCache.map.get(strID);

    // 3. Se non trovato, prova la "Live Fallback" su Kitsu API
    if (!entry) {
        // console.log(`🔍 ID ${kitsuID} non in cache, provo API Kitsu Live...`);
        entry = await fetchKitsuLive(kitsuID);
    }

    if (!entry) return null;

    // Ritorna il formato pulito per addon.js
    return {
        imdbID: entry.imdb_id,
        season: entry.season,
        episode: entry.episode,
        type: entry.type
    };
}

module.exports = kitsuHandler;
