const { requestHtml } = require("./engines");
const { imdbToTmdb } = require("./id_converter"); 

// --- CONFIGURAZIONE ---
const VIX_BASE = "https://vixsrc.to"; 

// HEADERS ESSENZIALI
const HEADERS_BASE = {
    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    'Referer': `${VIX_BASE}/`, 
    'Origin': VIX_BASE
};

// Funzione Helper: Assicura protocollo HTTPS
function ensureProtocol(url) {
    if (!url) return "";
    let safeUrl = url.trim();
    if (!/^https?:\/\//i.test(safeUrl)) {
        safeUrl = 'https://' + safeUrl;
    }
    return safeUrl.replace(/\/$/, ""); 
}

// Funzione Helper: Risolve URL relativi
function resolveUrl(base, relative) {
    if (relative.startsWith('http')) return relative;
    try {
        const urlObj = new URL(relative, base);
        return urlObj.toString();
    } catch (e) {
        return relative;
    }
}

// --- NUOVA LOGICA: Scarica manifest ed estrae TUTTE le varianti utili ---
async function extractVariants(masterUrl) {
    try {
        console.log(`   ⏳ [VixSRC] Analisi manifest per estrarre link diretti...`);
        const { data: m3u8Content } = await requestHtml(masterUrl, { headers: HEADERS_BASE });
        
        if (!m3u8Content) return {};

        const lines = m3u8Content.split('\n');
        const variants = [];

        // Parsing del manifest
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
                if (resMatch && lines[i + 1]) {
                    const width = parseInt(resMatch[1]);
                    const height = parseInt(resMatch[2]);
                    const url = lines[i + 1].trim();
                    variants.push({ width, height, url: resolveUrl(masterUrl, url) });
                }
            }
        }

        // Ordina per larghezza decrescente (dal più grande al più piccolo)
        variants.sort((a, b) => b.width - a.width);

        if (variants.length === 0) return {};

        // Trova 1080p (o il massimo disponibile)
        const best = variants[0];

        // Trova una variante "Standard" 
        // Se non trova 720 precisi, prende il secondo migliore, altrimenti null
        let standard = variants.find(v => v.width < 1900 && v.width >= 800); // Target 720p/HD
        if (!standard && variants.length > 1) standard = variants[1]; // Fallback al secondo migliore

        return {
            fhd: best ? best.url : null,
            sd: standard ? standard.url : null
        };

    } catch (e) {
        console.warn(`   ⚠️ [VixSRC] Fallita estrazione varianti: ${e.message}`);
        return {};
    }
}

function extractVixParams(html) {
    try {
        const token = html.match(/['"]token['"]\s*:\s*['"](\w+)['"]/)?.[1];
        const expires = html.match(/['"]expires['"]\s*:\s*['"](\d+)['"]/)?.[1];
        const serverUrl = html.match(/url:\s*['"]([^'"]+)['"]/)?.[1];
        
        if (token && expires && serverUrl) {
            return {
                token,
                expires,
                serverUrl,
                canPlayFHD: html.includes("window.canPlayFHD = true") || /canPlayFHD\s*=\s*true/.test(html)
            };
        }
    } catch (e) { 
        console.error("Errore parsing parametri Vix:", e.message);
        return null; 
    }
    return null;
}

function ensureM3u8Extension(url) {
    if (!url) return "";
    if (url.includes(".m3u8")) return url;
    if (url.includes("?")) {
        const parts = url.split("?");
        return `${parts[0]}.m3u8?${parts[1]}`;
    }
    return `${url}.m3u8`;
}

async function searchVix(meta, config) {
    if (!config.filters || (!config.filters.enableVix && !config.filters.enableSC)) return [];

    console.log(`\n🌊 [VixSRC] Ricerca ID per: ${meta.title}`);

    try {
        let tmdbId = meta.imdb_id;
        if (tmdbId.startsWith("tt")) {
            const converted = await imdbToTmdb(tmdbId);
            if (converted && converted.tmdbId) tmdbId = converted.tmdbId;
            else return [];
        }

        let targetUrl;
        if (meta.isSeries) {
            targetUrl = `${VIX_BASE}/tv/${tmdbId}/${meta.season}/${meta.episode}/`;
        } else {
            targetUrl = `${VIX_BASE}/movie/${tmdbId}/`;
        }
        
        const { data: html } = await requestHtml(targetUrl, { headers: HEADERS_BASE });
        if (!html || html.length < 500) return [];

        const params = extractVixParams(html);

        if (params) {
            const streams = [];
            let baseUrl = ensureM3u8Extension(params.serverUrl);
            const separator = baseUrl.includes("?") ? "&" : "?";
            const commonParams = `token=${params.token}&expires=${params.expires}`;

            // Costruiamo il Master URL con h=1 
            // Se canPlayFHD è false, usiamo b=1 o niente, ma proviamo sempre h=1 se possibile
            let masterUrl = `${baseUrl}${separator}${commonParams}`;
            if (params.canPlayFHD) masterUrl += "&h=1";
            else masterUrl += "&b=1"; // b=1 spesso è usato per le versioni standard

            // ESTRAZIONE LINK DIRETTI (Cruciale per far funzionare entrambi)
            const extractedUrls = await extractVariants(masterUrl);

            // 1. Aggiungi Stream 1080p (se trovato e abilitato)
            if (params.canPlayFHD && extractedUrls.fhd) {
                streams.push({
                    url: extractedUrls.fhd,
                    name: "VixSRC 1080p",
                    description: "Direct Stream FHD",
                    isFHD: true,
                    behaviorHints: { 
                        notWebReady: false, 
                        proxyHeaders: { "request": HEADERS_BASE } 
                    }
                });
            }

            
            const standardUrl = extractedUrls.sd || extractedUrls.fhd; // Fallback al 1080p se 720p non trovato nel parsing

            if (standardUrl) {
                streams.push({
                    url: standardUrl,
                    name: "VixSRC 720p",
                    description: "Direct Stream HD",
                    isFHD: false,
                    behaviorHints: { 
                        notWebReady: false, 
                        proxyHeaders: { "request": HEADERS_BASE }
                    }
                });
            } else {
                // Fallback estremo: Master URL 
                streams.push({
                    url: masterUrl,
                    name: "VixSRC Auto",
                    description: "Master Playlist (Might Fail)",
                    isFHD: false,
                    behaviorHints: { 
                        notWebReady: false, 
                        proxyHeaders: { "request": HEADERS_BASE }
                    }
                });
            }

            console.log(`   ✅ [VixSRC] Generati ${streams.length} flussi.`);
            return streams;
        }
        
        return [];

    } catch (e) {
        console.log(`   ❌ [VixSRC] Errore critico: ${e.message}`);
        return [];
    }
}

module.exports = { searchVix };
