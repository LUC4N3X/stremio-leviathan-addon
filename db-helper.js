// db-helper.js - GOD TIER EDITION
const { Pool } = require('pg');
// Importiamo CONFIG per avere la lista dei tracker aggiornata (Logica del vecchio file)
let CONFIG = {}; 
try { CONFIG = require("./engines").CONFIG; } catch (e) { console.warn("⚠️ Engines config non trovato, tracker non saranno iniettati."); }

// --- 1. CONFIGURAZIONE POOL (Migliorata dal nuovo codice) ---
let pool = null;

function initDatabase(config = {}) {
  if (pool) return pool;

  // Supporta sia stringa di connessione che parametri singoli
  const poolConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: config.host || process.env.DB_HOST,
        port: config.port || process.env.DB_PORT,
        database: config.database || process.env.DB_NAME,
        user: config.user || process.env.DB_USER,
        password: config.password || process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
      };

  pool = new Pool({
    ...poolConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, 
  });

  pool.on('error', (err) => console.error('❌ Errore inatteso client DB', err));
  console.log('✅ PostgreSQL Pool Initialized (God Tier)');
  return pool;
}

// --- 2. UTILITY PER FORMATTAZIONE (Ponte tra vecchio e nuovo) ---
function injectTrackers(magnet) {
    if (!magnet) return magnet;
    if (CONFIG && CONFIG.TRACKERS && Array.isArray(CONFIG.TRACKERS)) {
        // Aggiunge i tracker se non presenti
        const currentTrackers = magnet.split("&tr=");
        CONFIG.TRACKERS.forEach(tr => {
            if (!magnet.includes(encodeURIComponent(tr))) {
                magnet += `&tr=${encodeURIComponent(tr)}`;
            }
        });
    }
    return magnet;
}

function formatRow(row, sourceTag = "ilCorSaRoNeRo") {
    const baseMagnet = `magnet:?xt=urn:btih:${row.info_hash}`;
    const fullMagnet = injectTrackers(baseMagnet);
    
    return {
        title: row.file_title || row.title, // Preferisci il nome del file se è un episodio specifico
        magnet: fullMagnet,
        info_hash: row.info_hash,
        size: parseInt(row.file_size || row.size) || 0,
        seeders: row.seeders || 0,
        source: `${sourceTag}${row.cached_rd ? " ⚡" : ""}`,
        isCached: row.cached_rd
    };
}

// --- 3. CORE FUNCTIONS (Presi dal codice NUOVO) ---

async function searchByImdbId(imdbId, type = null) {
  if (!pool) return [];
  try {
    let query = `
      SELECT info_hash, title, size, seeders, cached_rd 
      FROM torrents 
      WHERE (imdb_id = $1 OR all_imdb_ids @> $2::jsonb)
    `;
    const params = [imdbId, JSON.stringify([imdbId])];
    if (type) {
      query += ' AND type = $3';
      params.push(type);
    }
    query += ' ORDER BY cached_rd DESC NULLS LAST, seeders DESC LIMIT 50';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error(`❌ DB Error searchByImdbId:`, error.message);
    return [];
  }
}

async function searchEpisodeFiles(imdbId, season, episode) {
  if (!pool) return [];
  try {
    // Cerca file specifici mappati (table files)
    const query = `
      SELECT f.title as file_title, f.size as file_size, t.info_hash, t.title, t.seeders, t.cached_rd
      FROM files f
      JOIN torrents t ON f.info_hash = t.info_hash
      WHERE f.imdb_id = $1 AND f.imdb_season = $2 AND f.imdb_episode = $3
      ORDER BY t.cached_rd DESC NULLS LAST, t.seeders DESC
      LIMIT 30
    `;
    const result = await pool.query(query, [imdbId, season, episode]);
    return result.rows;
  } catch (error) {
    console.error(`❌ DB Error searchEpisodeFiles:`, error.message);
    return [];
  }
}

async function searchPacksByImdbId(imdbId) {
    if (!pool) return [];
    try {
        // Cerca Torrent segnati come Pack che contengono questo ID
        const query = `
            SELECT t.info_hash, t.title, t.size, t.seeders, t.cached_rd
            FROM torrents t
            WHERE (imdb_id = $1 OR all_imdb_ids @> $2::jsonb) AND type = 'series'
            ORDER BY cached_rd DESC NULLS LAST, seeders DESC LIMIT 20
        `;
        const result = await pool.query(query, [imdbId, JSON.stringify([imdbId])]);
        return result.rows;
    } catch (e) { return []; }
}

// --- 4. FUNZIONI DI SCRITTURA (Potenziamento) ---

async function insertTorrent(torrent) {
  if (!pool) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT 1 FROM torrents WHERE info_hash = $1', [torrent.infoHash]);
    if (check.rowCount > 0) { await client.query('ROLLBACK'); return false; }

    await client.query(
      `INSERT INTO torrents (info_hash, provider, title, size, type, seeders, imdb_id, tmdb_id, upload_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [torrent.infoHash, torrent.provider || 'P2P', torrent.title, torrent.size, torrent.type, torrent.seeders, torrent.imdbId, torrent.tmdbId]
    );
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("❌ Insert Error:", e.message);
    return false;
  } finally {
    client.release();
  }
}

async function updateRdCacheStatus(cacheResults) {
    if (!pool || !cacheResults.length) return 0;
    try {
        let updated = 0;
        for (const res of cacheResults) {
            if (!res.hash) continue;
            const q = `UPDATE torrents SET cached_rd = $1, last_cached_check = NOW() WHERE info_hash = $2`;
            const r = await pool.query(q, [res.cached, res.hash.toLowerCase()]);
            updated += r.rowCount;
        }
        return updated;
    } catch (e) { return 0; }
}

// --- 5. ADATTATORE PER ADDON.JS (Il ponte magico) ---

const dbHelper = {
    initDatabase,
    
    // API per addon.js (compatibilità retroattiva)
    searchMovie: async (imdbId) => {
        const rows = await searchByImdbId(imdbId, 'movie');
        return rows.map(r => formatRow(r, "LeviathanDB"));
    },

    searchSeries: async (imdbId, season, episode) => {
        // 1. Cerca file episodi specifici (SxxExx)
        const files = await searchEpisodeFiles(imdbId, season, episode);
        const formattedFiles = files.map(r => formatRow(r, "LeviathanDB"));

        // 2. Cerca Pack completi (Season Pack)
        const packs = await searchPacksByImdbId(imdbId);
        const formattedPacks = packs.map(r => formatRow(r, "LeviathanDB [Pack]"));

        return [...formattedFiles, ...formattedPacks];
    },

    // Esposizione funzioni avanzate per uso futuro o admin
    insertTorrent,
    updateRdCacheStatus,
    searchByTitleFTS: async (title) => {
        // Implementazione dummy wrapper se vuoi usarla in futuro
        return []; 
    }
};

module.exports = dbHelper;
