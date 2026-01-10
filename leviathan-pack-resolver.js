/**
 * 🦑 LEVIATHAN PACK RESOLVER SYSTEM (OPTIMIZED)
 * ------------------------------------------------
 * Modulo proprietario per la gestione avanzata dei Season Packs.
 * INCLUDE: Mutex Locking per evitare ban API RD/TB.
 */

const axios = require('axios');

// Helper per il Rate Limiting (Pausa tra le richieste)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Estensioni video supportate dal Core
const VIDEO_EXTENSIONS = /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|mpg|mpeg)$/i;

// --- MUTEX LOCKING SYSTEM ---
// Mappa per tenere traccia delle scansioni in corso.
// Evita che 10 richieste simultanee per lo stesso pack colpiscano l'API 10 volte.
const activeResolutions = new Map();

// Pattern Regex Proprietari per il riconoscimento S/E
const SMART_EPISODE_PATTERNS = [
    { pattern: /[sS](\d{1,2})[eE](\d{1,3})/, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /(?<!\w)(\d{1,2})[xX](\d{1,3})(?!\w)/, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /[sS]eason\s*(\d{1,2}).*?[eE]pisode\s*(\d{1,3})/i, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /[sS]tagione\s*(\d{1,2}).*?[eE]pisodio\s*(\d{1,3})/i, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /[^a-z]E(\d{1,3})[^0-9]/i, extract: (m, defaultSeason) => ({ season: defaultSeason, episode: parseInt(m[1]) }) },
    { pattern: /[-–—]\s*(\d{1,3})\s*[-–—]/, extract: (m, defaultSeason) => ({ season: defaultSeason, episode: parseInt(m[1]) }) },
    { pattern: /[eE]p\.?\s*(\d{1,3})(?!\d)/, extract: (m, defaultSeason) => ({ season: defaultSeason, episode: parseInt(m[1]) }) },
];

function parseSeasonEpisode(filename, defaultSeason = 1) {
    for (const { pattern, extract } of SMART_EPISODE_PATTERNS) {
        const match = filename.match(pattern);
        if (match) {
            return extract(match, defaultSeason);
        }
    }
    return null;
}

function extractSeasonFromPackTitle(torrentTitle) {
    const patterns = [
        /[sS](\d{1,2})(?![eExX\d])/,
        /[sS]eason\s*(\d{1,2})/i,
        /[sS]tagione\s*(\d{1,2})/i,
    ];
    for (const pattern of patterns) {
        const match = torrentTitle.match(pattern);
        if (match) return parseInt(match[1]);
    }
    return null;
}

function isVideoFile(filename) {
    return VIDEO_EXTENSIONS.test(filename);
}

/**
 * Interfaccia diretta con Real-Debrid API
 */
async function fetchFilesFromRealDebrid(infoHash, rdKey) {
    // Aumentato leggermente il delay per sicurezza
    await sleep(2100);

    const baseUrl = 'https://api.real-debrid.com/rest/1.0';
    const headers = { 'Authorization': `Bearer ${rdKey}` };

    try {
        console.log(`🦑 [LEVIATHAN-PACK] Scan started on RD: ${infoHash.substring(0, 8)}...`);
        const magnetLink = `magnet:?xt=urn:btih:${infoHash}`;

        // 1. Inserimento Magnet Temporaneo
        const addResponse = await axios.post(
            `${baseUrl}/torrents/addMagnet`,
            `magnet=${encodeURIComponent(magnetLink)}`,
            { headers, timeout: 30000 }
        ).catch(e => {
            if (e.response && e.response.status === 429) throw new Error("RD Rate Limit Hit");
            throw e;
        });

        if (!addResponse.data || !addResponse.data.id) {
            console.error('❌ [LEVIATHAN-PACK] RD Add Failed');
            return null;
        }

        const torrentId = addResponse.data.id;

        // 2. Analisi Struttura File
        const infoResponse = await axios.get(
            `${baseUrl}/torrents/info/${torrentId}`,
            { headers, timeout: 30000 }
        );

        if (!infoResponse.data || !infoResponse.data.files) {
            console.error('❌ [LEVIATHAN-PACK] Empty File Structure');
            await axios.delete(`${baseUrl}/torrents/delete/${torrentId}`, { headers }).catch(() => { });
            return null;
        }

        const files = infoResponse.data.files.map(f => ({
            id: f.id,
            path: f.path,
            bytes: f.bytes,
            selected: f.selected
        }));

        // 3. Cleanup immediato
        console.log(`🧹 [LEVIATHAN-PACK] Cleaning up temp torrent ${torrentId}`);
        await axios.delete(`${baseUrl}/torrents/delete/${torrentId}`, { headers }).catch(err => {
            console.warn(`⚠️ [LEVIATHAN-PACK] Cleanup warning: ${err.message}`);
        });

        console.log(`✅ [LEVIATHAN-PACK] Structure retrieved: ${files.length} files`);
        return { torrentId, files };
    } catch (error) {
        console.error(`❌ [LEVIATHAN-PACK] RD API Exception: ${error.message}`);
        return null;
    }
}

/**
 * Interfaccia diretta con Torbox API
 */
async function fetchFilesFromTorbox(infoHash, torboxKey) {
    const baseUrl = 'https://api.torbox.app/v1/api';
    const headers = { 'Authorization': `Bearer ${torboxKey}` };

    try {
        console.log(`🦑 [LEVIATHAN-PACK] Scan started on Torbox: ${infoHash.substring(0, 8)}...`);
        const magnetLink = `magnet:?xt=urn:btih:${infoHash}`;

        // 1. Create
        const addResponse = await axios.post(
            `${baseUrl}/torrents/createtorrent`,
            { magnet: magnetLink },
            { headers, timeout: 30000 }
        );

        if (!addResponse.data?.data?.torrent_id) {
            console.error('❌ [LEVIATHAN-PACK] Torbox Add Failed');
            return null;
        }

        const torrentId = addResponse.data.data.torrent_id;
        await sleep(2000); // Sync wait

        // 2. Fetch Info
        const infoResponse = await axios.get(
            `${baseUrl}/torrents/mylist`,
            { headers, params: { id: torrentId }, timeout: 30000 }
        );

        const torrent = infoResponse.data?.data?.find(t => t.id === torrentId);
        
        // Cleanup function
        const cleanup = async () => {
             console.log(`🧹 [LEVIATHAN-PACK] Cleaning up Torbox ID ${torrentId}`);
             await axios.get(`${baseUrl}/torrents/controltorrent`, {
                headers, params: { torrent_id: torrentId, operation: 'delete' }
            }).catch(() => { });
        };

        if (!torrent || !torrent.files) {
            console.error('❌ [LEVIATHAN-PACK] Empty Torbox Structure');
            await cleanup();
            return null;
        }

        const files = torrent.files.map((f, idx) => ({
            id: idx,
            path: f.name,
            bytes: f.size,
            selected: 1
        }));

        // 3. Cleanup
        await cleanup();

        return { torrentId, files };
    } catch (error) {
        console.error(`❌ [LEVIATHAN-PACK] Torbox API Exception: ${error.message}`);
        return null;
    }
}

async function processSeriesPackFiles(files, infoHash, seriesImdbId, targetSeason, dbHelper) {
    const videoFiles = files.filter(f => isVideoFile(f.path));
    const processedFiles = [];

    // console.log(`🧠 [LEVIATHAN-AI] Analyzing ${videoFiles.length} video streams...`);

    for (const file of videoFiles) {
        const filename = file.path.split('/').pop();
        const parsed = parseSeasonEpisode(filename, targetSeason);

        if (parsed && parsed.season === targetSeason) {
            processedFiles.push({
                info_hash: infoHash,
                file_index: file.id,
                title: filename,
                size: file.bytes,
                imdb_id: seriesImdbId,
                imdb_season: parsed.season,
                imdb_episode: parsed.episode
            });
        }
    }

    if (processedFiles.length > 0 && dbHelper?.insertEpisodeFiles) {
        try {
            const inserted = await dbHelper.insertEpisodeFiles(processedFiles);
            console.log(`💾 [LEVIATHAN-DB] Indexed ${inserted} streams permanently.`);
        } catch (error) {
            console.error(`⚠️ [LEVIATHAN-DB] Indexing warning: ${error.message}`);
        }
    }

    return processedFiles;
}

function findEpisodeFile(files, targetEpisode) {
    return files.find(f => f.imdb_episode === targetEpisode) || null;
}

/**
 * Logica interna per API Call e Processing (isolata per il Mutex)
 */
async function _performCloudScan(infoHash, config, seriesImdbId, season, dbHelper) {
    let filesResult = null;
    
    // Scelta Provider
    if (config.rd_key) {
        filesResult = await fetchFilesFromRealDebrid(infoHash, config.rd_key);
    } else if (config.torbox_key) {
        filesResult = await fetchFilesFromTorbox(infoHash, config.torbox_key);
    } else {
        console.error('❌ [LEVIATHAN-PACK] Missing API Credentials');
        return null;
    }

    if (!filesResult?.files?.length) {
        return null;
    }

    // Processamento
    return await processSeriesPackFiles(
        filesResult.files,
        infoHash,
        seriesImdbId,
        season,
        dbHelper
    );
}

/**
 * Funzione Principale: Pack Resolver
 */
async function resolveSeriesPackFile(infoHash, config, seriesImdbId, season, episode, dbHelper) {
    // 1. Cache First: Controllo DB Locale
    if (dbHelper?.searchEpisodeFiles) {
        try {
            const dbFiles = await dbHelper.searchEpisodeFiles(seriesImdbId, season, episode);
            const matchingFile = dbFiles.find(f => f.info_hash === infoHash);
            
            if (matchingFile) {
                console.log(`🚀 [LEVIATHAN-FAST] Cache Hit! Stream ready: ${matchingFile.file_title}`);
                return {
                    fileIndex: matchingFile.file_index,
                    fileName: matchingFile.file_title,
                    fileSize: matchingFile.file_size,
                    totalPackSize: matchingFile.torrent_size || 0, // Fallback se manca
                    source: 'leviathan_cache'
                };
            }
        } catch (error) {
            console.warn(`⚠️ [LEVIATHAN-DB] Cache miss/error: ${error.message}`);
        }
    }

    // 2. Controllo Concorrenza (MUTEX)
    // Se stiamo già scansionando questo hash, aspettiamo la promise esistente invece di farne una nuova
    if (activeResolutions.has(infoHash)) {
        console.log(`⏳ [LEVIATHAN-WAIT] Waiting for ongoing scan of ${infoHash.substring(0,8)}...`);
        try {
            // Attendiamo che il primo worker finisca di popolare il DB
            await activeResolutions.get(infoHash);
            
            // Riprova a leggere dal DB ora che è stato popolato
            if (dbHelper?.searchEpisodeFiles) {
                const dbFiles = await dbHelper.searchEpisodeFiles(seriesImdbId, season, episode);
                const matchingFile = dbFiles.find(f => f.info_hash === infoHash);
                if (matchingFile) {
                    return {
                        fileIndex: matchingFile.file_index,
                        fileName: matchingFile.file_title,
                        fileSize: matchingFile.file_size,
                        source: 'leviathan_cache_after_wait'
                    };
                }
            }
        } catch (err) {
            console.error(`❌ [LEVIATHAN-WAIT] Parent process failed: ${err.message}`);
        }
        // Se il lock fallisce o non trova nulla, usciamo
        return null;
    }

    // 3. Cloud Scan (Se non in cache e non in lock)
    console.log(`⚡ [LEVIATHAN-PACK] Initiating Cloud Scan for ${infoHash.substring(0, 8)}...`);
    
    // Creiamo la promise e la mettiamo nella mappa dei lock
    const scanPromise = _performCloudScan(infoHash, config, seriesImdbId, season, dbHelper);
    activeResolutions.set(infoHash, scanPromise);

    let processedFiles = [];
    try {
        processedFiles = await scanPromise;
    } catch (e) {
        console.error(`❌ [LEVIATHAN-CRASH] Scan error: ${e.message}`);
    } finally {
        // Rimuoviamo il lock SEMPRE, anche in caso di errore
        activeResolutions.delete(infoHash);
    }

    if (!processedFiles || processedFiles.length === 0) {
        console.log(`🚫 [LEVIATHAN-PACK] No valid files found or scan failed.`);
        return null;
    }

    // 4. Selezione Target
    const targetFile = findEpisodeFile(processedFiles, episode);
    
    // Calcolo size totale per riferimento
    // Nota: questo è un'approssimazione basata sui file video trovati
    const totalPackSize = processedFiles.reduce((sum, f) => sum + (f.size || 0), 0);

    if (!targetFile) {
        console.log(`🚫 [LEVIATHAN-PACK] Target E${episode} not found in this pack.`);
        return null;
    }

    console.log(`🎯 [LEVIATHAN-PACK] Target Locked: ${targetFile.title}`);
    return {
        fileIndex: targetFile.file_index,
        fileName: targetFile.title,
        fileSize: targetFile.size,
        totalPackSize: totalPackSize,
        source: 'cloud_scan'
    };
}

function isSeasonPack(torrentTitle) {
    const packPatterns = [
        /[sS]\d{1,2}(?![eExX])/,
        /[sS]eason\s*\d+(?!\s*[eE]pisode)/i,
        /[sS]tagione\s*\d+(?!\s*[eE]pisodio)/i,
        /\b(?:complete|completa|full)\b/i,
        /\[?(?:S\d+)?\s*(?:E\d+-E?\d+|\d+-\d+)\\]?/,
    ];
    const singleEpisodePattern = /[sS]\d{1,2}[eExX]\d{1,3}(?!\s*[-–—]\s*[eExX]?\d)/;
    if (singleEpisodePattern.test(torrentTitle)) return false;
    return packPatterns.some(pattern => pattern.test(torrentTitle));
}

module.exports = {
    parseSeasonEpisode,
    extractSeasonFromPackTitle,
    isVideoFile,
    isSeasonPack,
    resolveSeriesPackFile
};
