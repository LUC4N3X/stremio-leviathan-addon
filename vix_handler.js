const { requestHtml } = require("./engines");
const { imdbToTmdb } = require("./id_converter"); 

// --- CONFIGURAZIONE ---
const VIX_BASE = "https://vixsrc.to"; 

// HEADERS ESSENZIALI PER VIX (Devono essere passati al Proxy)
const HEADERS_BASE = {
    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    'Referer': `${VIX_BASE}/`, 
    'Origin': VIX_BASE
};

// Funzione Helper per evitare crash se l'utente dimentica 'https://'
function ensureProtocol(url) {
    if (!url) return "";
    let safeUrl = url.trim();
    if (!/^https?:\/\//i.test(safeUrl)) {
        safeUrl = 'https://' + safeUrl;
    }
    return safeUrl.replace(/\/$/, ""); // Rimuove slash finale
}

function wrapMediaFlow(targetUrl, mfConfig) {
    if (!mfConfig || !mfConfig.url) return targetUrl;

    try {
        // 1. Pulisci URL del proxy
        const proxyBase = ensureProtocol(mfConfig.url);
        
        // 2. Costruisci l'URL del proxy usando URLSearchParams per encoding sicuro
        const proxyUrl = new URL(`${proxyBase}/proxy/hls/manifest.m3u8`);
        
        // 3. Parametri Fondamentali
        proxyUrl.searchParams.append("d", targetUrl); // 'd' è la destinazione reale
        
        if (mfConfig.pass) {
            proxyUrl.searchParams.append("api_password", mfConfig.pass);
        }

        // 4. Passaggio Headers (Cruciale per VixSrc)
        // MediaFlow usa il prefisso 'h_' per iniettare header nella richiesta verso Vix
        proxyUrl.searchParams.append("h_Referer", HEADERS_BASE['Referer']);
        proxyUrl.searchParams.append("h_Origin", HEADERS_BASE['Origin']);
        proxyUrl.searchParams.append("h_User-Agent", HEADERS_BASE['User-Agent']);

        return proxyUrl.toString();

    } catch (e) {
        console.error("Errore generazione URL Proxy:", e.message);
        return targetUrl; // Fallback al diretto (anche se probabilmente non andrà senza proxy)
    }
}

function extractVixParams(html) {
    try {
        // Regex aggiornate per catturare le variabili JS nella pagina
        const token = html.match(/['"]token['"]\s*:\s*['"](\w+)['"]/)?.[1];
        const expires = html.match(/['"]expires['"]\s*:\s*['"](\d+)['"]/)?.[1];
        const serverUrl = html.match(/url:\s*['"]([^'"]+)['"]/)?.[1];
        
        if (token && expires && serverUrl) {
            return {
                token,
                expires,
                serverUrl,
                // Controllo robusto per FHD
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
    // Se l'URL non finisce con .m3u8 e non ha query params, aggiungilo.
    // Se ha query params, bisogna inserirlo prima del '?'
    if (url.includes(".m3u8")) return url;

    if (url.includes("?")) {
        const parts = url.split("?");
        return `${parts[0]}.m3u8?${parts[1]}`;
    }
    return `${url}.m3u8`;
}

async function searchVix(meta, config) {
    // Controllo filtri: Esegui solo se abilitato esplicitamente o se SC è attivo
    if (!config.filters || (!config.filters.enableVix && !config.filters.enableSC)) return [];

    console.log(`\n🌊 [VixSRC] Ricerca ID per: ${meta.title}`);

    try {
        // 1. Conversione ID (Vix lavora solo con TMDB)
        let tmdbId = meta.imdb_id;
        if (tmdbId.startsWith("tt")) {
            const converted = await imdbToTmdb(tmdbId);
            if (converted && converted.tmdbId) {
                tmdbId = converted.tmdbId;
            } else {
                console.log("   ⚠️ Conversione IMDB -> TMDB fallita.");
                return [];
            }
        }

        // 2. Costruzione URL Pagina Vix
        let targetUrl;
        if (meta.isSeries) {
            targetUrl = `${VIX_BASE}/tv/${tmdbId}/${meta.season}/${meta.episode}/`;
        } else {
            targetUrl = `${VIX_BASE}/movie/${tmdbId}/`;
        }
        
        // 3. Richiesta Pagina (per estrarre token)
        const { data: html } = await requestHtml(targetUrl, { headers: HEADERS_BASE });
        if (!html || html.length < 500) return [];

        // 4. Estrazione Parametri
        const params = extractVixParams(html);

        if (params) {
            const streams = [];
            
            // Pulizia URL server base
            let baseUrl = ensureM3u8Extension(params.serverUrl);
            
            // Separatore query string corretto
            const separator = baseUrl.includes("?") ? "&" : "?";
            const commonParams = `token=${params.token}&expires=${params.expires}`;

            // --- VARIANTE 1: FULL HD (1080p) ---
            if (params.canPlayFHD) {
                // Aggiungiamo h=1 per forzare il 1080p lato server Vix
                const fhdUrlRaw = `${baseUrl}${separator}${commonParams}&h=1`;
                const finalUrl = wrapMediaFlow(fhdUrlRaw, config.mediaflow);
                
                streams.push({
                    url: finalUrl,
                    isFHD: true, // Flag per il frontend (Mostrerà 1080p)
                    source: "StreamingCommunity",
                    behaviorHints: { 
                        notWebReady: false, 
                        proxyHeaders: { "request": HEADERS_BASE } // Fallback per player che supportano header
                    }
                });
            }

            // --- VARIANTE 2: STANDARD (720p) ---
            // Sempre presente come fallback
            const sdUrlRaw = `${baseUrl}${separator}${commonParams}`; // Senza &h=1
            const finalSdUrl = wrapMediaFlow(sdUrlRaw, config.mediaflow);

            streams.push({
                url: finalSdUrl,
                isFHD: false, // Flag per il frontend (Mostrerà 720p)
                source: "StreamingCommunity",
                behaviorHints: { 
                    notWebReady: false,
                    proxyHeaders: { "request": HEADERS_BASE }
                }
            });

            console.log(`   ✅ [VixSRC] Trovati ${streams.length} flussi.`);
            return streams;
        }
        
        console.log("   ⚠️ [VixSRC] Token non trovati nella pagina.");
        return [];

    } catch (e) {
        console.log(`   ❌ [VixSRC] Errore critico: ${e.message}`);
        return [];
    }
}

module.exports = { searchVix };
