const axios = require("axios");
const { imdbToTmdb } = require("../id_converter");

const VIX_BASE = "https://vixsrc.to"; 

// Headers base per sembrare un browser reale
const HEADERS_BASE = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': `${VIX_BASE}/`, 
    'Origin': VIX_BASE
};

// --- HELPER FUNCTIONS DAL RIFERIMENTO ---

// Assicura che l'URL finisca con .m3u8
function ensurePlaylistM3u8(raw) {
    try {
        if (!raw.includes('/playlist/')) return raw;
        const u = new URL(raw);
        const parts = u.pathname.split('/');
        const idx = parts.indexOf('playlist');
        if (idx === -1 || idx === parts.length - 1) return raw;
        const leaf = parts[idx + 1];
        if (/\.m3u8$/i.test(leaf) || leaf.includes('.')) return raw;
        parts[idx + 1] = leaf + '.m3u8';
        u.pathname = parts.join('/');
        return u.toString();
    } catch { return raw; }
}

// Estrae i dati usando le Regex precise del file TypeScript
function extractStreamData(html) {
    // Cerca lo script che contiene token e expires
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?'token':[\s\S]*?)<\/script>/);
    const scriptContent = scriptMatch ? scriptMatch[1] : html;

    const tokenMatch = scriptContent.match(/'token':\s*'(\w+)'/);
    const expiresMatch = scriptContent.match(/'expires':\s*'(\d+)'/);
    const serverUrlMatch = scriptContent.match(/url:\s*'([^']+)'/);

    if (!tokenMatch || !expiresMatch || !serverUrlMatch) return null;

    const canPlayFHD = /window\.canPlayFHD\s*=\s*true/.test(scriptContent) || scriptContent.includes("window.canPlayFHD = true");

    return {
        token: tokenMatch[1],
        expires: expiresMatch[1],
        serverUrl: serverUrlMatch[1],
        canPlayFHD: canPlayFHD
    };
}

// Segue la catena di Iframe (Logica "Direct Stream" del riferimento)
async function getRealVixPage(url) {
    try {
        // 1. Prima richiesta
        let response = await axios.get(url, { headers: HEADERS_BASE });
        let html = response.data;
        let currentUrl = url;

        // 2. Controllo Iframe (Cruciale per i file che non partono)
        if (url.includes("/iframe") || html.includes("<iframe")) {
            const srcMatch = html.match(/<iframe[^>]+src="([^"]+)"/);
            if (srcMatch) {
                let iframeSrc = srcMatch[1];
                if (iframeSrc.startsWith("//")) iframeSrc = "https:" + iframeSrc;
                else if (iframeSrc.startsWith("/")) iframeSrc = new URL(iframeSrc, VIX_BASE).toString();
                
                // Fetch della pagina del player reale
                response = await axios.get(iframeSrc, { 
                    headers: { ...HEADERS_BASE, 'Referer': currentUrl }
                });
                html = response.data;
                currentUrl = iframeSrc;
            }
        }
        return { html, finalReferer: currentUrl };
    } catch (e) {
        console.error("Errore fetch Vix Page:", e.message);
        return null;
    }
}

function generateRichDescription(meta) {
    const lines = [];
    lines.push(`🎬 ${meta.title || "Video"}`); 
    lines.push(`🇮🇹 ITA • 🔊 AAC`);
    lines.push(`🎞️ HLS • Bitrate Variabile`);
    lines.push(`☁️ Web Stream • ⚡ Instant`);
    lines.push(`🌪️ StreamingCommunity`); 
    return lines.join("\n");
}

// --- FUNZIONE PRINCIPALE AGGIORNATA ---
async function searchVix(meta, config, reqHost) {
    if (!config.filters || (!config.filters.enableVix && !config.filters.enableSC)) return [];

    const currentHost = reqHost || "https://leviathanaddon.dpdns.org";

    try {
        let tmdbId = meta.imdb_id;
        if (tmdbId.startsWith("tt")) {
            const converted = await imdbToTmdb(tmdbId);
            if (converted && converted.tmdbId) tmdbId = converted.tmdbId;
            else return [];
        }

        // URL Iniziale
        let targetUrl = meta.isSeries 
            ? `${VIX_BASE}/tv/${tmdbId}/${meta.season}/${meta.episode}/` 
            : `${VIX_BASE}/movie/${tmdbId}/`;

        // 1. Ottieni la pagina reale (Gestione Iframe)
        const pageData = await getRealVixPage(targetUrl);
        if (!pageData) return [];

        // 2. Estrai i dati (Gestione Token/Expires/FHD)
        const data = extractStreamData(pageData.html);
        if (!data) return [];

        // 3. Costruzione URL "Master" Robusta
        let serverUrl = ensurePlaylistM3u8(data.serverUrl);
        
        // Verifica se 'b=1' era presente o necessario
        let hadBOriginally = /([?&])b=1(?!\d)/.test(serverUrl);
        
        // Pulizia base
        const u = new URL(serverUrl);
        u.search = ''; // Rimuove query vecchie
        
        const params = new URLSearchParams();
        if (hadBOriginally) params.append('b', '1');
        params.append('token', data.token);
        params.append('expires', data.expires);
        
        // CRUCIALE: Se supporta FHD, aggiungere h=1
        if (data.canPlayFHD) {
            params.append('h', '1');
        }

        const masterSource = `${u.toString()}?${params.toString()}`;
        
        // --- GENERAZIONE STREAM ---
        const streams = [];
        const richTitle = generateRichDescription(meta);
        const qualityMode = config.filters.scQuality || 'all'; 
        const allow720 = qualityMode === 'all' || qualityMode === '720';
        const allow1080 = qualityMode === 'all' || qualityMode === '1080';

        // Stream 720p (Senza h=1 forzato o con h=0 se necessario, ma il proxy gestisce la selezione)
        if (allow720) {
            const synthetic720 = `${currentHost}/vixsynthetic.m3u8?src=${encodeURIComponent(masterSource)}&lang=it&max=0&multi=1`;
            streams.push({
                name: `🌪️ StreamingCommunity\n📺 720p`, 
                title: richTitle,
                url: synthetic720,
                behaviorHints: { notWebReady: false, bingieGroup: "vix-synthetic-720" }
            });
        }

        // Stream 1080p (Solo se rilevato canPlayFHD)
        if (data.canPlayFHD && allow1080) { 
            const synthetic1080 = `${currentHost}/vixsynthetic.m3u8?src=${encodeURIComponent(masterSource)}&lang=it&max=1&multi=1`;
            streams.push({
                name: `🌪️ StreamingCommunity\n💎 1080p`,
                title: richTitle,
                url: synthetic1080,
                behaviorHints: { notWebReady: false, bingieGroup: "vix-synthetic-1080" }
            });
        }

        return streams.reverse();
    } catch (e) { 
        console.error("Errore searchVix:", e.message);
        return []; 
    }
}

module.exports = { searchVix };
