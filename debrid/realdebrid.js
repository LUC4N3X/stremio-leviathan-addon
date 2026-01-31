const axios = require("axios");
const https = require("https");


const RD_API_BASE = "https://api.real-debrid.com/rest/1.0";
const RD_TIMEOUT = 30000; // 30 Secondi timeout
const MAX_POLL = 30;      // Più tentativi di attesa (per file grossi/conversioni)
const POLL_DELAY = 1000;  // 1 secondo tra i check

// HTTP AGENT 
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
   MATCHING LEVIATHAN (Logica Serie TV Blindata)
   ========================================================================= */
function matchFile(files, season, episode) {
    if (!files || files.length === 0) return null;

    // 1. Filtra solo video e rimuovi sample/trailer
    const videoFiles = files.filter(f => isVideo(f.path) && !/sample|trailer|featurette/i.test(f.path));

    if (videoFiles.length === 0) return null;
    
    // CASO A: FILM (Nessuna Stagione/Episodio) -> Prendi il file più grande (Main Movie)
    if (!season && !episode) {
        return videoFiles.sort((a,b) => b.bytes - a.bytes)[0].id;
    }

    // CASO B: SERIE TV
    const s = parseInt(season);
    const e = parseInt(episode);
    
    // Regex rigorose (dalla più precisa alla più generica)
    const strictRegex = [
        // S01E01, S1E1 (Case Insensitive)
        new RegExp(`\\bS0?${s}\\s*E0?${e}\\b`, "i"),
        // 1x01
        new RegExp(`\\b${s}x0?${e}\\b`, "i"),
        // Stagione 1 Episodio 1 (ITA/ENG)
        new RegExp(`(?:Stagione|Season)\\s*0?${s}.*?(?:Episodio|Episode|Ep)\\s*0?${e}\\b`, "i"),
        // 101, 105 (Rischioso, solo se delimitato bene)
        new RegExp(`\\b${s}${e.toString().padStart(2, '0')}\\b`) 
    ];

    // 1. Cerca match esatto
    for (const rx of strictRegex) {
        const found = videoFiles.find(v => rx.test(v.path));
        if (found) return found.id;
    }

    // 2. Logic "Single File Safety":
    // Se c'è UN SOLO file video nel torrent, probabilmente è l'episodio giusto
    // (es. magnet specifico per un episodio).
    if (videoFiles.length === 1) {
        return videoFiles[0].id;
    }

    // 3. Fallback "Smart Match" per Pack complessi:
    // A volte i file si chiamano solo "01.mkv" dentro una cartella "Season 1".
    // Controllo se il path contiene il riferimento alla stagione E il numero episodio.
    const looseMatch = videoFiles.find(v => {
        const pathLower = v.path.toLowerCase();
        const hasSeason = pathLower.includes(`season ${s}`) || pathLower.includes(`stagione ${s}`) || pathLower.includes(`s${s}`);
        // Cerca il numero episodio isolato (es. " 01 ", "_01_", "[01]")
        const hasEpisode = new RegExp(`[\\W_]0?${e}[\\W_]`).test(pathLower);
        return hasSeason && hasEpisode;
    });

    if (looseMatch) return looseMatch.id;

    // SE FALLISCE TUTTO:
    // Non ritornare il file più grande a caso (rischia di essere l'Episodio 1 di un Pack).
    // Ritorna null per forzare un errore piuttosto che streammare l'episodio sbagliato.
    return null; 
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

            // Errore sconosciuto
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
     * LEVIATHAN CACHE CHECK (Ottimizzato)
     */
    checkCacheLeviathan: async (token, magnet, hash) => {
        let torrentId = null;
        try {
            const body = new URLSearchParams();
            body.append("magnet", magnet);
            
            const add = await rdRequest("POST", "/torrents/addMagnet", token, body);
            if (!add?.id) return { cached: false, hash };
            torrentId = add.id;

            let info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
            if (!info) {
                await RD.deleteTorrent(token, torrentId);
                return { cached: false, hash };
            }

            if (Status.WAITING_SELECTION(info.status)) {
                const sel = new URLSearchParams();
                sel.append("files", "all");
                await rdRequest("POST", `/torrents/selectFiles/${torrentId}`, token, sel);
                info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
            }

            const isCached = Status.READY(info.status);
            
            let mainFile = null;
            if (info?.files) {
                 const videoFiles = info.files.filter(f => isVideo(f.path)).sort((a, b) => b.bytes - a.bytes);
                 if (videoFiles.length > 0) mainFile = videoFiles[0];
            }

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
     */
    getStreamLink: async (token, magnet, season = null, episode = null) => {
        let torrentId = null;
        let requiresDelete = true; 

        try {
            /* 1️⃣ CHECK INTELLIGENTE ESISTENTE */
            const activeTorrents = await rdRequest("GET", "/torrents", token);
            const magnetHashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/i);
            const targetHash = magnetHashMatch ? magnetHashMatch[1].toLowerCase() : null;

            let existing = null;
            if (targetHash && Array.isArray(activeTorrents)) {
                existing = activeTorrents.find(t => t.hash.toLowerCase() === targetHash && !Status.ERROR(t.status));
            }

            if (existing) {
                torrentId = existing.id;
                requiresDelete = false; 
            } else {
                const body = new URLSearchParams();
                body.append("magnet", magnet);
                const add = await rdRequest("POST", "/torrents/addMagnet", token, body);
                
                if (!add?.id) throw new Error("Magnet add failed");
                torrentId = add.id;
            }

            /* 2️⃣ POLLING */
            let info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
            let pollCount = 0;
            while (info && info.status === 'magnet_conversion' && pollCount < 5) {
                await sleep(1000);
                info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
                pollCount++;
            }

            if (!info) throw new Error("Info retrieval failed");

            /* 3️⃣ SELEZIONE FILE (Matching Blindato) */
            if (Status.WAITING_SELECTION(info.status)) {
                let fileId = "all";
                
                // USIAMO IL MATCH FILE AGGIORNATO
                if (info.files) {
                    const m = matchFile(info.files, season, episode);
                    if (m) fileId = m;
                    else if (season && episode) {
                        // Se cerco un episodio e non lo trovo, seleziono 'all' sperando nel manuale, 
                        // ma per lo stream automatico fallirà dopo.
                        // Meglio selezionare "all" per cacheare tutto il pack per il futuro.
                        fileId = "all";
                    }
                }

                const sel = new URLSearchParams();
                sel.append("files", fileId);
                await rdRequest("POST", `/torrents/selectFiles/${torrentId}`, token, sel);

                for (let i = 0; i < MAX_POLL; i++) {
                    await sleep(POLL_DELAY);
                    info = await rdRequest("GET", `/torrents/info/${torrentId}`, token);
                    if (Status.READY(info?.status)) break;
                    if (Status.DOWNLOADING(info?.status) && info.progress === 100) break; 
                }
            }

            /* 4️⃣ VERIFICA FINALE */
            if (!Status.READY(info.status)) {
                if (requiresDelete) await RD.deleteTorrent(token, torrentId);
                return null;
            }

            /* 5️⃣ IDENTIFICAZIONE LINK TARGET */
            // Usiamo di nuovo matchFile per trovare il link esatto tra quelli pronti
            const targetFileId = matchFile(info.files, season, episode);
            let targetLink = null;

            if (targetFileId) {
                const selectedFiles = info.files.filter(f => f.selected === 1);
                const linkIndex = selectedFiles.findIndex(f => f.id === targetFileId);
                if (linkIndex !== -1 && info.links[linkIndex]) {
                    targetLink = info.links[linkIndex];
                }
            }
            
            // Fallback: se non trovo il file specifico (e non ho chiesto S/E), prendo il primo
            if (!targetLink && (!season && !episode) && info.links.length > 0) {
                targetLink = info.links[0];
            }

            if (!targetLink) throw new Error("No link found or Series Mismatch");

            /* 6️⃣ UNRESTRICT */
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
