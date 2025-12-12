const axios = require("axios");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs-extra");

// --- ⚙️ CONFIGURAZIONE API (GOD MODE) ⚙️ ---
const CONFIG = {
    TMDB_KEY: '4b9dfb8b1c9f1720b5cd1d7efea1d845', // Usa la tua chiave o questa pubblica
    TMDB_URL: 'https://api.themoviedb.org/3',
    TRAKT_CLIENT_ID: 'ad521cf009e68d4304eeb82edf0e5c918055eef47bf38c8d568f6a9d8d6da4d1',
    TRAKT_URL: 'https://api.trakt.tv',
    OMDB_KEY: 'cbd03c31', 
    OMDB_URL: 'http://www.omdbapi.com',
};

// ---  DATABASE PERSISTENTE (SQLITE) ---
const DATA_DIR = path.join(__dirname, 'data');
fs.ensureDirSync(DATA_DIR); 

const dbPath = path.join(DATA_DIR, 'ids_cache.db');
const db = new Database(dbPath); 

// Attiviamo la modalità WAL per prestazioni estreme
db.pragma('journal_mode = WAL');

// Creazione Tabella
db.exec(`
  CREATE TABLE IF NOT EXISTS media_map (
    imdb_id TEXT PRIMARY KEY,
    tmdb_id INTEGER,
    tvdb_id INTEGER,
    trakt_id INTEGER,
    type TEXT,
    slug TEXT,
    timestamp INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_tmdb ON media_map(tmdb_id);
`);

const stmtGetByImdb = db.prepare('SELECT * FROM media_map WHERE imdb_id = ?');
const stmtGetByTmdb = db.prepare('SELECT * FROM media_map WHERE tmdb_id = ?');
const stmtInsert = db.prepare(`
    INSERT OR REPLACE INTO media_map (imdb_id, tmdb_id, tvdb_id, trakt_id, type, slug, timestamp)
    VALUES (@imdb, @tmdb, @tvdb, @trakt, @type, @slug, @timestamp)
`);

// ---  AXIOS CLIENTS ---
const tmdbClient = axios.create({ baseURL: CONFIG.TMDB_URL, timeout: 4000 });
const traktClient = axios.create({ 
    baseURL: CONFIG.TRAKT_URL, 
    timeout: 4000,
    headers: { 
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': CONFIG.TRAKT_CLIENT_ID 
    }
});
const omdbClient = axios.create({ baseURL: CONFIG.OMDB_URL, timeout: 4000 });

// ==========================================
//  LOGICA DI RICERCA IDS
// ==========================================

async function searchTmdb(id, source = 'imdb_id') {
    try {
        const url = `/find/${id}?api_key=${CONFIG.TMDB_KEY}&external_source=${source}`;
        const { data } = await tmdbClient.get(url);
        let res = null;
        if (data.movie_results?.length) res = { ...data.movie_results[0], _type: 'movie' };
        else if (data.tv_results?.length) res = { ...data.tv_results[0], _type: 'series' };
        else if (data.tv_episode_results?.length) res = { ...data.tv_episode_results[0], _type: 'episode' };

        if (res) {
            return {
                tmdb: res.id,
                imdb: source === 'imdb_id' ? id : null,
                type: res._type === 'tv' ? 'series' : res._type,
                foundVia: 'tmdb'
            };
        }
    } catch (e) { /* Silent fail */ }
    return null;
}

async function getTmdbExternalIds(tmdbId, type) {
    try {
        const t = type === 'series' || type === 'tv' ? 'tv' : 'movie';
        const { data } = await tmdbClient.get(`/${t}/${tmdbId}/external_ids?api_key=${CONFIG.TMDB_KEY}`);
        return { imdb: data.imdb_id, tvdb: data.tvdb_id, foundVia: 'tmdb_ext' };
    } catch (e) { return {}; }
}

async function searchTrakt(id, type = 'imdb') {
    if (!CONFIG.TRAKT_CLIENT_ID) return null;
    try {
        const url = `/search/${type}/${id}?type=movie,show`;
        const { data } = await traktClient.get(url);
        if (data && data.length > 0) {
            const item = data[0];
            const meta = item.movie || item.show;
            return {
                trakt: meta.ids.trakt,
                slug: meta.ids.slug,
                tvdb: meta.ids.tvdb,
                imdb: meta.ids.imdb,
                tmdb: meta.ids.tmdb,
                type: item.type === 'show' ? 'series' : 'movie',
                foundVia: 'trakt'
            };
        }
    } catch (e) { }
    return null;
}

async function searchOmdb(imdbId) {
    if (!CONFIG.OMDB_KEY) return null;
    try {
        const { data } = await omdbClient.get(`/?i=${imdbId}&apikey=${CONFIG.OMDB_KEY}`);
        if (data && data.Response === 'True') {
            return { imdb: data.imdbID, type: data.Type === 'series' ? 'series' : 'movie', foundVia: 'omdb' };
        }
    } catch (e) { }
    return null;
}

// ==========================================
//  FUNZIONE CORE (DB MANAGER)
// ==========================================

async function resolveIds(id, typeHint = null) {
    const isImdb = id.toString().startsWith('tt');
    const cleanId = id.toString().split(':')[0]; 

    let cached = null;
    try { cached = isImdb ? stmtGetByImdb.get(cleanId) : stmtGetByTmdb.get(cleanId); } catch (err) {}

    if (cached) {
        return {
            imdb: cached.imdb_id,
            tmdb: cached.tmdb_id,
            tvdb: cached.tvdb_id,
            trakt: cached.trakt_id,
            type: cached.type,
            foundVia: 'sqlite_db'
        };
    }

    let identity = { 
        imdb: isImdb ? cleanId : null, 
        tmdb: !isImdb ? parseInt(cleanId) : null,
        tvdb: null, trakt: null, slug: null, type: typeHint
    };

    if (isImdb && !identity.tmdb) {
        const tmdbRes = await searchTmdb(cleanId, 'imdb_id');
        if (tmdbRes) { identity.tmdb = tmdbRes.tmdb; identity.type = identity.type || tmdbRes.type; }
    }

    if (identity.tmdb) {
        const ext = await getTmdbExternalIds(identity.tmdb, identity.type || 'movie');
        identity = { ...identity, ...ext };
    }

    if ((!identity.tmdb || !identity.imdb) && CONFIG.TRAKT_CLIENT_ID) {
        const traktRes = await searchTrakt(cleanId, isImdb ? 'imdb' : 'tmdb');
        if (traktRes) identity = { ...identity, ...traktRes };
    }

    if (isImdb && !identity.tmdb && CONFIG.OMDB_KEY) {
        const omdbRes = await searchOmdb(cleanId);
        if (omdbRes) identity = { ...identity, ...omdbRes };
    }

    if (identity.imdb) {
        try {
            stmtInsert.run({
                imdb: identity.imdb,
                tmdb: identity.tmdb || null,
                tvdb: identity.tvdb || null,
                trakt: identity.trakt || null,
                type: identity.type || 'movie',
                slug: identity.slug || null,
                timestamp: Date.now()
            });
        } catch (err) {}
    }

    return identity;
}

// ==========================================
//  🆕 NUOVA FUNZIONE: TITOLI ALTERNATIVI
// ==========================================

async function getTmdbAltTitles(tmdbId, type) {
    if (!tmdbId || !CONFIG.TMDB_KEY) return [];
    // Sanitize tmdbId to avoid SSRF: must be only digits (TMDb uses only numeric IDs)
    if (!/^\d+$/.test(tmdbId)) {
        console.warn(`[TMDB Titles] Invalid tmdbId provided: ${tmdbId}`);
        return [];
    }
    try {
        const endpoint = type === 'series' || type === 'tv' ? 'tv' : 'movie';
        // Richiediamo Traduzioni e Titoli Alternativi in un colpo solo
        const url = `/${endpoint}/${tmdbId}?api_key=${CONFIG.TMDB_KEY}&append_to_response=alternative_titles,translations`;
        
        const { data } = await tmdbClient.get(url);
        const titles = new Set();

        // 1. Titolo Italiano Ufficiale (dalle traduzioni)
        const itTrans = data.translations?.translations?.find(t => t.iso_3166_1 === 'IT');
        if (itTrans && itTrans.data?.title) titles.add(itTrans.data.title);
        if (itTrans && itTrans.data?.name) titles.add(itTrans.data.name);

        // 2. Titoli Alternativi (Cerca specifici per IT o US)
        const alts = data.alternative_titles?.titles || data.alternative_titles?.results || [];
        alts.forEach(t => {
            if (t.iso_3166_1 === 'IT' || t.iso_3166_1 === 'US') {
                titles.add(t.title);
            }
        });

        // 3. Titolo Originale
        if (data.original_title) titles.add(data.original_title);
        if (data.original_name) titles.add(data.original_name);

        return Array.from(titles);
    } catch (e) {
        console.error(`[TMDB Titles] Errore fetch per ${tmdbId}: ${e.message}`);
        return [];
    }
}

async function tmdbToImdb(tmdbId, type) {
    const ids = await resolveIds(tmdbId, type);
    return ids.imdb || null;
}

async function imdbToTmdb(imdbId) {
    const ids = await resolveIds(imdbId);
    return { tmdbId: ids.tmdb, type: ids.type };
}

async function getAllIds(id) {
    return await resolveIds(id);
}

module.exports = {
    tmdbToImdb,
    imdbToTmdb,
    getAllIds,
    getTmdbAltTitles // <--- EXPORT AGGIUNTO
};
