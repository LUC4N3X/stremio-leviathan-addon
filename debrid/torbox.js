const axios = require("axios");
const https = require("https");
const TB_BASE = "https://api.torbox.app/v1/api"; 
const TB_TIMEOUT = 60000; 

// --- CACHE IN MEMORIA ---
let globalListCache = { data: null, timestamp: 0 };

const PUBLIC_TRACKERS = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://tracker.coppersurfer.tk:6969/announce",
    "udp://tracker.leechers-paradise.org:6969/announce",
    "udp://9.rarbg.to:2710/announce",
    "udp://tracker.openbittorrent.com:80/announce",
    "udp://opentracker.i2p.rocks:6969/announce"
];

const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });
const COMMON_HEADERS = {
    'User-Agent': 'Leviathan/1.0 (TorBoxModule)'
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Wrapper Richieste
async function tbRequest(method, endpoint, key, data = null, params = null) {
    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
        try {
            const config = {
                method, 
                url: `${TB_BASE}${endpoint}`,
                headers: { ...COMMON_HEADERS, 'Authorization': `Bearer ${key}` },
                timeout: TB_TIMEOUT, 
                params,
                httpsAgent
            };
            if (method === 'POST' && data) {
                const formData = new URLSearchParams();
                for (const k in data) formData.append(k, data[k]);
                config.data = formData;
                config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            return await axios(config);
        } catch (e) {
            const status = e.response?.status;
            if (status === 429) {
                await sleep(5000);
                attempt++;
                continue;
            }
            if (status >= 500 || e.code === 'ECONNABORTED') {
                await sleep(1500 * (attempt + 1));
                attempt++;
                continue;
            }
            return e.response;
        }
    }
    return null;
}

// Recupera lista utente
async function getUserList(key, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && globalListCache.data && (now - globalListCache.timestamp) < 60000) {
        return globalListCache.data;
    }
    const listRes = await tbRequest('GET', '/torrents/mylist', key, null, { bypass_cache: true });
    if (listRes?.data?.data) {
        const sorted = Array.isArray(listRes.data.data) 
            ? listRes.data.data.sort((a, b) => b.id - a.id) 
            : listRes.data.data;
        globalListCache = { data: sorted, timestamp: now };
        return sorted;
    }
    return null;
}

// Logica Free Space
async function freeUpSpace(key) {
    const list = await getUserList(key, true);
    if (!list || list.length === 0) return false;
    let sacrificialLamb = list
        .filter(t => ['completed', 'seeding', 'ready'].includes((t.download_state || '').toLowerCase()))
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
    if (!sacrificialLamb) {
        sacrificialLamb = list
            .filter(t => ['error', 'metaDL', 'stalled', 'downloading', 'paused'].includes((t.download_state || '').toLowerCase()))
            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
    }
    if (sacrificialLamb) {
        await tbRequest('POST', '/torrents/controltorrent', key, { torrent_id: sacrificialLamb.id, operation: "delete" });
        globalListCache.data = null; 
        await sleep(1000); 
        return true;
    }
    return false;
}

// Match File
function matchFile(files, season, episode) {
    if (!files || !files.length) return null;
    const getSafeId = (f) => f.id !== undefined ? f.id : (f.file_id !== undefined ? f.file_id : null);
    const getSafeSize = (f) => parseInt(f.size || 0);
    const isVideo = (name) => /\.(mkv|mp4|avi|mov|wmv|flv|webm|iso)$/i.test((name || "").trim()) && !/sample|trailer/i.test(name);

    const videoFiles = files.filter(f => isVideo(f.name) || isVideo(f.short_name));
    const candidates = videoFiles.length > 0 ? videoFiles : files;

    const isSeasonZero = !season || season == 0 || season == '0';
    const isEpisodeZero = !episode || episode == 0 || episode == '0';

    if (isSeasonZero && isEpisodeZero) {
        const bestFile = candidates.sort((a, b) => getSafeSize(b) - getSafeSize(a))[0];
        return bestFile ? getSafeId(bestFile) : null;
    }
    
    const s = parseInt(season);
    const e = parseInt(episode);
    const eStr = e.toString().padStart(2, '0');
    
    const regexes = [
        new RegExp(`S0*${s}.*?E0*${e}\\b`, 'i'),          
        new RegExp(`\\b${s}x0*${e}\\b`, 'i'),              
        new RegExp(`(^|\\D)${s}${eStr}(\\D|$)`),           
        new RegExp(`S0*${s}.*?E${e}\\b`, 'i'),             
        new RegExp(`(ep|episode)[^0-9]*0*${e}\\b`, 'i'),  
        new RegExp(`\\b${eStr}\\b`)                        
    ];

    for (const regex of regexes) {
        const found = candidates.find(f => regex.test(f.name || f.short_name || ""));
        if (found) return getSafeId(found);
    }
    
    const finalFallback = candidates.sort((a, b) => getSafeSize(b) - getSafeSize(a))[0];
    return getSafeId(finalFallback);
}

const TB = {
    checkCached: async (key, hashes) => { return []; },

    getStreamLink: async (key, magnet, season = null, episode = null, hash = null, forcedFileIdx = null, userIp = null) => {
        try {
            let torrentId = null;
            let files = null;
            let targetHash = hash;

            // Arricchimento Magnet
            let enhancedMagnet = magnet;
            if (enhancedMagnet && !enhancedMagnet.includes("tr=")) {
                 const trackersParams = PUBLIC_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
                 enhancedMagnet += trackersParams;
            }

            if (!targetHash) {
                const match = magnet.match(/btih:([a-zA-Z0-9]+)/i);
                targetHash = match ? match[1].toLowerCase() : null;
            } else {
                targetHash = targetHash.toLowerCase();
            }

            // 1. Check Cache Utente & AUTO-FIX
            if (targetHash) {
                const userList = await getUserList(key);
                if (userList) {
                    const found = userList.find(t => t.hash && t.hash.toLowerCase() === targetHash);
                    if (found) {
                        const badStates = ['error', 'metadl', 'stalled', 'downloading', 'paused'];
                        const state = (found.download_state || '').toLowerCase();
                        const isStuck = badStates.includes(state) && found.progress < 100;

                        if (isStuck) {
                            console.log(`🧹 [TorBox] Torrent BLOCCATO (${state}). Reset...`);
                            await tbRequest('POST', '/torrents/controltorrent', key, { torrent_id: found.id, operation: "delete" });
                            globalListCache.data = null;
                            torrentId = null; 
                        } else {
                            torrentId = found.id;
                            files = found.files;
                        }
                    }
                }
            }

            // 2. Add Torrent
            if (!torrentId) {
                const postData = { magnet: enhancedMagnet, seed: '1', allow_zip: 'false' };
                let createRes = await tbRequest('POST', '/torrents/createtorrent', key, postData);
                
                if (!createRes?.data?.success) {
                    const err = createRes?.data?.detail || createRes?.data?.error || "";
                    if (err.includes("limit") || err.includes("Active")) {
                         if (await freeUpSpace(key)) {
                             createRes = await tbRequest('POST', '/torrents/createtorrent', key, postData);
                         }
                    } else if (err.includes("exists")) {
                         await sleep(1000);
                         const userList = await getUserList(key, true);
                         const found = userList?.find(t => t.hash && t.hash.toLowerCase() === targetHash);
                         if (found) {
                             torrentId = found.id;
                             files = found.files;
                         }
                    }
                }

                if (!torrentId && createRes?.data?.success) {
                    torrentId = createRes.data.data.torrent_id || createRes.data.data.id;
                    files = createRes.data.data.files;
                    globalListCache.data = null; 
                }

                if (!torrentId) throw new Error(`Add Failed: ${createRes?.data?.detail || "Unknown"}`);
            }

            // 3. Recupero File List
            if (!files || files.length === 0) {
                 await sleep(1500); 
                 const infoRes = await tbRequest('GET', '/torrents/mylist', key, null, { bypass_cache: true, id: torrentId });
                 const tData = Array.isArray(infoRes?.data?.data) ? infoRes.data.data.find(t => t.id === torrentId) : infoRes?.data?.data;
                 if (tData && tData.files) files = tData.files;
            }

            // 4. Match File (LOGICA ROBUSTA ANTI-NaN)
            let targetFileId = null;
            
            // Verifichiamo se forcedFileIdx è un numero valido
            let isValidForced = false;
            if (forcedFileIdx !== undefined && forcedFileIdx !== null) {
                const parsed = parseInt(forcedFileIdx);
                if (!isNaN(parsed) && parsed > -1) {
                    targetFileId = parsed;
                    isValidForced = true;
                }
            }

            // Se l'ID forzato era NaN o mancante, ricalcoliamo il file migliore ora
            if (!isValidForced) {
                console.log(`⚠️ [TorBox] File ID mancante o NaN. Ricalcolo match migliore...`);
                targetFileId = matchFile(files, season, episode);
            }
            
            if (targetFileId === null) throw new Error("File not found inside torrent");

            // 5. Request Link
            const reqParams = {
                token: key,
                torrent_id: torrentId,
                file_id: targetFileId, 
                zip_link: 'false'
            };
            if (userIp) reqParams.user_ip = userIp;

            const linkRes = await tbRequest('GET', '/torrents/requestdl', key, null, reqParams);

            if (linkRes?.data?.success && linkRes.data.data) {
                return { url: linkRes.data.data };
            }
            
            // Gestione errore specifico TorBox oggetto
            const errorDetail = linkRes?.data?.detail 
                ? (typeof linkRes.data.detail === 'object' ? JSON.stringify(linkRes.data.detail) : linkRes.data.detail)
                : "Unknown Error";
                
            throw new Error(`Link Request Failed: ${errorDetail}`);

        } catch (e) {
            console.error(`💥 [TorBox] Play Error: ${e.message}`);
            return null;
        }
    }
};

module.exports = TB;
