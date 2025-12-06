const axios = require("axios");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs-extra");

// --- ⚙️ CONFIGURAZIONE API (GOD MODE) ⚙️ ---
const CONFIG = {
    TMDB_KEY: '4b9dfb8b1c9f1720b5cd1d7efea1d845',
    TMDB_URL: 'https://api.themoviedb.org/3',
    TRAKT_CLIENT_ID: 'ad521cf009e68d4304eeb82edf0e5c918055eef47bf38c8d568f6a9d8d6da4d1',
    TRAKT_URL: 'https://api.trakt.tv',
    OMDB_KEY: 'cbd03c31', 
    OMDB_URL: 'http://www.omdbapi.com',
};

// --- 💾 DATABASE PERSISTENTE (SQLITE) ---
// Ispirato alla robustezza del "DatabaseManager" Python
const DATA_DIR = path.join(__dirname, 'data');
fs.ensureDirSync(DATA_DIR); // Crea la cartella se non esiste

const dbPath = path.join(DATA_DIR, 'ids_cache.db');
const db = new Database(dbPath); // Sincrono e velocissimo

// Attiviamo la modalità WAL per prestazioni estreme
db.pragma('journal_mode = WAL');

// Creazione Tabella (Se non esiste)
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

// Prepared Statements (Query Precompilate per velocità)
const stmtGetByImdb = db.prepare('SELECT * FROM media_map WHERE imdb_id = ?');
const stmtGetByTmdb = db.prepare('SELECT * FROM media_map WHERE tmdb_id = ?');
const stmtInsert = db.prepare(`
    INSERT OR REPLACE INTO media_map (imdb_id, tmdb_id, tvdb_id, trakt_id, type, slug, timestamp)
    VALUES (@imdb, @tmdb, @tvdb, @trakt, @type, @slug, @timestamp)
`);

// --- ⚡ AXIOS CLIENTS ---
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
// 🕵️‍♂️ LOGICA DI RICERCA ESTERNA
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
        return {
            imdb: data.imdb_id,
            tvdb: data.tvdb_id,
            foundVia: 'tmdb_ext'
        };
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
            return {
                imdb: data.imdbID,
                type: data.Type === 'series' ? 'series' : 'movie',
                foundVia: 'omdb'
            };
        }
    } catch (e) { }
    return null;
}

// ==========================================
// 🛠️ FUNZIONE CORE (DB MANAGER)
// ==========================================

async function resolveIds(id, typeHint = null) {
    const isImdb = id.toString().startsWith('tt');
    const cleanId = id.toString().split(':')[0]; // Rimuove :season:episode se presente

    // 1. 💾 DB CHECK (Lettura immediata)
    let cached = null;
    try {
        cached = isImdb ? stmtGetByImdb.get(cleanId) : stmtGetByTmdb.get(cleanId);
    } catch (err) { console.error("DB Read Error:", err); }

    if (cached) {
        // Riformatta come oggetto pulito
        return {
            imdb: cached.imdb_id,
            tmdb: cached.tmdb_id,
            tvdb: cached.tvdb_id,
            trakt: cached.trakt_id,
            type: cached.type,
            foundVia: 'sqlite_db'
        };
    }

    // 2. 🌍 LIVE SEARCH (Se non è nel DB)
    let identity = { 
        imdb: isImdb ? cleanId : null, 
        tmdb: !isImdb ? parseInt(cleanId) : null,
        tvdb: null,
        trakt: null,
        slug: null,
        type: typeHint
    };

    // A. TMDB Primary Search
    if (isImdb && !identity.tmdb) {
        const tmdbRes = await searchTmdb(cleanId, 'imdb_id');
        if (tmdbRes) {
            identity.tmdb = tmdbRes.tmdb;
            identity.type = identity.type || tmdbRes.type;
        }
    }

    // B. Expand details with TMDB External IDs
    if (identity.tmdb) {
        const ext = await getTmdbExternalIds(identity.tmdb, identity.type || 'movie');
        identity = { ...identity, ...ext };
    }

    // C. Trakt Fallback (Cruciale per Anime/Serie complesse)
    if ((!identity.tmdb || !identity.imdb) && CONFIG.TRAKT_CLIENT_ID) {
        const traktRes = await searchTrakt(cleanId, isImdb ? 'imdb' : 'tmdb');
        if (traktRes) {
            // console.log(`🦅 Trakt Rescue: ${cleanId}`);
            identity = { ...identity, ...traktRes };
        }
    }

    // D. OMDB Last Resort
    if (isImdb && !identity.tmdb && CONFIG.OMDB_KEY) {
        const omdbRes = await searchOmdb(cleanId);
        if (omdbRes) identity = { ...identity, ...omdbRes };
    }

    // 3. 💾 SAVE TO DB (Scrittura Persistente)
    // Salviamo solo se abbiamo almeno una coppia solida (IMDB+TMDB) o (IMDB solo)
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
            // console.log(`💾 Saved to DB: ${identity.imdb} <-> ${identity.tmdb}`);
        } catch (err) { console.error("DB Write Error:", err.message); }
    }

    return identity;
}

// ==========================================
// 🔌 EXPORT PUBBLICI
// ==========================================

async function tmdbToImdb(tmdbId, type) {
    const ids = await resolveIds(tmdbId, type);
    if (ids.imdb) {
        console.log(`✅ TMDb ${tmdbId} → IMDb ${ids.imdb} [via ${ids.foundVia || 'web'}]`);
        return ids.imdb;
    }
    return null;
}

async function imdbToTmdb(imdbId) {
    const ids = await resolveIds(imdbId);
    if (ids.tmdb) {
        console.log(`✅ IMDb ${imdbId} → TMDb ${ids.tmdb} [via ${ids.foundVia || 'web'}]`);
        return { tmdbId: ids.tmdb, type: ids.type };
    }
    return { tmdbId: null, type: null };
}

async function getAllIds(id) {
    return await resolveIds(id);
}

module.exports = {
    tmdbToImdb,
    imdbToTmdb,
    getAllIds
};
