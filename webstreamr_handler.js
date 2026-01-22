const axios = require("axios");

// URL Base decodificato
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
        
        // Log interno
        console.log(`🌍 [FALLBACK SYSTEM] Ricerca stream di emergenza per: ${id}`);
        
        const { data } = await axios.get(url, { timeout: 6000 });
        
        if (!data || !data.streams || !Array.isArray(data.streams)) {
            return [];
        }

        // FORMATTAZIONE STYLE "LEVIATHAN P2P"
        return data.streams.map(stream => {
            // 1. Pulizia titolo base
            const rawTitle = stream.title || "Unknown Stream";
            const cleanTitle = rawTitle.replace(/WebStreamr|Hayd/gi, "").trim();
            
            // 2. Rilevamento Qualità per il box a sinistra
            const { q, icon } = detectQuality(cleanTitle);

            // 3. Costruzione delle righe del titolo (identico a formatStreamTitleCinePro)
            const lines = [];
            
            // RIGA 1: Titolo del file
            lines.push(`🎬 ${cleanTitle}`);
            
            // RIGA 2: Info (Simuliamo le info audio/video se presenti nel titolo)
            let extraInfo = "🌐 Web-DL";
            if (/ita|italian/i.test(rawTitle)) extraInfo = "🇮🇹 ITA • 🌐 Web-DL";
            else extraInfo = "🇬🇧 ENG • 🌐 Web-DL";
            lines.push(extraInfo);

            // RIGA 3: Sorgente (invece di "P2P [RD]" mettiamo "HTTP [Web]")
            // Questo lo fa sembrare un link Debrid agli occhi dell'utente
            lines.push(`⚡ [Web] WebStreamr Fallback`);

            return {
                // QUI IL CAMBIO FONDAMENTALE:
                // Invece di "Backup", mettiamo Nome + Icona Qualità come i torrent
                name: `🌐 LEVIATHAN\n${icon} ${q}`, 
                
                // Il titolo multilinea
                title: lines.join("\n"),
                
                url: stream.url,
                behaviorHints: { 
                    notWebReady: false, 
                    // Manteniamo un gruppo separato per sicurezza, ma visivamente è identico
                    bingieGroup: "leviathan-web-fallback" 
                }
            };
        });

    } catch (error) {
        console.warn(`❌ [FALLBACK SYSTEM] Nessun risultato disponibile: ${error.message}`);
        return [];
    }
}

module.exports = { searchWebStreamr };
