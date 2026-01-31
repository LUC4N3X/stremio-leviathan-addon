const axios = require("axios");


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

        // 1. FILTRO: Cerchiamo file con tag esplicitamente "ITA"
        const explicitItalianStreams = data.streams.filter(stream => {
            const t = (stream.title || "").toLowerCase();
            return /\b(ita|italian|italiano)\b/i.test(t);
        });

        // 2. LOGICA DI SELEZIONE
        let resultsToProcess = [];
        let isFallbackMode = false;

        if (explicitItalianStreams.length > 0) {
            console.log(`✅ [WEBSTREAMR] Trovati ${explicitItalianStreams.length} stream sicuramente ITALIANI.`);
            resultsToProcess = explicitItalianStreams;
        } else {
            console.log(`⚠️ [WEBSTREAMR] Nessun tag ITA esplicito. Analisi fallback (Defaulting to ITA)...`);
            resultsToProcess = data.streams;
            isFallbackMode = true;
        }

        // 3. FORMATTAZIONE RISULTATI
        return resultsToProcess.map(stream => {
            const rawTitle = stream.title || "Unknown Stream";
            // Pulizia titolo dai nomi dei provider
            const cleanTitle = rawTitle.replace(/WebStreamr|Hayd/gi, "").trim();
            const { q, icon } = detectQuality(cleanTitle);

            // Costruzione righe visuali
            const lines = [];
            
            // RIGA 1: Titolo pulito
            lines.push(`🎬 ${cleanTitle}`);
            
            // RIGA 2: Determinazione Lingua
            let langInfo = "🇮🇹 ITA"; 

            if (isFallbackMode) {
                
                
                if (/\b(eng|english|en)\b/i.test(rawTitle)) {
                    langInfo = "🇬🇧 ENG";
                } 
                // Se è un anime o subbato
                else if (/\b(sub|subbed|jap)\b/i.test(rawTitle)) {
                    langInfo = "🇯🇵 Sub ITA"; 
                }
                
            }
            
            lines.push(`${langInfo} • 🌐 Web-DL`);

            // RIGA 3: Info Provider
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
