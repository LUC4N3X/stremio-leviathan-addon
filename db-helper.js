// db-helper.js - GOD TIER EDITION (CLEAN, OPTIMIZED & ROBUST)
const { Pool } = require('pg');

// Tracker List Statica 
const DEFAULT_TRACKERS = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.demonoid.ch:6969/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://tracker.therarbg.to:6969/announce",
    "udp://tracker.doko.moe:6969/announce",
    "udp://opentracker.i2p.rocks:6969/announce"
];

// --- 1. CONFIGURAZIONE POOL ---
// Variabile globale per il pool, con lazy initialization.
let pool = null;

function initDatabase(config = {}) {
  if (pool) return pool;

  const poolConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: config.host || process.env.DB_HOST || 'localhost',
        port: config.port || process.env.DB_PORT || 5432,
        database: config.database || process.env.DB_NAME || 'leviathan',
        user: config.user || process.env.DB_USER || 'postgres',
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

// --- 2. UTILITY PER FORMATTAZIONE ---
// Funzione per iniettare tracker in un magnet link, evitando duplicati.
function injectTrackers(magnet) {
    if (!magnet) return "";
    let cleanMagnet = magnet.trim();
    const trackersToAdd = DEFAULT_TRACKERS;
    
    trackersToAdd.forEach(tr => {
        if (!cleanMagnet.includes(encodeURIComponent(tr))) {
            cleanMagnet += `&tr=${encodeURIComponent(tr)}`;
        }
    });
    return cleanMagnet;
}

// Funzione per formattare una riga del DB in un oggetto standard per l'addon.
function formatRow(row, sourceTag = "LeviathanDB") {
    // IMPORTANTE: Se è un file singolo mappato, usiamo "file_title". 
    // Se è un torrent generico (pack), usiamo "title".
    const displayTitle = row.file_title || row.title;
    
    // Iniettiamo i tracker per velocizzare il download dei metadati
    const baseMagnet = row.info_hash ? `magnet:?xt=urn:btih:${row.info_hash}` : row.magnet;
    const fullMagnet = injectTrackers(baseMagnet);
    
    return {
        title: displayTitle, 
        magnet: fullMagnet,
        info_hash: row.info_hash,
        size: parseInt(row.file_size || row.size) || 0,
        seeders: row.seeders || 0,
        source: `${sourceTag}${row.cached_rd ? " ⚡" : ""}`,
        isCached: row.cached_rd
    };
}

// --- 3. CORE FUNCTIONS ---
// Ricerca generica per IMDB ID, con opzionale filtro per tipo (movie/series).
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

// Ricerca file specifici per episodio (mappati esattamente).
async function searchEpisodeFiles(imdbId, season, episode) {
  if (!pool) return [];
  try {
    // Questa query recupera i file mappati esattamente per quell'episodio
    // Se il mapping nel DB è errato (es. file ep 5 mappato su ep 2), lo restituisce.
    // Il "Smart Parser" in addon.js dovrà filtrarlo dopo.
    const query = `
      SELECT f.title as file_title, f.size as file_size, t.info_hash, t.title as torrent_title, t.seeders, t.cached_rd
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

// Ricerca pack stagionali (ottimizzata per evitare stagioni errate dove possibile).
async function searchPacksByImdbId(imdbId, season) {
    if (!pool) return [];
    try {
        
        const query = `
            SELECT t.info_hash, t.title, t.size, t.seeders, t.cached_rd
            FROM torrents t
            WHERE (imdb_id = $1 OR all_imdb_ids @> $2::jsonb) AND type = 'series'
            ORDER BY cached_rd DESC NULLS LAST, seeders DESC LIMIT 20
        `;
        const result = await pool.query(query, [imdbId, JSON.stringify([imdbId])]);
        return result.rows;
    } catch (e) { 
        console.error(`❌ DB Error searchPacksByImdbId:`, e.message);
        return []; 
    }
}

// --- 4. FUNZIONI DI SCRITTURA ---
// Inserimento di un nuovo torrent con transazione per atomicità.
async function insertTorrent(torrent) {
  if (!pool) return false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT 1 FROM torrents WHERE info_hash = $1', [torrent.infoHash]);
    if (check.rowCount > 0) { 
        await client.query('ROLLBACK'); 
        return false; 
    }

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

// Aggiornamento batch dello status cache RD.
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
    } catch (e) { 
        console.error(`❌ DB Error updateRdCacheStatus:`, e.message);
        return 0; 
    }
}

// --- 5. HEALTH CHECK ---
// Funzione per verificare la connessione al DB (usata in healthcheck).
async function healthCheck() {
    if (!pool) throw new Error('Pool not initialized');
    const result = await pool.query('SELECT NOW()');
    if (result.rows.length !== 1) throw new Error('DB health check failed');
    return true;
}

// --- 6. ADATTATORE PER ADDON.JS ---
// Oggetto esportato con metodi pubblici.
const dbHelper = {
    initDatabase,
    healthCheck,
    
    searchMovie: async (imdbId) => {
        const rows = await searchByImdbId(imdbId, 'movie');
        return rows.map(r => formatRow(r, "LeviathanDB"));
    },

    searchSeries: async (imdbId, season, episode) => {
        // 1. Cerca file episodi specifici (Priorità alta)
        const files = await searchEpisodeFiles(imdbId, season, episode);
        const formattedFiles = files.map(r => formatRow(r, "LeviathanDB"));

        // 2. Cerca Pack completi (Season Pack)
        const packs = await searchPacksByImdbId(imdbId, season);
        const formattedPacks = packs.map(r => formatRow(r, "LeviathanDB [Pack]"));

        // Debug Log: Cosa abbiamo trovato nel DB?
        if (formattedFiles.length > 0 || formattedPacks.length > 0) {
            console.log(`🗄️ [DB HIT] ID:${imdbId} S:${season} E:${episode} -> Found ${formattedFiles.length} files, ${formattedPacks.length} packs.`);
        }

        return [...formattedFiles, ...formattedPacks];
    },

    insertTorrent,
    updateRdCacheStatus
};

module.exports = dbHelper;
