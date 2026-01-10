const axios = require('axios');

// --- CONFIGURAZIONE ---
const URLS = {
    // Database massivo generale (copre quasi tutto)
    FRIBB: "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json",
    // Database specifico per Stremio (gestisce meglio stagioni/episodi sfasati)
    THEBEAST: "https://raw.githubusercontent.com/TheBeastLT/stremio-kitsu-anime/master/static/data/imdb_mapping.json"
};

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 ore

// Cache in memoria ottimizzata (Map per lookup O(1))
let mappingCache = {
    map: new Map(),
    lastFetch: 0,
    isLoaded: false
};

/**
 * Aggiorna la cache scaricando da entrambe le fonti in parallelo
 */
async function updateCache() {
    const now = Date.now();
    // Se la cache è valida e caricata, non fare nulla
    if (mappingCache.isLoaded && (now - mappingCache.lastFetch < CACHE_DURATION)) {
        return;
    }

    // console.log("🐉 [KITSU] Aggiornamento indici anime (Fribb + TheBeastLT)...");

    try {
        // Scarica in parallelo (Promise.allSettled non blocca se uno fallisce)
        const [fribbRes, beastRes] = await Promise.allSettled([
            axios.get(URLS.FRIBB, { timeout: 10000 }),
            axios.get(URLS.THEBEAST, { timeout: 10000 })
        ]);

        const tempMap = new Map();

        // 1. ELABORA FRIBB (Base Layer)
        if (fribbRes.status === 'fulfilled' && Array.isArray(fribbRes.value.data)) {
            fribbRes.value.data.forEach(item => {
                if (item.kitsu_id && item.imdb_id) {
                    tempMap.set(String(item.kitsu_id), {
                        imdb_id: item.imdb_id,
                        // Fribb a volte ha il campo 'type', usiamolo come hint
                        type: (item.type === 'TV' || item.type === 'OVA' || item.type === 'ONA') ? 'series' : 'movie'
                    });
                }
            });
            // console.log(`✅ [KITSU] Fribb caricato: ${fribbRes.value.data.length} entries`);
        } else {
            console.warn("⚠️ Fribb API fallita o formato non valido");
        }

        // 2. ELABORA THEBEASTLT (Overlay Layer - Priorità Alta per Stremio)
        // Sovrascrive Fribb perché contiene info specifiche su stagioni/episodi per Stremio
        if (beastRes.status === 'fulfilled' && beastRes.value.data) {
            const data = beastRes.value.data;
            let count = 0;
            Object.keys(data).forEach(kID => {
                const entry = data[kID];
                if (entry.imdb_id) {
                    tempMap.set(String(kID), {
                        imdb_id: entry.imdb_id,
                        fromSeason: entry.fromSeason,
                        fromEpisode: entry.fromEpisode,
                        // Se c'è info sulla stagione, è sicuramente una serie
                        type: entry.fromSeason ? 'series' : undefined 
                    });
                    count++;
                }
            });
            // console.log(`✅ [KITSU] TheBeastLT caricato: ${count} entries`);
        } else {
            console.warn("⚠️ TheBeastLT API fallita");
        }

        // Aggiorna la cache globale solo se abbiamo trovato qualcosa
        if (tempMap.size > 0) {
            mappingCache.map = tempMap;
            mappingCache.lastFetch = now;
            mappingCache.isLoaded = true;
            console.log(`🐉 [KITSU] Cache aggiornata. Totale anime mappati: ${tempMap.size}`);
        }

    } catch (e) {
        console.error("❌ Errore critico update Kitsu cache:", e.message);
    }
}

/**
 * Verifica su IMDb se è una serie o un film (Fallback)
 */
async function checkImdbType(imdbID) {
    try {
        // Timeout breve per non bloccare tutto
        const response = await axios.get(`https://v2.sg.media-imdb.com/suggestion/t/${imdbID}.json`, { timeout: 2500 });
        const data = response.data;
        if (data && data.d && data.d[0]) {
            const q = data.d[0].q; // es. "TV series", "feature", "TV mini-series"
            if (!q) return null;
            return (q.toLowerCase().includes('tv') || q.toLowerCase().includes('series')) ? 'series' : 'movie';
        }
    } catch (e) {
        // Ignora silenziosamente errori di rete verso IMDb
    }
    return null;
}

/**
 * Funzione principale chiamata da addon.js
 */
async function kitsuHandler(kitsuID) {
    // Assicura che la cache sia pronta
    await updateCache();

    const strID = String(kitsuID);
    const entry = mappingCache.map.get(strID);

    if (!entry) return null;

    let finalType = entry.type;
    const finalSeason = entry.fromSeason || 1;
    const finalEpisode = entry.fromEpisode || 1;

    // Se il tipo non è certo (da Fribb senza type o TheBeast senza season info), controlliamo IMDb
    // Questo serve perché addon.js deve sapere se trattarlo come serie (S:E) o film
    if (!finalType) {
        const checkedType = await checkImdbType(entry.imdb_id);
        finalType = checkedType || 'movie'; // Default a movie se check fallisce
    }

    // Rispetta esattamente il formato che addon.js si aspetta
    return {
        imdbID: entry.imdb_id,
        season: finalSeason,
        episode: finalEpisode,
        type: finalType
    };
}

module.exports = kitsuHandler;
