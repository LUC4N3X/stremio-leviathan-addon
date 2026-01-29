const axios = require("axios");

// URL Base decodificato (include "it":"on" nella config base)
const WEBSTREAMR_BASE = "https://webstreamr.hayd.uk/%7B%22it%22%3A%22on%22%2C%22mediaFlowProxyUrl%22%3A%22%22%2C%22mediaFlowProxyPassword%22%3A%22%22%7D";

// Helper per determinare la qualità dal titolo
function detectQuality(title) {
    const t = (title || "").toLowerCase();
    if (/2160p|4k|uhd/i.test(t)) return { q: "4K", icon: "🔥" };
    if (/1080p|fhd/i.test(t)) return { q: "1080p", icon: "✨" };
    if (/720p|hd/i.test(t)) return { q: "720p", icon: "📺" };
    if (/480p|sd/i.test(t)) return { q: "SD", icon: "🐢" };
    return { q: "HD", icon: "🎞️" }; // Default se non trova nulla
}

async function searchWebStreamr(type, id) {
    try {
        const url = `${WEBSTREAMR_BASE}/stream/${type}/${id}.json`;
        
        console.log(`🌍 [FALLBACK SYSTEM] Ricerca stream di emergenza per: ${id}`);
        
        const { data } = await axios.get(url, { timeout: 6000 });
        
        if (!data || !data.streams || !Array.isArray(data.streams)) {
            return [];
        }

        // 1. CERCHIAMO SOLO GLI STREAM ITALIANI
        const italianStreams = data.streams.filter(stream => {
            const t = (stream.title || "").toLowerCase();
            return /\b(ita|italian|italiano)\b/i.test(t);
        });

        // 2. LOGICA DI PRIORITÀ (ITA > ENG)
        let resultsToProcess = [];
        let isEngFallback = false;

        if (italianStreams.length > 0) {
            // CASO A: Abbiamo trovato roba italiana!
            console.log(`✅ [WEBSTREAMR] Trovati ${italianStreams.length} stream ITALIANI.`);
            resultsToProcess = italianStreams;
        } else {
            // CASO B: Nessun italiano trovato, usiamo tutto quello che c'è (ENG)
            console.log(`⚠️ [WEBSTREAMR] Nessun stream ITA trovato. Mostro risultati INGLESI.`);
            resultsToProcess = data.streams;
            isEngFallback = true;
        }

        // FORMATTAZIONE STYLE "LEVIATHAN P2P"
        return resultsToProcess.map(stream => {
            const rawTitle = stream.title || "Unknown Stream";
            const cleanTitle = rawTitle.replace(/WebStreamr|Hayd/gi, "").trim();
            const { q, icon } = detectQuality(cleanTitle);

            // Costruzione righe
            const lines = [];
            
            // RIGA 1: Titolo
            lines.push(`🎬 ${cleanTitle}`);
            
            // RIGA 2: Info Lingua (Dinamica)
            let langInfo = "🇮🇹 ITA"; // Default se siamo nel caso A
            
            if (isEngFallback) {
                // Se siamo nel caso B, controlliamo comunque se per miracolo c'è scritto ITA, altrimenti ENG
                if (/\b(ita|italian)\b/i.test(rawTitle)) langInfo = "🇮🇹 ITA";
                else langInfo = "🇬🇧 ENG";
            }
            
            lines.push(`${langInfo} • 🌐 Web-DL`);

            // RIGA 3: Sorgente
            lines.push(`⚡ [Web] WebStreamr Fallback`);

            return {
                name: `🌐 LEVIATHAN\n${icon} ${q}`, 
                title: lines.join("\n"),
                url: stream.url,
                behaviorHints: { 
                    notWebReady: false, 
                    bingieGroup: "leviathan-web-fallback" 
                }
            };
        });

    } catch (error) {
        console.warn(`❌ [FALLBACK SYSTEM] Errore/Timeout: ${error.message}`);
        return [];
    }
}

module.exports = { searchWebStreamr };
