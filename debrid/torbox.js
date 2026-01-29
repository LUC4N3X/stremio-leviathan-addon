const axios = require("axios");
const https = require("https");
const TB_BASE = "https://api.torbox.app/v1/api"; 
const TB_TIMEOUT = 60000; 

// --- CACHE IN MEMORIA ---
let globalListCache = { data: null, timestamp: 0 };

const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });
const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36'
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Wrapper Richieste Migliorato
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
            const errData = e.response?.data || {};
            const errCode = errData.error || "";

            // 1. Gestione Rate Limit
            if (status === 429) {
                console.warn(`🛑 [TorBox] Rate Limit (429). Attesa 5s...`);
                await sleep(5000);
                attempt++;
                continue;
            }

            // 2. Errori Fatali (Non riprovare)
            if (['AUTH_ERROR', 'BAD_TOKEN', 'PLAN_RESTRICTED_FEATURE', 'DOWNLOAD_TOO_LARGE'].includes(errCode)) {
                console.error(`❌ [TorBox] Errore Fatale: ${errCode}`);
                return { data: { success: false, detail: errCode, fatal: true } };
            }

            // 3. Errori di Rete o Server
            if (e.code === 'ECONNABORTED' || status >= 500) {
                await sleep(1500 * (attempt + 1));
                attempt++;
                continue;
            }
            return e.response;
        }
    }
    return null;
}

// Recupera lista utente (con Cache)
async function getUserList(key, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && globalListCache.data && (now - globalListCache.timestamp) < 60000) {
        return globalListCache.data;
    }
    const listRes = await tbRequest('GET', '/torrents/mylist', key, null, { bypass_cache: true });
    if (listRes?.data?.data) {
        // Ordina per ID decrescente (i più recenti prima)
        const sorted = Array.isArray(listRes.data.data) 
            ? listRes.data.data.sort((a, b) => b.id - a.id) 
            : listRes.data.data;
            
        globalListCache = { data: sorted, timestamp: now };
        return sorted;
    }
    return null;
}

// Logica Free Space Potenziata (Ispirata al codice inviato)
async function freeUpSpace(key) {
    const list = await getUserList(key, true);
    if (!list || list.length === 0) return false;

    // 1. Cerca torrent completati o in seeding (Priorità assoluta cancellazione)
    let sacrificialLamb = list
        .filter(t => ['completed', 'seeding', 'ready', 'uploading'].includes((t.download_state || '').toLowerCase()))
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0]; // Il più vecchio

    // 2. Se non trovi nulla, cerca torrent bloccati in errore o metadata
    if (!sacrificialLamb) {
        sacrificialLamb = list
            .filter(t => ['error', 'metaDL', 'downloading'].includes((t.download_state || '').toLowerCase()))
            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
    }

    if (sacrificialLamb) {
        console.log(`🗑️ [TorBox] Libero spazio eliminando: ${sacrificialLamb.name} [Stato: ${sacrificialLamb.download_state}]`);
        await tbRequest('POST', '/torrents/controltorrent', key, { torrent_id: sacrificialLamb.id, operation: "delete" });
        globalListCache.data = null; 
        await sleep(1500); // Attesa tecnica per propagazione
        return true;
    }
    return false;
}

// --- FUNZIONE MATCH FILE CHE ACCETTA ID 0 ---
function matchFile(files, season, episode) {
    if (!files || !files.length) return null;

    // Helper per estrarre ID in modo sicuro (anche se è 0)
    const getSafeId = (f) => {
        if (f.id !== undefined && f.id !== null) return f.id;
        if (f.file_id !== undefined && f.file_id !== null) return f.file_id;
        return null;
    };
    
    // Helper Size
    const getSafeSize = (f) => parseInt(f.size || 0);

    const isVideo = (name) => {
        const n = (name || "").trim();
        return /\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i.test(n) && !/sample/i.test(n);
    };

    // 1. FILTRO VIDEO
    const videoFiles = files.filter(f => isVideo(f.name) || isVideo(f.short_name));
    const candidates = videoFiles.length > 0 ? videoFiles : files;

    // 2. RILEVAMENTO FILM (S0 E0)
    const isSeasonZero = !season || season == 0 || season == '0';
    const isEpisodeZero = !episode || episode == 0 || episode == '0';

    if (isSeasonZero && isEpisodeZero) {
        // Ordina per dimensione
        const bestFile = candidates.sort((a, b) => getSafeSize(b) - getSafeSize(a))[0];
        if (bestFile) {
            return getSafeId(bestFile);
        }
        return null;
    }

    // 3. LOGICA SERIE TV
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
        const found = candidates.find(f => {
            const n = (f.name || f.short_name || "").trim();
            return regex.test(n);
        });
        if (found) return getSafeId(found);
    }
    
    // Fallback: File più grande
    const finalFallback = candidates.sort((a, b) => getSafeSize(b) - getSafeSize(a))[0];
    return getSafeId(finalFallback);
}

const TB = {
    checkCached: async (key, hashes) => {
        // La logica di checkCached è ora demandata a tb_cache.js in Leviathan
        // Manteniamo questa per retrocompatibilità base
        try {
            if (!hashes?.length) return [];
            const res = await tbRequest('GET', '/torrents/checkcached', key, null, { hash: hashes.join(','), format: 'list' });
            if (res?.data?.data) {
                const list = Array.isArray(res.data.data) ? res.data.data : Object.values(res.data.data);
                return list.map(item => (item.hash || item).toLowerCase());
            }
            return [];
        } catch (e) { return []; }
    },

    getStreamLink: async (key, magnet, season = null, episode = null, hash = null, forcedFileIdx = null) => {
        try {
            let torrentId = null;
            let files = null;
            let targetHash = hash;

            if (!targetHash) {
                const match = magnet.match(/btih:([a-zA-Z0-9]+)/i);
                targetHash = match ? match[1].toLowerCase() : null;
            } else {
                targetHash = targetHash.toLowerCase();
            }

            // 1. CONTROLLO CACHE UTENTE (Evita chiamate inutili)
            if (targetHash) {
                const userList = await getUserList(key);
                if (userList) {
                    const found = userList.find(t => t.hash && t.hash.toLowerCase() === targetHash);
                    if (found) {
                        torrentId = found.id;
                        files = found.files;
                    }
                }
            }

            // 2. AGGIUNTA TORRENT (Se non presente)
            if (!torrentId) {
                const postData = { magnet: magnet, seed: '1', allow_zip: 'false' };
                let createRes = await tbRequest('POST', '/torrents/createtorrent', key, postData);
                
                // Gestione Errori Aggiunta
                if (!createRes?.data?.success) {
                    const err = createRes?.data?.detail || createRes?.data?.error || "";
                    
                    // Se errore limite, prova a liberare spazio
                    if (err.includes("limit") || err.includes("Active")) {
                         if (await freeUpSpace(key)) {
                             // Riprova dopo pulizia
                             createRes = await tbRequest('POST', '/torrents/createtorrent', key, postData);
                         }
                    } else if (err.includes("exists") || err.includes("already")) {
                         // Se dice che esiste, forza refresh lista
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

                if (!torrentId) throw new Error(`TorBox Add Failed: ${createRes?.data?.detail || "Unknown"}`);
            }

            // 3. RECUPERO LISTA FILE (Se non ottenuta prima)
            // A volte TorBox risponde successo ma senza file list immediata
            if (!files || files.length === 0) {
                 await sleep(1000); // Piccola pausa
                 const infoRes = await tbRequest('GET', '/torrents/mylist', key, null, { bypass_cache: true, id: torrentId });
                 const tData = Array.isArray(infoRes?.data?.data) ? infoRes.data.data.find(t => t.id === torrentId) : infoRes?.data?.data;
                 
                 if (tData && tData.files) {
                     files = tData.files;
                 }
            }

            // 4. MATCH DEL FILE
            let targetFileId = null;
            if (forcedFileIdx !== undefined && forcedFileIdx !== null && forcedFileIdx !== -1) {
                // Se abbiamo un indice forzato (es. da Lazy Play)
                // Nota: In TorBox l'indice potrebbe non corrispondere direttamente, ma ci proviamo
                targetFileId = parseInt(forcedFileIdx);
            } else {
                targetFileId = matchFile(files, season, episode);
            }
            
            if (targetFileId === null) {
                console.error(`❌ [Match Failed] Debug Dump Files:`, files ? files.length : 0);
                throw new Error("File not found inside torrent");
            }

            // 5. RICHIESTA LINK (Updated with usenet_id/web_id for strictness)
            // TorBox consiglia di inviare tutti gli ID uguali per unificare P2P/Usenet/Web
            const linkRes = await tbRequest('GET', '/torrents/requestdl', key, null, {
                token: key,
                torrent_id: torrentId,
                usenet_id: torrentId, // Aggiunto da nuovo codice
                web_id: torrentId,    // Aggiunto da nuovo codice
                file_id: targetFileId, 
                zip_link: 'false'
            });

            if (linkRes?.data?.success && linkRes.data.data) {
                return { url: linkRes.data.data };
            }
            
            throw new Error(`Link Request Failed: ${linkRes?.data?.detail || "Unknown"}`);

        } catch (e) {
            console.error(`💥 [TorBox] Play Error: ${e.message}`);
            return null;
        }
    }
};

module.exports = TB;
