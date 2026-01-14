const axios = require("axios");
const https = require("https");

// --- CONFIGURAZIONE TURBO ---
const RD_API_BASE = "https://api.real-debrid.com/rest/1.0";
const RD_TIMEOUT = 30000; // 30 Secondi timeout
const MAX_POLL = 30;      // Più tentativi di attesa (per file grossi)
const POLL_DELAY = 1000;  // 1 secondo tra i check

// --- HTTP AGENT (Keep-Alive per velocità estrema) ---
// Questo mantiene aperte le connessioni TCP, evitando l'handshake SSL ogni volta.
const httpsAgent = new https.Agent({ 
    keepAlive: true, 
    maxSockets: 64, 
    keepAliveMsecs: 30000 
});

const rdClient = axios.create({
    baseURL: RD_API_BASE,
    timeout: RD_TIMEOUT,
    httpsAgent: httpsAgent,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});

/* =========================================================================
   HELPER E STATI
   ========================================================================= */

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function isVideo(path) {
    return /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|mpg|mpeg)$/i.test(path);
}

// Stati di Real-Debrid normalizzati
const Status = {
    ERROR: (s) => ['error', 'magnet_error'].includes(s),
    WAITING_SELECTION: (s) => s === 'waiting_files_selection',
    DOWNLOADING: (s) => ['downloading', 'uploading', 'queued'].includes(s),
    READY: (s) => ['downloaded', 'dead'].includes(s),
};

/* =========================================================================
   MATCHING LEVIATHAN (Logica Originale Ottimizzata)
   ========================================================================= */
function matchFile(files, season, episode) {
    if (!files) return null;

    // Filtra solo video e rimuovi sample
    const videoFiles = files.filter(f => isVideo(f.path) && !f.path.toLowerCase().includes("sample"));

    if (!videoFiles.length) return null;
    
    // Se è un film o non ci sono dati s/e, prendi il più grande (main movie)
    if (!season || !episode) {
        return videoFiles.sort((a,b) => b.bytes - a.bytes)[0].id;
    }

    const s = parseInt(season);
    const e = parseInt(episode);
    const s2 = s.toString().padStart(2, "0");
    const e2 = e.toString().padStart(2, "0");

    // Regex in ordine di precisione
    const rules = [
        new RegExp(`S0*${s}.*?E0*${e}\\b`, "i"),        // S01E01
        new RegExp(`\\b${s}x0*${e}\\b`, "i"),          // 1x01
        new RegExp(`(^|\\D)${s}${e2}(\\D|$)`),         // 101 / 215
        new RegExp(`(ep|episode)[^0-9]*0*${e}\\b`, "i"),
        new RegExp(`[ \\-\\[_]0*${e}[ \\-\\]_]`)       // anime assoluto
    ];

    for (const rx of rules) {
        const f = videoFiles.find(v => rx.test(v.path));
        if (f) return f.id;
    }

    // Fallback: file più grande (spesso è l'episodio giusto se il pack è piccolo)
    return videoFiles.sort((a,b) => b.bytes - a.bytes)[0].id;
}

/* =========================================================================
   RICHIESTA HTTP ROBUSTA (Anti-Ban & Retry)
   ========================================================================= */
async function rdRequest(method, endpoint, token, data = null) {
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
        try {
            const config = {
                method,
                url: endpoint,
                headers: { Authorization: `Bearer ${token}` },
                data
            };
            const res = await rdClient(config);
            return res.data;
        } catch (e) {
            const st = e.response?.status;
            
            // Errori Fatali (Non riprovare)
            if (st === 401 || st === 403) {
                console.error(`[RD AUTH] Token invalido o scaduto.`);
                return null;
            }
            if (st === 404) return null; // Risorsa non trovata
            
            // Errori Temporanei (Riprova con backoff)
            if (st === 429 || st >= 500 || e.code === 'ECONNABORTED') {
                const isRateLimit = st === 429;
                const waitTime = isRateLimit ? (2000 + (attempt * 1000)) : 1000;
                
                if (isRateLimit) console.warn(`[RD 429] Rate Limit Hit. Pausa tattica di ${waitTime}ms...`);
                
                await sleep(waitTime);
                attempt++;
                continue;
            }

            // Errore sconosciuto (es. errore logica RD)
            console.error(`[RD ERROR] ${endpoint} -> ${e.message}`);
            return null;
        }
    }
    return null;
}

/* =========================================================================
   CORE MODULE
   ========================================================================= */
const RD = {

    deleteTorrent: async (token, id) => {
        try {
            await rdRequest("DELETE", `/torrents/delete/${id}`, token);
        } catch {}
    },

    /**
     * LEVIATHAN CACHE CHECK
     * Verifica proattiva ibrida.
     */
    checkCacheLeviathan: async (token, magnet, hash) => {
        let torrentId = null;
        try {
            // Aggiungi magnet
            const body = new URLSearchParams();
            body.append("magnet", magnet);
            
            const add = await rdRequest("POST", "/torrents/addMagnet", token, body);
            if (!add?.id) return { cached: false, hash };
            torrentId = add.id;

            // Ottieni info
            let info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
            if (!info) {
                await RD.deleteTorrent(token, torrentId);
                return { cached: false, hash };
            }

            // Forza check se necessario
            if (Status.WAITING_SELECTION(info.status)) {
                const sel = new URLSearchParams();
                sel.append("files", "all");
                await rdRequest("POST", `/torrents/selectFiles/${torrentId}`, token, sel);
                info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
            }

            const isCached = Status.READY(info.status);
            
            // Estrazione metadati (Bonus)
            let mainFile = null;
            if (info?.files) {
                 const videoFiles = info.files.filter(f => isVideo(f.path)).sort((a, b) => b.bytes - a.bytes);
                 if (videoFiles.length > 0) mainFile = videoFiles[0];
            }

            // Pulizia immediata
            await RD.deleteTorrent(token, torrentId);

            return {
                hash,
                cached: isCached,
                filename: mainFile ? (mainFile.path.split('/').pop()) : null,
                filesize: mainFile ? mainFile.bytes : null
            };

        } catch (e) {
            if (torrentId) await RD.deleteTorrent(token, torrentId);
            return { cached: false, hash, error: e.message };
        }
    },

    /**
     * GET STREAM LINK (Engine Principale)
     * Flow: CheckExisting -> Add -> Poll -> Select -> Unrestrict -> SmartCleanup
     */
    getStreamLink: async (token, magnet, season = null, episode = null) => {
        let torrentId = null;
        let requiresDelete = true; // Default: puliamo ciò che creiamo

        try {
            /* 1️⃣ CHECK INTELLIGENTE ESISTENTE (Modifica God Tier) */
            // Controlla se il torrent è già attivo nel cloud per evitare duplicati e errori 429
            const activeTorrents = await rdRequest("GET", "/torrents", token);
            const magnetHashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/i);
            const targetHash = magnetHashMatch ? magnetHashMatch[1].toLowerCase() : null;

            let existing = null;
            if (targetHash && Array.isArray(activeTorrents)) {
                // Cerca un torrent con lo stesso hash che non sia in errore
                existing = activeTorrents.find(t => t.hash.toLowerCase() === targetHash && !Status.ERROR(t.status));
            }

            if (existing) {
                // Trovato! Usiamo quello esistente.
                // console.log(`[RD SMART] Recupero torrent esistente: ${existing.id}`);
                torrentId = existing.id;
                requiresDelete = false; // NON cancellarlo, potrebbe servire all'utente
            } else {
                // Non esiste, lo aggiungiamo
                const body = new URLSearchParams();
                body.append("magnet", magnet);
                const add = await rdRequest("POST", "/torrents/addMagnet", token, body);
                
                if (!add?.id) throw new Error("Magnet add failed");
                torrentId = add.id;
            }

            /* 2️⃣ POLLING E STATO INIZIALE */
            let info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
            
            // Loop di attesa se lo stato è "magnet_conversion"
            let pollCount = 0;
            while (info && info.status === 'magnet_conversion' && pollCount < 5) {
                await sleep(1000);
                info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
                pollCount++;
            }

            if (!info) throw new Error("Info retrieval failed");

            /* 3️⃣ SELEZIONE FILE (Solo se necessario) */
            if (Status.WAITING_SELECTION(info.status)) {
                let fileId = "all";
                
                // Match chirurgico del file
                if (info.files) {
                    const m = matchFile(info.files, season, episode);
                    if (m) fileId = m;
                }

                const sel = new URLSearchParams();
                sel.append("files", fileId);
                await rdRequest("POST", `/torrents/selectFiles/${torrentId}`, token, sel);

                // Polling post-selezione (attesa download)
                for (let i = 0; i < MAX_POLL; i++) {
                    await sleep(POLL_DELAY);
                    info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
                    if (Status.READY(info?.status)) break;
                    if (Status.DOWNLOADING(info?.status) && info.progress === 100) break; 
                }
            }

            /* 4️⃣ VERIFICA FINALE STATO */
            // Se ancora non è pronto, abortiamo (o è un uncached lento, o è bloccato)
            if (!Status.READY(info.status)) {
                // Se lo abbiamo creato noi e non è pronto, cancelliamo per pulizia
                if (requiresDelete) await RD.deleteTorrent(token, torrentId);
                return null;
            }

            /* 5️⃣ IDENTIFICAZIONE LINK TARGET */
            // Cerchiamo il link giusto tra quelli sbloccati
            const targetFileId = matchFile(info.files, season, episode);
            let targetLink = null;

            if (targetFileId) {
                // Mappa file ID -> Link Index
                const selectedFiles = info.files.filter(f => f.selected === 1);
                const linkIndex = selectedFiles.findIndex(f => f.id === targetFileId);
                if (linkIndex !== -1 && info.links[linkIndex]) {
                    targetLink = info.links[linkIndex];
                }
            }
            
            // Fallback: primo link disponibile
            if (!targetLink && info.links.length > 0) targetLink = info.links[0];
            if (!targetLink) throw new Error("No link found");

            /* 6️⃣ UNRESTRICT (Sblocco finale) */
            const uBody = new URLSearchParams();
            uBody.append("link", targetLink);
            const unrestrict = await rdRequest("POST", "/unrestrict/link", token, uBody);

            /* 🧹 CLEANUP */
            if (requiresDelete) await RD.deleteTorrent(token, torrentId);

            if (!unrestrict?.download) return null;

            return {
                type: "ready",
                url: unrestrict.download,
                filename: unrestrict.filename,
                size: unrestrict.filesize
            };

        } catch (e) {
            // console.error("RD Stream Error:", e.message);
            // In caso di errore, se il torrent è nostro, puliamo
            if (torrentId && requiresDelete) await RD.deleteTorrent(token, torrentId);
            return null;
        }
    },

    checkInstantAvailability: async (token, hashes) => {
        try {
            return await rdRequest("GET", `/torrents/instantAvailability/${hashes.join("/")}`, token) || {};
        } catch { return {}; }
    }
};

module.exports = RD;
