// db-helper.js - GOD TIER EDITION (FIX COLONNE DB)
const { Pool } = require('pg');
const axios = require('axios');

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

// Avvia update e poi ogni 6 ore
updateTrackers();
setInterval(updateTrackers, 6 * 60 * 60 * 1000);

// --- 2. CONFIGURAZIONE DATABASE ---
let pool = null;

const SQL_ITA_FILTER = `AND (t.title ~* '\\y(ita|italian|italy|multi|dual|corsaro)\\y' OR f.title ~* '\\y(ita|italian|italy|multi|dual|corsaro)\\y')`;
const SQL_ITA_FILTER_PACK = `AND (t.title ~* '\\y(ita|italian|italy|multi|dual|corsaro)\\y')`;

function initDatabase(config = {}) {
  if (pool) return pool;

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
   
  console.log(`✅ DB Pool Initialized (Target: ${poolConfig.host})`);
  return pool;
}

// --- 3. UTILITY & PROVIDER EXTRACTION ---

// Lista Provider Noti (Case Insensitive)
const KNOWN_PROVIDERS = [
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
    const lowerText = text.toLowerCase();
    for (const provider of KNOWN_PROVIDERS) {
        if (lowerText.includes(provider.toLowerCase())) {
            return provider;
        }
    }

    return null;
}

function injectTrackers(magnet) {
    if (!magnet) return "";
    let cleanMagnet = magnet.trim();
    ACTIVE_TRACKERS.forEach(tr => {
        if (!cleanMagnet.includes(encodeURIComponent(tr))) {
            cleanMagnet += `&tr=${encodeURIComponent(tr)}`;
        }
    });
    return cleanMagnet;
}

function formatRow(row) {
    const displayTitle = row.file_title || row.title;
    const baseMagnet = `magnet:?xt=urn:btih:${row.info_hash}`;
    const fullMagnet = injectTrackers(baseMagnet);
    
    const sourceName = row.provider || "P2P"; 
    
    return {
        title: displayTitle, 
        magnet: fullMagnet,
        info_hash: row.info_hash,
        size: parseInt(row.file_size || row.size) || 0,
        seeders: row.seeders || 0,
        source: `${sourceName}${row.cached_rd ? " ⚡" : ""}`,
        isCached: row.cached_rd
    };
}

function isPackRelevant(title, targetSeason) {
    if (!title) return false;
    const cleanTitle = title.toLowerCase();
    const s = parseInt(targetSeason);
    
    if (/\b(complete|total|collection|anthology|tutte le stagioni|serie completa)\b/i.test(cleanTitle)) return true;
    
    const rangeMatch = cleanTitle.match(/s(\d{1,2})\s*-\s*s?(\d{1,2})/i);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        return s >= start && s <= end;
    }
    
    const seasonMatch = cleanTitle.match(/\b(s|season|stagione)\s?0?(\d{1,2})\b/i);
    if (seasonMatch) {
        return parseInt(seasonMatch[2]) === s;
    }
    return false;
}

// --- 4. FUNZIONI DI RICERCA ---

async function searchMovie(imdbId) {
  if (!pool) return [];
  try {
    const query = `
      SELECT t.info_hash, t.provider, t.title, t.size, t.seeders, t.cached_rd
      FROM files f
      JOIN torrents t ON f.info_hash = t.info_hash
      WHERE f.imdb_id = $1
      ${SQL_ITA_FILTER}
      ORDER BY t.cached_rd DESC, t.seeders DESC
      LIMIT 50
    `;
    const result = await pool.query(query, [imdbId]);
    return result.rows.map(r => formatRow(r));
  } catch (error) {
    console.error(`❌ DB Error searchMovie:`, error.message);
    return [];
  }
}

async function searchEpisodeFiles(imdbId, season, episode) {
  if (!pool) return [];
  try {
    const query = `
      SELECT f.title as file_title, f.size as file_size, t.info_hash, t.provider, t.title as torrent_title, t.seeders, t.cached_rd
      FROM files f
      JOIN torrents t ON f.info_hash = t.info_hash
      WHERE f.imdb_id = $1 AND f.imdb_season = $2 AND f.imdb_episode = $3
      ${SQL_ITA_FILTER} 
      ORDER BY t.cached_rd DESC, t.seeders DESC
      LIMIT 30
    `;
    const result = await pool.query(query, [imdbId, season, episode]);
    return result.rows.map(r => formatRow(r));
  } catch (error) {
    console.error(`❌ DB Error searchEpisodeFiles:`, error.message);
    return [];
  }
}

async function searchPacksByImdbId(imdbId, season) {
    if (!pool) return [];
    try {
        const query = `
            SELECT DISTINCT ON (t.info_hash) t.info_hash, t.provider, t.title, t.size, t.seeders, t.cached_rd
            FROM files f
            JOIN torrents t ON f.info_hash = t.info_hash
            WHERE f.imdb_id = $1 
            AND (f.imdb_season = $2 OR f.imdb_season IS NULL) 
            ${SQL_ITA_FILTER_PACK}
            ORDER BY t.info_hash, t.seeders DESC 
            LIMIT 100
        `;
        
        const result = await pool.query(query, [imdbId, season]);
        const validPacks = result.rows.filter(row => isPackRelevant(row.title, season));
        
        return validPacks.slice(0, 15).map(r => {
             const formatted = formatRow(r);
             formatted.title = `📦 [PACK] ${formatted.title}`;
             formatted.isPack = true; 
             return formatted;
        }); 

    } catch (e) { 
        console.error(`❌ DB Error searchPacksByImdbId:`, e.message);
        return []; 
    }
}

// --- 5. FUNZIONI DI SCRITTURA (FIX COLONNE) ---

async function insertTorrent(meta, torrent) {
    if (!pool) return false;
    
    // Validazione base
    if (!torrent.info_hash) return false;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Pulizia Dati
        const cleanHash = torrent.info_hash.toLowerCase();
        const seeders = torrent.seeders || 0; 
        const size = torrent.size || 0;

        // 2. ESTRAZIONE PROVIDER
        let providerName = torrent.provider;
        
        // Se il provider è generico o vuoto, cerchiamo nel titolo
        const extracted = extractOriginalProvider(torrent.title);
        
        if (extracted) {
            providerName = extracted;
        } else if (!providerName || providerName === 'Torrentio' || providerName === 'P2P') {
            providerName = 'External';
        }

        // 3. Inserimento/Aggiornamento Torrent
        // 🔥 RIMOSSO created_at perché non esiste nella tabella
        const queryTorrent = `
            INSERT INTO torrents (info_hash, provider, title, size, seeders)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (info_hash) 
            DO UPDATE SET 
                seeders = GREATEST(torrents.seeders, EXCLUDED.seeders),
                title = EXCLUDED.title, 
                provider = EXCLUDED.provider,
                last_cached_check = NOW(); -- Questo aggiorna il timestamp se il torrent esiste già
        `;
        
        await client.query(queryTorrent, [
            cleanHash,
            providerName, 
            torrent.title,
            size,
            seeders
        ]);

        // 4. Collegamento File -> IMDb
        const queryFile = `
            INSERT INTO files (info_hash, imdb_id, imdb_season, imdb_episode, title)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING;
        `;

        const s = (meta.type === 'movie') ? null : meta.season;
        const e = (meta.type === 'movie') ? null : meta.episode;

        await client.query(queryFile, [
            cleanHash,
            meta.imdb_id,
            s,
            e,
            torrent.title
        ]);

        await client.query('COMMIT');
        return true;

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
        let updated = 0;
        try {
            await client.query('BEGIN');
            for (const res of cacheResults) {
                if (!res.hash) continue;
                await client.query(
                    `UPDATE torrents SET cached_rd = $1, last_cached_check = NOW() WHERE info_hash = $2`, 
                    [res.cached, res.hash.toLowerCase()]
                );
                updated++;
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        return updated;
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

// --- EXPORT FINALE ---

const dbHelper = {
    initDatabase,
    healthCheck,
    searchMovie, 
    searchSeries: async (imdbId, season, episode) => {
        const [files, packs] = await Promise.all([
            searchEpisodeFiles(imdbId, season, episode),
            searchPacksByImdbId(imdbId, season)
        ]);
        return [...files, ...packs];
    },
    insertTorrent,
    updateRdCacheStatus
};

module.exports = dbHelper;
