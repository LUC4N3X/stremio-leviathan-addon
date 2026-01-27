const axios = require('axios');

// =====================================================
// TORBOX CACHE CHECKER (Axios Version)
// =====================================================

const TB_BASE_URL = 'https://api.torbox.app/v1/api';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check cache status for hashes using Torbox API
 * Endpoint: GET /torrents/checkcached
 */
async function checkHashes(hashes, token) {
    if (!hashes || hashes.length === 0) return {};

    // Torbox allows comma separated hashes
    // We process in chunks to be safe (e.g. 50 at a time)
    const CHUNK_SIZE = 50;
    const results = {};

    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
        const chunk = hashes.slice(i, i + CHUNK_SIZE);
        const hashStr = chunk.join(',');

        try {
            // format=object gives us { "hash": { ... } } structure
            // list_files=true gives us file list for title/size
            const url = `${TB_BASE_URL}/torrents/checkcached`;
            
            const response = await axios.get(url, {
                params: {
                    hash: hashStr,
                    format: 'object',
                    list_files: 'true'
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 20000
            });

            const data = response.data;

            if (data.success && data.data) {
                for (const [hash, info] of Object.entries(data.data)) {
                    // Torbox checkcached usually returns simplified object. 
                    const isCached = !!info && Object.keys(info).length > 0;

                    if (isCached) {
                        // Extract best file match for title
                        let bestFile = null;
                        if (info.files && info.files.length > 0) {
                            // Find largest video file
                            bestFile = info.files
                                .filter(f => /\.(mkv|mp4|avi|mov)$/i.test(f.name))
                                .sort((a, b) => b.size - a.size)[0];
                        }

                        results[hash.toLowerCase()] = {
                            cached: true,
                            torrent_title: info.name,
                            size: info.size,
                            file_title: bestFile ? bestFile.name : info.name,
                            file_size: bestFile ? bestFile.size : info.size
                        };
                    } else {
                        results[hash.toLowerCase()] = { cached: false };
                    }
                }
            }

            // Rate limit safety
            await sleep(500);
        } catch (error) {
            console.error(`❌ [TB Cache] Request failed:`, error.message);
        }
    }

    return results;
}

/**
 * Check cache status for multiple hashes synchronously (blocks until complete)
 * Used for the top N torrents that the user will see immediately
 */
async function checkCacheSync(items, token, limit = 5) {
    const toCheck = items.slice(0, limit);
    const hashes = toCheck.map(i => i.hash);

    if (DEBUG_MODE) console.log(`🔄 [TB Cache] Checking ${hashes.length} hashes synchronously...`);
    const apiResults = await checkHashes(hashes, token);

    // Merge with original items to ensure structure
    const results = {};
    for (const item of toCheck) {
        const hash = item.hash.toLowerCase();
        const apiRes = apiResults[hash];

        results[hash] = {
            cached: apiRes ? apiRes.cached : false,
            file_title: apiRes?.file_title || null,
            file_size: apiRes?.file_size || null,
            torrent_title: apiRes?.torrent_title || null,
            size: apiRes?.size || null,
            fromLiveCheck: true
        };
    }

    if (DEBUG_MODE) console.log(`✅ [TB Cache] Sync check complete. ${Object.values(results).filter(r => r.cached).length}/${hashes.length} cached`);
    return results;
}

/**
 * Enrich cache in background (non-blocking)
 */
async function enrichCacheBackground(items, token, dbHelper) {
    if (!items || items.length === 0) return;
    
    // ⚠️ TRUE BACKGROUND: delayed start
    setTimeout(() => {
        (async () => {
            if (DEBUG_MODE) console.log(`🔄 [TB Cache Background] Starting enrichment for ${items.length} hashes...`);

            try {
                const hashes = items.map(i => i.hash);

                // 🚀 SPEEDUP: Check if already recently checked in DB (avoid API spam)
                let alreadyChecked = {};
                // Verifica sicura che il metodo esista prima di chiamarlo
                if (dbHelper && typeof dbHelper.getTbCachedAvailability === 'function') {
                    alreadyChecked = await dbHelper.getTbCachedAvailability(hashes);
                }

                // Filter out those recently checked
                const hashesTopCheck = hashes.filter(h => !alreadyChecked[h.toLowerCase()]);

                if (hashesTopCheck.length === 0) {
                    if (DEBUG_MODE) console.log(`⏭️  [TB Cache Background] All items already checked recently.`);
                    return;
                }

                const apiResults = await checkHashes(hashesTopCheck, token);

                // Save to DB
                if (dbHelper && typeof dbHelper.updateTbCacheStatus === 'function') {
                    const cacheUpdates = Object.entries(apiResults).map(([hash, data]) => ({
                        hash,
                        cached: data.cached,
                        torrent_title: data.torrent_title || null,
                        size: data.size || null,
                        file_title: data.file_title || null,
                        file_size: data.file_size || null
                    }));
                    
                    await dbHelper.updateTbCacheStatus(cacheUpdates);
                    if (DEBUG_MODE) console.log(`✅ [TB Cache Background] Updated ${cacheUpdates.length} items`);
                }

            } catch (error) {
                console.error(`❌ [TB Cache Background] Error:`, error.message);
            }
        })();
    }, 5000);
}

module.exports = {
    checkCacheSync,
    enrichCacheBackground
};
