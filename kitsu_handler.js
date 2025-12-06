// kitsu_handler.js
const axios = require('axios');

// Cache in memoria per evitare di scaricare il JSON di GitHub ad ogni richiesta
let mappingCache = null;
let lastFetch = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 ore

async function getMapping() {
    const now = Date.now();
    if (mappingCache && (now - lastFetch < CACHE_DURATION)) {
        return mappingCache;
    }

    try {
        console.log("📥 Fetching Kitsu->IMDb mapping from GitHub...");
        const kitsuToIMDBurl = "https://raw.githubusercontent.com/TheBeastLT/stremio-kitsu-anime/master/static/data/imdb_mapping.json";
        const response = await axios.get(kitsuToIMDBurl);
        
        if (response.data) {
            mappingCache = response.data;
            lastFetch = now;
            return mappingCache;
        }
    } catch (e) {
        console.error("⚠️ Errore download Kitsu mapping:", e.message);
        // Se fallisce ma abbiamo una cache vecchia, usiamo quella
        if (mappingCache) return mappingCache;
    }
    return null;
}

async function kitsuHandler(kitsuID) {
    const mapping = await getMapping();
    if (!mapping || !mapping[kitsuID]) return null;

    const entry = mapping[kitsuID];
    const imdbID = entry.imdb_id;

    if (!imdbID) return null;

    try {
        // Verifica rapida tipo (opzionale ma utile se vuoi distinguere film/serie)
        // Nota: Questa chiamata IMDb a volte fallisce o cambia API, la manteniamo safe.
        const imdbResponse = await axios.get(`https://v2.sg.media-imdb.com/suggestion/t/${imdbID}.json`, { timeout: 3000 });
        const imdbResponseJSON = imdbResponse.data;

        if (imdbResponseJSON && imdbResponseJSON.d && imdbResponseJSON.d[0]) {
            const type = imdbResponseJSON.d[0].q; // "TV series", "feature", etc.
            
            if (type === "TV series" || entry.fromSeason) {
                return {
                    imdbID,
                    season: entry.fromSeason || 1,
                    episode: entry.fromEpisode || 1,
                    type: 'series'
                };
            }
        }
    } catch (e) {
        // Ignoriamo errori sulla chiamata suggest IMDb e torniamo comunque l'ID
        // console.log("⚠️ IMDb Suggest Check saltato/fallito");
    }

    // Default return se è un film o la chiamata suggest fallisce
    return { imdbID, type: 'movie' };
}

module.exports = kitsuHandler;
