const axios = require("axios");
// URL Base confermato dal tuo file JS e Python
const TB_BASE = "https://api.torbox.app/v1/api"; 
const TB_TIMEOUT = 15000; // Timeout leggermente più alto per sicurezza

// --- UTILS ---
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// 🗑️ Funzione di Pulizia (Usa l'endpoint controltorrent standard)
async function deleteTorrent(token, torrentId) {
    try {
        await axios.post(`${TB_BASE}/torrents/controltorrent`, {
            torrent_id: torrentId,
            operation: "delete"
        }, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`🗑️ [TorBox] Torrent ${torrentId} eliminato.`);
    } catch (e) {
        // Ignora errori di pulizia, non sono bloccanti
    }
}

// --- HELPER MATCH FILE AVANZATO (Preso da RealDebrid Logic) ---
function matchFile(files, season, episode) {
    if (!files || !season || !episode) return null;

    const s = parseInt(season);
    const e = parseInt(episode);
    const sStr = s.toString().padStart(2, '0');
    const eStr = e.toString().padStart(2, '0');

    // Filtra solo video ed esclude sample
    const videoFiles = files.filter(f => {
        const name = (f.name || f.short_name || '').toLowerCase();
        const isVideo = /\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i.test(name);
        const notSample = !/sample/i.test(name);
        return isVideo && notSample;
    });
    
    if (videoFiles.length === 0) return null;

    // Regex Prioritarie
    const regexStandard = new RegExp(`S0*${s}.*?E0*${e}\\b`, 'i');
    const regexX = new RegExp(`\\b${s}x0*${e}\\b`, 'i');
    const compactNum = `${s}${eStr}`; 
    const regexCompact = new RegExp(`(^|\\D)${compactNum}(\\D|$)`);
    const regexExplicitEp = new RegExp(`(ep|episode)[^0-9]*0*${e}\\b`, 'i');
    const regexAbsolute = new RegExp(`[ \\-\\[_]0*${e}[ \\-\\]_]`);

    let found = videoFiles.find(f => regexStandard.test(f.name || f.short_name));
    if (!found) found = videoFiles.find(f => regexX.test(f.name || f.short_name));
    if (!found && s < 100) found = videoFiles.find(f => regexCompact.test(f.name || f.short_name));
    if (!found) found = videoFiles.find(f => regexExplicitEp.test(f.name || f.short_name));
    if (!found) found = videoFiles.find(f => regexAbsolute.test(f.name || f.short_name));

    return found ? found.id : null;
}

const TB = {
    getStreamLink: async (key, magnet, season = null, episode = null) => {
        let torrentId = null; 
        try {
            console.log(`🚀 [TorBox] Richiesto magnet...`);

            // 1. Aggiungi Magnet
            // Endpoint confermato: /torrents/createtorrent
            const createRes = await axios.post(`${TB_BASE}/torrents/createtorrent`, {
                magnet: magnet,
                seed: 1,
                allow_zip: false
            }, { 
                headers: { 
                    Authorization: `Bearer ${key}`,
                    'Content-Type': 'application/json' 
                },
                timeout: 8000 
            });

            if (!createRes.data?.success || !createRes.data.data) {
                // Controllo per messaggio "Found Cached" nel detail (comune in Torbox)
                if (createRes.data?.detail && createRes.data.detail.includes("Found Cached")) {
                    console.log(`⚡ [TorBox] Cache Hit Immediato!`);
                } else {
                    console.log(`❌ [TorBox] Errore aggiunta magnet: ${JSON.stringify(createRes.data)}`);
                    return null;
                }
            }
            
            // Tentativo di recuperare ID dal payload principale o dai dati secondari
            torrentId = createRes.data?.data?.torrent_id || createRes.data?.data?.id;

            // Se non c'è ID, facciamo un tentativo disperato di trovarlo nella lista
            if (!torrentId) {
                console.log(`⚠️ [TorBox] ID non ritornato, cerco nella lista recente...`);
                const listRes = await axios.get(`${TB_BASE}/torrents/mylist?bypass_cache=true`, {
                     headers: { Authorization: `Bearer ${key}` }
                });
                // Prendiamo il primo torrent della lista (spesso è quello appena aggiunto)
                // Questa è una logica di fallback
                if (listRes.data?.data && listRes.data.data.length > 0) {
                     // Cerchiamo di matchare per nome se possibile, altrimenti prendiamo il più recente
                     torrentId = listRes.data.data[0].id; 
                }
            }

            if (!torrentId) {
                console.log(`❌ [TorBox] Impossibile ottenere Torrent ID.`);
                return null;
            }

            console.log(`✅ [TorBox] ID Torrent: ${torrentId}`);

            // 2. Polling per lo stato (necessario anche se cached per ottenere l'elenco file aggiornato)
            let torrentData = null;
            let attempts = 0;
            const MAX_ATTEMPTS = 10; 

            while (attempts < MAX_ATTEMPTS) {
                await sleep(1000); // 1 secondo pausa

                const infoRes = await axios.get(`${TB_BASE}/torrents/mylist?bypass_cache=true&id=${torrentId}`, {
                    headers: { Authorization: `Bearer ${key}` },
                    timeout: 5000
                });

                const item = infoRes.data?.data;
                // TorBox mylist con ID a volte ritorna l'oggetto, a volte un array di 1
                torrentData = Array.isArray(item) ? item.find(t => t.id === torrentId) : item;

                if (torrentData) {
                    const state = (torrentData.download_state || '').toLowerCase();
                    // Stati validi
                    if (['cached', 'completed', 'downloaded', 'ready'].includes(state)) {
                        break; 
                    }
                    // Stati errore
                    if (state === 'failed' || state === 'error' || state === 'stalled') {
                        console.log(`❌ [TorBox] Torrent fallito o in stallo.`);
                        await deleteTorrent(key, torrentId);
                        return null; 
                    }
                }
                attempts++;
            }

            if (!torrentData || !['cached', 'completed', 'downloaded', 'ready'].includes((torrentData.download_state || '').toLowerCase())) {
                 console.log(`⚠️ [TorBox] Timeout polling.`);
                 await deleteTorrent(key, torrentId);
                 return null; 
            }

            // 3. Seleziona File
            let fileId = null;
            if (season && episode && torrentData.files) {
                fileId = matchFile(torrentData.files, season, episode);
            } else if (torrentData.files) {
                // Film: prendi il più grande
                const sorted = torrentData.files.sort((a, b) => b.size - a.size);
                if(sorted.length > 0) fileId = sorted[0].id;
            }

            if (!fileId) {
                console.log(`❌ [TorBox] Nessun file video valido trovato.`);
                await deleteTorrent(key, torrentId);
                return null;
            }

            // 4. Richiedi Link Download
            // Endpoint confermato dal Python Wrapper: requestdl
            // Parametri query string obbligatori: token, torrent_id, file_id
            const linkUrl = `${TB_BASE}/torrents/requestdl?token=${key}&torrent_id=${torrentId}&file_id=${fileId}&zip_link=false`;
            
            const linkRes = await axios.get(linkUrl, { timeout: TB_TIMEOUT });

            if (linkRes.data?.success && linkRes.data?.data) {
                console.log(`🎉 [TorBox] Link generato con successo!`);
                
                // Pulizia post-generazione
                await deleteTorrent(key, torrentId); 

                return {
                    type: 'ready',
                    url: linkRes.data.data, 
                    filename: torrentData.name || "video.mp4",
                    size: torrentData.size || 0 
                };
            }
            
            console.log(`❌ [TorBox] Errore generazione link: ${JSON.stringify(linkRes.data)}`);
            await deleteTorrent(key, torrentId); 
            return null;

        } catch (e) {
            // Gestione errori dettagliata
            if (e.response) {
                 // Errore 404/403/500 dall'API
                 console.error(`💥 [TorBox] HTTP Error ${e.response.status}: ${JSON.stringify(e.response.data)}`);
            } else {
                 console.error(`💥 [TorBox] Network/Code Error: ${e.message}`);
            }
            
            if (torrentId) await deleteTorrent(key, torrentId);
            return null;
        }
    }
};

module.exports = TB;
