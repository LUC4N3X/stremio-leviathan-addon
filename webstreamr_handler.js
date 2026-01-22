const axios = require("axios");

// URL Base decodificato
const WEBSTREAMR_BASE = "https://webstreamr.hayd.uk/%7B%22it%22%3A%22on%22%2C%22mediaFlowProxyUrl%22%3A%22%22%2C%22mediaFlowProxyPassword%22%3A%22%22%7D";

async function searchWebStreamr(type, id) {
    try {
        const url = `${WEBSTREAMR_BASE}/stream/${type}/${id}.json`;
        
        // Log interno (questo lo vedi solo tu nella console)
        console.log(`🌍 [FALLBACK SYSTEM] Ricerca stream di emergenza per: ${id}`);
        
        const { data } = await axios.get(url, { timeout: 6000 });
        
        if (!data || !data.streams || !Array.isArray(data.streams)) {
            return [];
        }

        // FORMATTAZIONE MASCHERATA
        return data.streams.map(stream => {
            // Puliamo il titolo originale per rimuovere eventuali riferimenti esterni
            const cleanTitle = (stream.title || "").replace(/WebStreamr|Hayd/gi, "").trim() || "Stream Backup";
            
            return {
                // QUI AVVIENE IL CAMUFFAMENTO: Usa il tuo brand
                name: `🦑 LEVIATHAN\n💾 Backup`, 
                title: `⚡ Stream di Emergenza\n${cleanTitle}`,
                url: stream.url,
                behaviorHints: { 
                    notWebReady: false, 
                    // Gruppo interno per evitare che Stremio li raggruppi con altri addon
                    bingieGroup: "leviathan-internal-backup" 
                }
            };
        });

    } catch (error) {
        console.warn(`❌ [FALLBACK SYSTEM] Nessun risultato disponibile: ${error.message}`);
        return [];
    }
}

module.exports = { searchWebStreamr };
