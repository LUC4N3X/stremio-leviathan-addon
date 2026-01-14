const axios = require('axios');
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

// Video file extensions
const VIDEO_EXTENSIONS = /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|mpg|mpeg)$/i;

// --- 1. SISTEMA DI CODA GLOBALE (ANTI-THUNDERING HERD) ---
// Obbliga le richieste RD a mettersi in fila indiana.
class RequestQueue {
    constructor(concurrency = 1) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });
            this.process();
        });
    }

    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) return;
        
        this.running++;
        const task = this.queue.shift();
        
        try {
            await task();
        } finally {
            this.running--;
            // Pausa tattica di 300ms tra le richieste per far respirare le API
            await new Promise(r => setTimeout(r, 300)); 
            this.process();
        }
    }
}

// Istanza Globale della Coda per Real-Debrid
const rdGlobalQueue = new RequestQueue(1);

// --- 2. MUTEX LOCKING ---
// Mappa per tracciare le scansioni in corso ed evitare duplicati
const activeResolutions = new Map();

// Season/Episode parsing patterns
const SEASON_EPISODE_PATTERNS = [
    { pattern: /[sS](\d{1,2})[eE](\d{1,3})/, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /[sS](\d{1,2})[eE][pP](\d{1,3})/, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /(?<!\w)(\d{1,2})[xX](\d{1,3})(?!\w)/, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /[sS]eason\s*(\d{1,2}).*?[eE]pisode\s*(\d{1,3})/i, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /[sS]tagione\s*(\d{1,2}).*?[eE]pisodio\s*(\d{1,3})/i, extract: (m) => ({ season: parseInt(m[1]), episode: parseInt(m[2]) }) },
    { pattern: /[^a-z]E(\d{1,3})[^0-9]/i, extract: (m, defaultSeason) => ({ season: defaultSeason, episode: parseInt(m[1]) }) },
    { pattern: /[-–—]\s*(\d{1,3})\s*[-–—]/, extract: (m, defaultSeason) => ({ season: defaultSeason, episode: parseInt(m[1]) }) },
    { pattern: /[eE]p\.?\s*(\d{1,3})(?!\d)/, extract: (m, defaultSeason) => ({ season: defaultSeason, episode: parseInt(m[1]) }) },
];

function parseSeasonEpisode(filename, defaultSeason = 1) {
    for (const { pattern, extract } of SEASON_EPISODE_PATTERNS) {
        const match = filename.match(pattern);
        if (match) return extract(match, defaultSeason);
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

// --- API FETCHERS ---

/**
 * Ottiene la lista file da Real-Debrid (RAW)
 * Nota: Questa funzione sarà wrappata dalla Queue
 */
async function fetchFilesFromRealDebrid(infoHash, rdKey) {
    const baseUrl = 'https://api.real-debrid.com/rest/1.0';
    const headers = { 'Authorization': `Bearer ${rdKey}` };

    try {
        if (DEBUG_MODE) console.log(`🦑 [RD-SCAN] Starting raw scan for ${infoHash.substring(0, 8)}...`);
        const magnetLink = `magnet:?xt=urn:btih:${infoHash}`;

        // 1. Add Magnet
        const addResponse = await axios.post(
            `${baseUrl}/torrents/addMagnet`,
            `magnet=${encodeURIComponent(magnetLink)}`,
            { headers, timeout: 30000 }
        ).catch(e => {
            if (e.response && e.response.status === 429) throw new Error("RD Rate Limit Hit");
            throw e;
        });

        if (!addResponse.data?.id) throw new Error('Failed to add magnet to RD');
        const torrentId = addResponse.data.id;

        // 2. Info
        const infoResponse = await axios.get(
            `${baseUrl}/torrents/info/${torrentId}`,
            { headers, timeout: 30000 }
        );

        if (!infoResponse.data?.files) {
            await axios.delete(`${baseUrl}/torrents/delete/${torrentId}`, { headers }).catch(() => {});
            throw new Error('No files in torrent info');
        }

        const files = infoResponse.data.files.map((f) => ({
            id: f.id,
            path: f.path,
            bytes: f.bytes,
            selected: f.selected
        }));
        
        // 3. Cleanup
        await axios.delete(`${baseUrl}/torrents/delete/${torrentId}`, { headers }).catch(() => {});

        if (DEBUG_MODE) console.log(`✅ [RD-SCAN] Retrieved ${files.length} files`);
        return { torrentId, files };

    } catch (error) {
        if (DEBUG_MODE) console.error(`❌ [RD-ERROR] ${error.message}`);
        throw error;
    }
}

/**
 * Ottiene la lista file da Torbox
 */
async function fetchFilesFromTorbox(infoHash, torboxKey) {
    const baseUrl = 'https://api.torbox.app/v1/api';
    const headers = { 'Authorization': `Bearer ${torboxKey}` };

    try {
        // 1. Check Cached (Fast Path)
        try {
            const cacheResponse = await axios.get(`${baseUrl}/torrents/checkcached`, {
                headers,
                params: { hash: infoHash.toUpperCase(), format: 'object', list_files: true },
                timeout: 10000
            });

            const cacheData = cacheResponse.data?.data;
            if (cacheData && typeof cacheData === 'object') {
                const hashKey = Object.keys(cacheData).find(k => k.toLowerCase() === infoHash.toLowerCase());
                if (hashKey && cacheData[hashKey]?.files?.length > 0) {
                    const rawFiles = cacheData[hashKey].files;
                    const sortedFiles = [...rawFiles].sort((a, b) => (a.name || a.path || '').localeCompare(b.name || b.path || ''));
                    const files = sortedFiles.map((f, idx) => ({
                        id: idx,
                        path: f.name || f.path || `file_${idx}`,
                        bytes: f.size || 0,
                        selected: 1
                    }));
                    return { torrentId: 'cached', files };
                }
            }
        } catch (cacheError) {}

        // 2. Fallback Slow Path
        const magnetLink = `magnet:?xt=urn:btih:${infoHash}`;
        const addResponse = await axios.post(`${baseUrl}/torrents/createtorrent`, { magnet: magnetLink }, { headers, timeout: 30000 });
        
        if (!addResponse.data?.data?.torrent_id) throw new Error('Failed to add magnet to Torbox');
        
        const torrentId = addResponse.data.data.torrent_id;
        await new Promise(resolve => setTimeout(resolve, 2000));

        const infoResponse = await axios.get(`${baseUrl}/torrents/mylist`, { headers, params: { id: torrentId }, timeout: 30000 });
        const torrent = infoResponse.data?.data?.find(t => t.id === torrentId);
        
        // Cleanup
        await axios.get(`${baseUrl}/torrents/controltorrent`, { headers, params: { torrent_id: torrentId, operation: 'delete' } }).catch(() => {});

        if (!torrent?.files) throw new Error('No files in Torbox torrent info');

        const hasFileIds = torrent.files.length > 0 && torrent.files[0].id !== undefined;
        let files;
        if (hasFileIds) {
            files = torrent.files.map((f) => ({ id: f.id, path: f.name, bytes: f.size, selected: 1 }));
        } else {
            const sortedFiles = [...torrent.files].sort((a, b) => (a.name || a.path || '').localeCompare(b.name || b.path || ''));
            files = sortedFiles.map((f, idx) => ({ id: idx, path: f.name, bytes: f.size, selected: 1 }));
        }

        return { torrentId, files };
    } catch (error) {
        console.error(`❌ [TB-ERROR] ${error.message}`);
        throw error;
    }
}

// --- HELPER DI SCANSIONE SICURA (ROUTING) ---
async function _performSafeCloudScan(infoHash, config) {
    if (config.rd_key) {
        // WRAPPER QUEUE: Qui avviene la magia anti-ban
        return await rdGlobalQueue.add(() => fetchFilesFromRealDebrid(infoHash, config.rd_key));
    } else if (config.torbox_key) {
        // Torbox non ha limiti severi come RD sulle addMagnet, ma volendo si può mettere in queue
        return await fetchFilesFromTorbox(infoHash, config.torbox_key);
    }
    throw new Error("No valid API Key provided");
}

// --- PROCESSAMENTO DB ---

async function processSeriesPackFiles(files, infoHash, seriesImdbId, targetSeason, dbHelper, torrentTitle = null, totalPackSize = 0) {
    const videoFiles = files.filter(f => isVideoFile(f.path));
    const processedFiles = [];

    if (DEBUG_MODE) console.log(`🔍 [PACK-PROCESS] Analyzing ${videoFiles.length} video files...`);

    for (const file of videoFiles) {
        if (file.bytes < 25 * 1024 * 1024) continue; // Ignore < 25MB

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

    // Insert Parent Torrent (for FK)
    if (processedFiles.length > 0 && dbHelper?.insertTorrent && torrentTitle) {
        try {
            await dbHelper.insertTorrent({
                infoHash: infoHash.toLowerCase(),
                title: torrentTitle,
                provider: 'pack-handler',
                size: totalPackSize || null,
                type: 'series',
                seeders: 0,
                imdbId: seriesImdbId
            });
        } catch (error) {
             if (!error.message.includes('already exists')) console.warn(`⚠️ [DB] Parent insert warning: ${error.message}`);
        }
    }

    // Insert Episodes
    if (processedFiles.length > 0 && dbHelper?.insertEpisodeFiles) {
        try {
            const inserted = await dbHelper.insertEpisodeFiles(processedFiles);
            if (DEBUG_MODE) console.log(`💾 [DB] Saved ${inserted} episode files`);
        } catch (error) {
            console.error(`❌ [DB] Failed to save: ${error.message}`);
        }
    }

    return processedFiles;
}

function findEpisodeFile(files, targetEpisode) {
    return files.find(f => f.imdb_episode === targetEpisode) || null;
}

// --- MAIN RESOLVERS ---

async function resolveSeriesPackFile(infoHash, config, seriesImdbId, season, episode, dbHelper) {
    // 1️⃣ CACHE LEVEL 1: DB Locale
    if (dbHelper?.getSeriesPackFiles) {
        try {
            const cachedFiles = await dbHelper.getSeriesPackFiles(infoHash);
            if (cachedFiles && cachedFiles.length > 0) {
                if (DEBUG_MODE) console.log(`🚀 [CACHE-HIT] Found files in DB for ${infoHash.substring(0, 8)}`);
                
                const totalPackSize = cachedFiles.reduce((acc, f) => acc + f.bytes, 0);
                const processed = await processSeriesPackFiles(cachedFiles, infoHash, seriesImdbId, season, dbHelper, null, totalPackSize);
                const match = findEpisodeFile(processed, episode);

                if (match) {
                    return {
                        fileIndex: match.file_index,
                        fileName: match.title,
                        fileSize: match.size,
                        source: "DB_CACHE",
                        totalPackSize
                    };
                } else {
                    return null; // Pack indexed, episode missing
                }
            }
        } catch (err) {
            console.warn(`⚠️ DB Check failed: ${err.message}`);
        }
    }

    // 2️⃣ CACHE LEVEL 2: Mutex Locking (Wait for concurrent scan)
    if (activeResolutions.has(infoHash)) {
        console.log(`⏳ [WAIT] Joining ongoing scan for ${infoHash.substring(0,8)}...`);
        try {
            // Attendiamo la promise dell'altro processo
            await activeResolutions.get(infoHash);
            
            // Riprova Cache dopo attesa
            if (dbHelper?.getSeriesPackFiles) {
                const cachedFiles = await dbHelper.getSeriesPackFiles(infoHash);
                const processed = await processSeriesPackFiles(cachedFiles || [], infoHash, seriesImdbId, season, dbHelper);
                const match = findEpisodeFile(processed, episode);
                if (match) {
                     return {
                        fileIndex: match.file_index,
                        fileName: match.title,
                        fileSize: match.size,
                        source: "DB_CACHE_DELAYED",
                        totalPackSize: processed.reduce((a,b) => a+b.size, 0)
                    };
                }
            }
        } catch (err) {
            console.error(`❌ [WAIT-ERROR] Parent scan failed: ${err.message}`);
        }
        return null; // Se il parent fallisce o non trova il file
    }

    // 3️⃣ CLOUD SCAN (Queued & Locked)
    console.log(`⚡ [QUEUE] Queuing scan for ${infoHash.substring(0, 8)}...`);
    
    // Creiamo il task
    const scanTask = async () => {
        const fetchedData = await _performSafeCloudScan(infoHash, config);
        if (!fetchedData?.files) return null;

        const totalPackSize = fetchedData.files.reduce((acc, f) => acc + f.bytes, 0);
        const allVideoFiles = fetchedData.files.filter(f => isVideoFile(f.path));
        const firstVideoFile = allVideoFiles[0];
        const generatedTitle = firstVideoFile ? firstVideoFile.path.split('/')[0] || firstVideoFile.path : `Pack-${infoHash.substring(0, 16)}`;

        return await processSeriesPackFiles(
            fetchedData.files,
            infoHash,
            seriesImdbId,
            season,
            dbHelper,
            generatedTitle,
            totalPackSize
        );
    };

    // Impostiamo il lock con la Promise
    const scanPromise = scanTask();
    activeResolutions.set(infoHash, scanPromise);

    let processedFiles = [];
    try {
        const result = await scanPromise;
        processedFiles = result || [];
    } catch (e) {
        if (e.message?.includes('429')) throw new Error(`RATE_LIMITED: ${e.message}`); // Rethrow for upstream handling
        console.warn(`⚠️ Scan warning: ${e.message}`);
    } finally {
        activeResolutions.delete(infoHash); // Release Lock
    }

    // 4. Find Target
    const targetFile = findEpisodeFile(processedFiles, episode);

    if (!targetFile) {
        if (DEBUG_MODE) console.log(`❌ Episode ${episode} not found in pack.`);
        return null;
    }

    if (DEBUG_MODE) console.log(`🎯 Target Locked: ${targetFile.title}`);
    return {
        fileIndex: targetFile.file_index,
        fileName: targetFile.title,
        fileSize: targetFile.size,
        totalPackSize: processedFiles.reduce((a,b)=>a+b.size, 0),
        source: 'debrid_api'
    };
}

// --- MOVIE RESOLVER (UPDATED WITH QUEUE) ---

async function resolveMoviePackFile(infoHash, config, movieImdbId, targetTitles, year, dbHelper, forceRefresh = false) {
    console.log(`🎬 [PACK-MOVIE] Resolving "${targetTitles}" (${year}) in ${infoHash.substring(0, 8)}${forceRefresh ? ' (REFRESH)' : ''}...`);

    let totalPackSize = 0;
    let videoFiles = [];
    let dbCacheCorrupted = forceRefresh;
    const PACK_TTL_DAYS = 30;

    // 1️⃣ CHECK DB CACHE
    if (!forceRefresh && dbHelper?.getPackFiles) {
        try {
            const { files: cachedFiles, expired } = await dbHelper.getPackFiles(infoHash.toLowerCase(), PACK_TTL_DAYS);
            
            if (cachedFiles && cachedFiles.length > 0 && !expired) {
                console.log(`🚀 [CACHE-HIT] Using ${cachedFiles.length} files from DB`);
                videoFiles = cachedFiles
                    .filter(f => isVideoFile(f.file_path) && f.file_size > 25 * 1024 * 1024)
                    .map(f => ({ id: f.file_index, path: f.file_path, bytes: parseInt(f.file_size) || 0 }));
                totalPackSize = cachedFiles.reduce((acc, f) => acc + (parseInt(f.file_size) || 0), 0);
            } else if (expired) {
                console.log(`⏰ Cache expired. Refreshing...`);
                dbCacheCorrupted = true;
            } else {
                dbCacheCorrupted = true;
            }
        } catch (err) {
            console.warn(`⚠️ DB Check failed: ${err.message}`);
        }
    }

    // 2️⃣ MUTEX CHECK (For Movies too!)
    if (activeResolutions.has(infoHash)) {
        console.log(`⏳ [WAIT] Joining ongoing movie scan...`);
        try {
            await activeResolutions.get(infoHash);
            // Retry DB fetch after wait
            if (dbHelper?.getPackFiles) {
                 const { files: retryFiles } = await dbHelper.getPackFiles(infoHash.toLowerCase(), PACK_TTL_DAYS);
                 if (retryFiles?.length > 0) {
                     videoFiles = retryFiles.map(f => ({ id: f.file_index, path: f.file_path, bytes: parseInt(f.file_size) }));
                     totalPackSize = retryFiles.reduce((acc, f) => acc + parseInt(f.file_size), 0);
                 }
            }
        } catch (e) {}
    }

    // 3️⃣ CLOUD SCAN (Queued)
    if (videoFiles.length === 0) {
        console.log(`⚡ [QUEUE] Queuing MOVIE scan...`);
        
        const scanTask = async () => {
            const fetchedData = await _performSafeCloudScan(infoHash, config);
            if (!fetchedData?.files) return [];
            
            const vFiles = fetchedData.files.filter(f => isVideoFile(f.path) && f.bytes > 25 * 1024 * 1024);
            
            // Save to DB
            if (dbHelper?.insertPackFiles && vFiles.length > 1) {
                try {
                    const packFilesData = vFiles.map(f => ({
                        pack_hash: infoHash.toLowerCase(),
                        imdb_id: null,
                        file_index: f.id,
                        file_path: f.path,
                        file_size: f.bytes || 0
                    }));
                    await dbHelper.insertPackFiles(packFilesData);
                } catch (e) { console.warn(`⚠️ DB Save warning: ${e.message}`); }
            }
            return vFiles;
        };

        const scanPromise = scanTask();
        activeResolutions.set(infoHash, scanPromise);

        try {
            videoFiles = await scanPromise;
            totalPackSize = videoFiles.reduce((acc, f) => acc + f.bytes, 0);
        } catch (e) {
            if (e.message?.includes('429')) throw new Error(`RATE_LIMITED: ${e.message}`);
            console.warn(`⚠️ Movie scan failed: ${e.message}`);
        } finally {
            activeResolutions.delete(infoHash);
        }
    }

    if (videoFiles.length === 0) return null;

    // 4. Logic Matching
    if (videoFiles.length === 1) {
        // Single file logic
        const f = videoFiles[0];
        if (dbHelper && movieImdbId) {
            await dbHelper.insertEpisodeFiles([{
                info_hash: infoHash,
                file_index: f.id,
                title: f.path.split('/').pop(),
                size: f.bytes,
                imdb_id: movieImdbId,
                imdb_season: null,
                imdb_episode: null
            }]).catch(()=>{});
        }
        return { fileIndex: f.id, fileName: f.path.split('/').pop(), fileSize: f.bytes, source: "debrid_api", totalPackSize };
    }

    // Fuzzy Match
    const match = findMovieFile(videoFiles, targetTitles, year);

    if (match) {
        if (dbHelper && movieImdbId) {
            // Index ALL files
             const allFilesToSave = videoFiles.map(f => ({
                info_hash: infoHash,
                file_index: f.id,
                title: f.path.split('/').pop(),
                size: f.bytes,
                imdb_id: (f.id === match.id) ? movieImdbId : null,
                imdb_season: null,
                imdb_episode: null
            }));
            await dbHelper.insertEpisodeFiles(allFilesToSave).catch(()=>{});
            
            // Update Pack Files
            if (dbHelper.insertPackFiles) {
                await dbHelper.insertPackFiles([{
                    pack_hash: infoHash.toLowerCase(),
                    imdb_id: movieImdbId,
                    file_index: match.id,
                    file_path: match.path,
                    file_size: match.bytes
                }]).catch(()=>{});
            }
        }
        return { fileIndex: match.id, fileName: match.path.split('/').pop(), fileSize: match.bytes, source: 'debrid_api', totalPackSize };
    }

    return null;
}

// --- UTILS ---

function isSeasonPack(torrentTitle) {
    const packPatterns = [
        /[sS]\d{1,2}(?![eExX])/,
        /[sS]eason\s*\d+(?!\s*[eE]pisode)/i,
        /[sS]tagione\s*\d+(?!\s*[eE]pisodio)/i,
        /\b(?:part|parte|vol|volume)\s*\d+/i,
        /\b(?:complete|completa|full)\b/i,
        /\[?(?:S\d+)?\s*(?:E\d+-E?\d+|\d+-\d+)\]?/,
    ];
    const singleEpisodePattern = /[sS]\d{1,2}[eExX]\d{1,3}(?!\d)(?!\s*[-–—]\s*[eExX]?\d)/;
    if (singleEpisodePattern.test(torrentTitle)) return false;
    return packPatterns.some(pattern => pattern.test(torrentTitle));
}

function findMovieFile(files, targetTitles, targetYear) {
    if (!files || files.length === 0) return null;
    const titles = Array.isArray(targetTitles) ? targetTitles : [targetTitles];
    const cleanTitle = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

    let bestMatch = null;
    let maxScore = 0;

    for (const file of files) {
        const filename = file.path.split('/').pop().toLowerCase();
        let bestTitleScoreForFile = 0;

        for (const title of titles) {
            if (!title) continue;
            let score = 0;
            const targetWords = cleanTitle(title);
            if (targetYear && filename.includes(targetYear)) score += 50;
            let matchedWords = 0;
            for (const word of targetWords) {
                if (filename.includes(word)) matchedWords++;
            }
            if (targetWords.length > 0) score += (matchedWords / targetWords.length) * 50;
            if (score > bestTitleScoreForFile) bestTitleScoreForFile = score;
        }

        if (filename.includes('trailer') || filename.includes('sample')) bestTitleScoreForFile -= 50;

        if (bestTitleScoreForFile > maxScore && bestTitleScoreForFile > 60) {
            maxScore = bestTitleScoreForFile;
            bestMatch = file;
        }
    }
    return bestMatch;
}

module.exports = {
    resolveSeriesPackFile,
    processSeriesPackFiles,
    isSeasonPack,
    isVideoFile,
    parseSeasonEpisode,
    resolveMoviePackFile
};
