// db-helper.js - GESTORE DATABASE
const { Pool } = require('pg');
// 1. IMPORTA LA CONFIGURAZIONE DAI MOTORI (per avere i tracker aggiornati)
const { CONFIG } = require("./engines"); 

let pool = null;

const dbHelper = {
    initDatabase: (config) => {
        if (pool) return;
        const connectionString = process.env.DATABASE_URL || config?.connectionString;
        
        if (!connectionString) {
            console.warn("⚠️ Nessuna DATABASE_URL trovata. Il DB non sarà attivo.");
            return;
        }

        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false }, 
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });
        
        pool.on('error', (err) => console.error('🔴 Errore inatteso client DB', err));
        console.log("✅ Connessione Database Inizializzata");
    },

    // Cerca Film per ID IMDb
    searchMovie: async (imdbId) => {
        if (!pool) return [];
        try {
            const query = `
                SELECT info_hash, title, size, seeders, cached_rd
                FROM torrents 
                WHERE (imdb_id = $1 OR all_imdb_ids @> $2::jsonb)
                AND type = 'movie'
                ORDER BY cached_rd DESC NULLS LAST, seeders DESC 
                LIMIT 50
            `;
            const res = await pool.query(query, [imdbId, JSON.stringify([imdbId])]);
            return res.rows.map(row => formatRow(row, "ilCorSaRoNeRo"));
        } catch (e) {
            console.error("Errore DB Movie:", e.message);
            return [];
        }
    },

    // Cerca Episodi Serie
    searchSeries: async (imdbId, season, episode) => {
        if (!pool) return [];
        try {
            // 1. File singoli
            const queryFiles = `
                SELECT t.info_hash, t.title, t.seeders, t.cached_rd, f.size, f.title as file_title
                FROM files f
                JOIN torrents t ON f.info_hash = t.info_hash
                WHERE f.imdb_id = $1 AND f.imdb_season = $2 AND f.imdb_episode = $3
                ORDER BY t.cached_rd DESC NULLS LAST, t.seeders DESC
                LIMIT 30
            `;
            const resFiles = await pool.query(queryFiles, [imdbId, season, episode]);
            
            // 2. Pack
            const queryPacks = `
                SELECT info_hash, title, size, seeders, cached_rd
                FROM torrents
                WHERE imdb_id = $1 AND type = 'series'
                ORDER BY cached_rd DESC NULLS LAST, seeders DESC
                LIMIT 20
            `;
            const resPacks = await pool.query(queryPacks, [imdbId]);

            const files = resFiles.rows.map(row => formatRow(row, "ilCorSaRoNeRo"));
            const packs = resPacks.rows.map(row => formatRow(row, "ilCorSaRoNeRo [Pack]"));
            
            return [...files, ...packs];
        } catch (e) {
            console.error("Errore DB Series:", e.message);
            return [];
        }
    }
};

// 2. FUNZIONE AGGIORNATA CON TURBO TRACKER
function formatRow(row, sourceTag) {
    // Creiamo il magnet base
    let magnet = `magnet:?xt=urn:btih:${row.info_hash}`;

    // Iniettiamo i tracker da CONFIG (se disponibili)
    // Questo è il trucco che usa engines.js per velocizzare l'avvio
    if (CONFIG && CONFIG.TRACKERS && Array.isArray(CONFIG.TRACKERS)) {
        CONFIG.TRACKERS.forEach(tr => {
            magnet += `&tr=${encodeURIComponent(tr)}`;
        });
    }

    return {
        title: row.title, 
        magnet: magnet, // Ora il magnet include i tracker!
        size: parseInt(row.size) || 0,
        seeders: row.seeders || 0,
        source: `${sourceTag}${row.cached_rd ? " ⚡" : ""}`, 
        isCached: row.cached_rd 
    };
}

module.exports = dbHelper;

