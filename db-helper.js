// db-helper.js - FIXED COLUMN ERROR
const { Pool } = require('pg');
const axios = require('axios');

console.log("📂 Caricamento modulo db-helper (FIXED COLUMN ERROR)...");

// --- 1. GESTIONE TRACKER DINAMICI ---
const TRACKERS_URL = 'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt';

let ACTIVE_TRACKERS = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.demonoid.ch:6969/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://tracker.therarbg.to:6969/announce",
    "udp://opentracker.i2p.rocks:6969/announce"
];

async function updateTrackers() {
    try {
        const response = await axios.get(TRACKERS_URL, { timeout: 5000 });
        const list = response.data.trim().split('\n\n').filter(Boolean);
        if (list.length > 0) {
            ACTIVE_TRACKERS = list;
            console.log(`✅ Trackers aggiornati: ${ACTIVE_TRACKERS.length} attivi.`);
        }
    } catch (e) {
        console.warn(`⚠️ Errore update tracker (uso fallback): ${e.message}`);
    }
}

updateTrackers();
setInterval(updateTrackers, 6 * 60 * 60 * 1000);

// --- 2. CONFIGURAZIONE DATABASE ---
let pool = null;

function initDatabase(config = {}) {
    if (pool) {
        console.log("♻️ DB Pool già inizializzato.");
        return pool;
    }

    let sslConfig = false; 
    if (process.env.DB_SSL === 'true') {
        sslConfig = { rejectUnauthorized: false };
    }

    const poolConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: sslConfig }
    : {
        host: config.host || process.env.DB_HOST || 'localhost',
        port: config.port || process.env.DB_PORT || 5432,
        database: config.database || process.env.DB_NAME || 'torrent_library',
        user: config.user || process.env.DB_USER || 'postgres',
        password: config.password || process.env.DB_PASSWORD,
        ssl: sslConfig 
      };

    pool = new Pool({
        ...poolConfig,
        max: 40,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000, 
    });
    
    console.log(`✅ DB Pool Inizializzato (Target: ${poolConfig.host || 'Cloud'})`);
    return pool;
}

// --- 3. UTILITY ---

const KNOWN_PROVIDERS = [
    "ilCorSaRoNeRo", "Corsaro", "1337x", "1337X", "TorrentGalaxy", "TGX", "GalaxyRG",
    "RARBG", "Rarbg", "EZTV", "Eztv", "YTS", "YIFY", "MagnetDL", "TorLock",
    "PirateBay", "TPB", "ThePirateBay", "Nyaa", "RuTracker", "SolidTorrents"
];

function extractOriginalProvider(text) {
    if (!text) return null;
    const torrentioMatch = text.match(/🔍\s*([^\n]+)/);
    if (torrentioMatch) return torrentioMatch[1].trim();
    const mfMatch = text.match(/🔗\s*([^\n]+)/);
    if (mfMatch) return mfMatch[1].trim();
    const cometMatch = text.match(/🔎\s*([^\n]+)/);
    if (cometMatch) return cometMatch[1].trim();
    const lowerText = text.toLowerCase();
    for (const provider of KNOWN_PROVIDERS) {
        if (lowerText.includes(provider.toLowerCase())) return provider;
    }
    return null;
}

// --- 4. FUNZIONI DI RICERCA (CORRETTA) ---

async function getTorrents(imdbId, season, episode) {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
        let query;
        let params;

        // [MODIFICATO] RIMOSSO 't.magnet' DALLA QUERY PERCHÉ NON ESISTE NEL DB
        const selectFields = `
            SELECT t.title, TRIM(t.info_hash) as info_hash, t.size, t.seeders, t.provider, t.file_index
            FROM files f
            JOIN torrents t ON f.info_hash = t.info_hash
        `;

        if (season && episode) {
            // Logica Serie TV
            query = `${selectFields} WHERE f.imdb_id = $1 AND f.imdb_season = $2 AND f.imdb_episode = $3`;
            params = [imdbId, season, episode];
        } else {
            // Logica Film
            query = `${selectFields} WHERE f.imdb_id = $1 AND (f.imdb_season IS NULL OR f.imdb_season = 0)`;
            params = [imdbId];
        }

        const res = await client.query(query, params);
        
        return res.rows.map(row => ({
            title: row.title,
            info_hash: row.info_hash,
            size: parseInt(row.size),
            seeders: row.seeders,
            provider: row.provider,
            magnet: null, // Lasciamo null, addon.js lo ricostruirà dall'hash
            file_index: row.file_index
        }));

    } catch (e) {
        console.error(`❌ DB Read Error (${imdbId}): ${e.message}`);
        return [];
    } finally {
        client.release();
    }
}

// --- 5. FUNZIONI DI SCRITTURA (AUTO-LEARNING) ---

async function insertTorrent(meta, torrent) {
    if (!pool) return false;
    if (!torrent.info_hash) return false;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const cleanHash = torrent.info_hash.toLowerCase();
        const seeders = torrent.seeders || 0; 
        const size = torrent.size || 0;

        // Estrazione Provider
        let providerName = torrent.provider;
        const extracted = extractOriginalProvider(torrent.title);
        
        if (extracted) {
            providerName = extracted;
        } else if (!providerName || providerName === 'Torrentio' || providerName === 'P2P') {
            providerName = 'External';
        }

        const queryTorrent = `
            INSERT INTO torrents (info_hash, provider, title, size, seeders)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (info_hash) DO NOTHING; 
        `;
        
        const res = await client.query(queryTorrent, [cleanHash, providerName, torrent.title, size, seeders]);

        const queryFile = `
            INSERT INTO files (info_hash, imdb_id, imdb_season, imdb_episode, title)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING;
        `;

        const s = (meta.type === 'movie') ? null : meta.season;
        const e = (meta.type === 'movie') ? null : meta.episode;

        await client.query(queryFile, [cleanHash, meta.imdb_id, s, e, torrent.title]);

        await client.query('COMMIT');

        return (res.rowCount > 0);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`❌ DB Save Error: ${e.message}`);
        return false;
    } finally {
        client.release();
    }
}

async function updateRdCacheStatus(cacheResults) {
    if (!pool || !cacheResults.length) return 0;
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let updated = 0;
            for (const res of cacheResults) {
                if (!res.hash) continue;
                await client.query(
                    `UPDATE torrents SET cached_rd = $1, last_cached_check = NOW() WHERE info_hash = $2`, 
                    [res.cached, res.hash.toLowerCase()]
                );
                updated++;
            }
            await client.query('COMMIT');
            return updated;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) { 
        console.error(`❌ DB Error updateCache:`, e.message);
        return 0; 
    }
}

async function healthCheck() {
    if (!pool) throw new Error('Pool not initialized');
    await pool.query('SELECT 1'); 
    return true;
}

module.exports = {
    initDatabase,
    healthCheck,
    getTorrents,
    insertTorrent,
    updateRdCacheStatus
};
