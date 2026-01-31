const axios = require('axios');

// =====================================================
// TORBOX CACHE CHECKER (ID GRABBER FIX)
// =====================================================

const TB_BASE_URL = 'https://api.torbox.app/v1/api';

async function checkHashes(hashes, token) {
    if (!hashes || hashes.length === 0) return {};

    const CHUNK_SIZE = 40;
    const results = {};

    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
        const chunk = hashes.slice(i, i + CHUNK_SIZE);
        const hashStr = chunk.join(',');

        try {
            const url = `${TB_BASE_URL}/torrents/checkcached`;
            const response = await axios.get(url, {
                params: {
                    hash: hashStr,
                    format: 'object',
                    list_files: 'true' 
                },
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 12000 
            });

            const data = response.data;

            if (data.success && data.data) {
                for (const [hash, info] of Object.entries(data.data)) {
                    const lowerHash = hash.toLowerCase();
                    let isCached = false;
                    let bestFile = null;
                    let realSize = 0;

                    if (info && info.size > 0) {
                        if (info.files && Array.isArray(info.files) && info.files.length > 0) {
                            
                            // Cerca video > 50MB
                            const videoFiles = info.files.filter(f => 
                                /\.(mkv|mp4|avi|mov|webm|iso)$/i.test(f.name) && 
                                !/sample|trailer/i.test(f.name) &&
                                f.size > 50 * 1024 * 1024 
                            );

                            if (videoFiles.length > 0) {
                                isCached = true;
                                bestFile = videoFiles.sort((a, b) => b.size - a.size)[0];
                                realSize = bestFile.size;
                            }
                        }
                    }

                    if (isCached) {
                        results[lowerHash] = {
                            cached: true,
                            torrent_title: info.name,
                            size: realSize || info.size,
                            file_title: bestFile ? bestFile.name : info.name,
                            file_size: realSize,
                            // FIX: Assicuriamoci che l'ID sia un numero valido
                            file_id: bestFile ? parseInt(bestFile.id) : null 
                        };
                    } else {
                        results[lowerHash] = { cached: false };
                    }
                }
            }
        } catch (error) {
            console.error(`❌ [TB Check] Errore API:`, error.message);
        }
    }
    return results;
}

async function checkCacheSync(items, token, dbHelper, limit = 20) {
    const toCheck = items.slice(0, limit);
    const hashes = toCheck.map(i => i.hash);
    
    const apiResults = await checkHashes(hashes, token);
    
    const results = {};
    const updates = [];

    for (const item of toCheck) {
        const hash = item.hash.toLowerCase();
        const apiRes = apiResults[hash];
        const isCachedNow = apiRes ? apiRes.cached : false;

        results[hash] = {
            cached: isCachedNow,
            file_title: apiRes?.file_title || null,
            file_size: apiRes?.file_size || null,
            // Passiamo l'ID assicurandoci che non sia undefined
            file_id: apiRes?.file_id !== undefined ? apiRes.file_id : null
        };

        updates.push({
            hash: hash,
            cached: isCachedNow, 
            torrent_title: apiRes?.torrent_title || null,
            size: apiRes?.size || null
        });
    }

    if (dbHelper && typeof dbHelper.updateTbCacheStatus === 'function' && updates.length > 0) {
        dbHelper.updateTbCacheStatus(updates).catch(() => {});
    }

    return results;
}

async function enrichCacheBackground(items, token, dbHelper) { return; }

module.exports = { checkCacheSync, enrichCacheBackground };
