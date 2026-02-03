const axios = require("axios");
const cheerio = require("cheerio");
const kitsuProvider = require("./kitsu_provider");

// --- CONFIGURAZIONE ---
const AW_DOMAIN = "https://www.animeworld.ac";

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': AW_DOMAIN
};

// MAPPATURA MESI
const MONTHS = {
    "Gennaio": "January", "Febbraio": "February", "Marzo": "March",
    "Aprile": "April", "Maggio": "May", "Giugno": "June",
    "Luglio": "July", "Agosto": "August", "Settembre": "September",
    "Ottobre": "October", "Novembre": "November", "Dicembre": "December"
};

// --- HELPER: GENERATORE GRAFICA ---
function generateRichDescription(title, episode, langInfo) {
    const lines = [];
    lines.push(`🎬 ${title} Ep. ${episode}`);
    lines.push(`${langInfo} • 🔊 AAC`);
    lines.push(`🎞️ FHD/HD • Streaming Web`);
    lines.push(`☁️ Web Stream • ⚡ Instant`);
    lines.push(`⛩️ AnimeWorld`);
    return lines.join("\n");
}

// --- GESTIONE COOKIE SECURITY ---
async function requestWithSecurity(url, headers = {}, cookies = "") {
    try {
        const config = { headers: { ...HEADERS, ...headers }, validateStatus: () => true };
        if (cookies) config.headers['Cookie'] = cookies;

        let response = await axios.get(url, config);

        // Controllo Anti-DDoS / Security
        const securityMatch = response.data.match(/SecurityAW-([A-Za-z0-9]{2})=([^;"]+)/);
        
        if (securityMatch || response.status === 202) {
            console.log("🛡️ [AW] Security Check detected...");
            let newCookie = "";
            if (securityMatch) {
                const unknownChars = securityMatch[1];
                const securityValue = securityMatch[2];
                newCookie = `SecurityAW-${unknownChars}=${securityValue}`;
            } else {
                const setCookie = response.headers['set-cookie'];
                if (setCookie) {
                   const secCookie = setCookie.find(c => c.includes('SecurityAW'));
                   if (secCookie) newCookie = secCookie.split(';')[0];
                }
            }

            if (newCookie) {
                console.log(`🔓 [AW] Security Solved: ${newCookie}`);
                config.headers['Cookie'] = newCookie;
                response = await axios.get(url, config);
                response._securityCookie = newCookie; 
            }
        }
        return response;
    } catch (e) {
        console.error(`❌ [AW] HTTP Request Error: ${e.message}`);
        return null;
    }
}

// --- GET MP4 LINK ---
async function getMp4(animeUrl, isMovie, episode, cookies, index) {
    let langLabel = "🇯🇵 JPN • Sub ITA"; 
    if (index === 1) langLabel = "🇮🇹 ITA • Dub"; 

    console.log(`📥 [AW] Fetching MP4 for Index ${index} (${langLabel})...`);

    try {
        let response = await requestWithSecurity(animeUrl, {}, cookies);
        if (!response) return null;
        if (response._securityCookie) cookies = response._securityCookie;

        const $ = cheerio.load(response.data);
        let targetUrl = animeUrl;

        // Se è una serie, dobbiamo navigare all'episodio specifico
        if (!isMovie) {
            const epLinkEl = $(`a[data-episode-num="${episode}"]`);
            if (!epLinkEl.length) {
                console.log(`❌ [AW] Episodio ${episode} non trovato.`);
                return null;
            }
            targetUrl = `${AW_DOMAIN}${epLinkEl.attr('href')}`;
            response = await requestWithSecurity(targetUrl, {}, cookies);
            if (!response) return null;
        }

        const $ep = cheerio.load(response.data);
        const altLink = $ep('#alternativeDownloadLink').attr('href');
        
        if (altLink) {
            try {
                // Verifica rapida se il link è vivo (HEAD request)
                await axios.head(altLink);
                return { url: altLink, langLabel: langLabel };
            } catch (e) {
                console.log(`❌ [AW] Link 404/Dead: ${altLink}`);
                return null;
            }
        }
    } catch (e) {
        console.error(`❌ [AW] getMp4 Critical Error: ${e.message}`);
    }
    return null;
}

// --- MAIN SEARCH FUNCTION ---
// NOTA: Ora accetta 'id' come primo parametro per verificare se è kitsu
async function searchAnimeWorld(requestId, meta, config) {
    if (!config.filters.enableAnimeWorld) return [];

    // 1. VERIFICA TIPO ID (SOLO KITSU)
    // Se l'ID non è presente o non inizia con "kitsu:", interrompiamo subito.
    if (!requestId || !requestId.startsWith("kitsu:")) {
        // console.log("⏭️ [AW] Skipped: ID is not Kitsu.");
        return [];
    }

    // 2. PARSING ID KITSU
    const parsedKitsu = kitsuProvider.parseKitsuId(requestId);
    if (!parsedKitsu) {
        console.warn(`⚠️ [AW] Invalid Kitsu ID format: ${requestId}`);
        return [];
    }

    console.log(`🦊 [AW] Processing Kitsu ID: ${parsedKitsu.kitsuId} | Ep: ${parsedKitsu.episodeNumber}`);

    // 3. RECUPERO METADATI DA KITSU
    const kitsuData = await kitsuProvider.getAnimeInfo(parsedKitsu.kitsuId);
    if (!kitsuData) {
        console.log(`❌ [AW] No data found on Kitsu for ID ${parsedKitsu.kitsuId}`);
        return [];
    }

    // 4. NORMALIZZAZIONE TITOLO
    let showname = kitsuProvider.normalizeTitle(kitsuData.title);
    
    // Pulizia extra per la ricerca (rimozione anno tra parentesi se presente nel titolo raw)
    showname = showname.replace(/\(\d{4}\)/, "").trim();

    const targetDate = kitsuData.date; // Es: "2024-01-07"
    const searchYear = targetDate ? targetDate.substring(0, 4) : "";
    
    console.log(`🔎 [AW] Search: "${showname}" | Year: ${searchYear}`);

    const searchUrl = `${AW_DOMAIN}/filter?year=${searchYear}&sort=2&keyword=${encodeURIComponent(showname)}`;

    const streams = [];
    let currentCookies = "";

    // 5. ESECUZIONE RICERCA SUL SITO
    const response = await requestWithSecurity(searchUrl, {}, currentCookies);
    if (!response) return [];
    if (response._securityCookie) currentCookies = response._securityCookie;

    const $ = cheerio.load(response.data);
    const animeList = $('a.poster');

    if (animeList.length === 0) {
        console.log(`❌ [AW] Nessun risultato trovato.`);
        return [];
    }

    let validMatchIndex = 0; // 0 = Primo match (spesso SUB), 1 = Secondo match (spesso DUB)

    for (let i = 0; i < animeList.length; i++) {
        const el = animeList[i];
        const dataTip = $(el).attr('data-tip');
        if (!dataTip) continue;

        const animeInfoUrl = `${AW_DOMAIN}/${dataTip}`;
        const infoResp = await requestWithSecurity(animeInfoUrl, {}, currentCookies);
        if (!infoResp) continue;
        if (infoResp._securityCookie) currentCookies = infoResp._securityCookie;

        // Estrazione Data Uscita dal tooltip o pagina info per conferma match
        const dateMatch = infoResp.data.match(/<label>Data di uscita:<\/label>\s*<span>\s*(.*?)\s*<\/span>/s);
        if (!dateMatch) continue;

        let releaseDateStr = dateMatch[1].trim();
        for (const [ita, eng] of Object.entries(MONTHS)) {
            releaseDateStr = releaseDateStr.replace(ita, eng);
        }

        try {
            const releaseDate = new Date(releaseDateStr);
            const target = new Date(targetDate);
            
            // Calcolo differenza giorni
            const diffTime = Math.abs(releaseDate - target);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            // Tolleranza di 2 giorni sulla data di uscita
            const isMatch = diffDays <= 2 || releaseDateStr === targetDate;

            if (isMatch) {
                console.log(`🎯 [AW] Match Confermato! ID AW: ${validMatchIndex} | Date: ${releaseDateStr}`);
                
                const animeLink = $(el).attr('href');
                const animeUrl = `${AW_DOMAIN}${animeLink}`;
                
                // Usiamo l'episodio parsato da KitsuProvider, fallback a 1
                const episodeNum = parsedKitsu.episodeNumber || 1;
                const isMovie = parsedKitsu.isMovie;

                const result = await getMp4(animeUrl, isMovie, episodeNum, currentCookies, validMatchIndex);
                
                if (result) {
                    const richDescription = generateRichDescription(showname, episodeNum, result.langLabel);

                    streams.push({
                        name: `⛩️ AnimeWorld\n⚡ Direct`, 
                        title: richDescription,           
                        url: result.url,
                        behaviorHints: {
                            notWebReady: false,
                            bingieGroup: "animeworld|sd"
                        }
                    });
                }
                validMatchIndex++; 
            } else {
                console.log(`⚠️ [AW] Date Mismatch: Found ${releaseDateStr} vs Target ${targetDate}`);
            }
        } catch (err) {
            console.error(`⚠️ [AW] Date Parse Error: ${err.message}`);
        }
    }

    return streams;
}

module.exports = { searchAnimeWorld };
