Const axios = require("axios");
const cheerio = require("cheerio");

// --- CONFIGURAZIONE ---
const AW_DOMAIN = "https://www.animeworld.ac";
const TIMEOUT = 10000;

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

// --- HELPER: NORMALIZZAZIONE TITOLO ---
function normalizeTitle(title) {
    if (!title) return "";

    const replacements = {
        'Attack on Titan': "L'attacco dei Giganti",
        'Season': '',
        'Shippuuden': 'Shippuden',
        '-': '',
        'Ore dake Level Up na Ken': 'Solo Leveling',
        'Solo Leveling 2': 'Solo Leveling 2:',
        'Yuuki Yuuna wa Yuusha de Aru: Dai Mankai no Shou': 'Yuki Yuna is a Hero: The Great Mankai Chapter', // Esempio fix specifici
    };
    
    let normalized = title;
    
    // Applica sostituzioni
    for (const [key, value] of Object.entries(replacements)) {
        if (normalized.includes(key)) {
            normalized = normalized.replace(key, value);
        }
    }
    
    // Pulizia extra
    if (normalized.includes('Naruto:')) normalized = normalized.replace(':', '');
    
    // Rimuove l'anno tra parentesi e spazi extra
    return normalized.replace(/\(\d{4}\)/, "").trim();
}

// --- HELPER: PARSING KITSU ID ---
function parseKitsuId(kitsuIdString) {
    if (!kitsuIdString) return null;
    
    // Formati supportati: "kitsu:123", "kitsu:123:1", "123"
    const parts = kitsuIdString.split(':');
    let kitsuId = parts[0];

    // Se il formato è kitsu:ID:...
    if (parts[0] === 'kitsu') {
        kitsuId = parts[1];
    }

    // Estraiamo episodio se presente (formato kitsu:ID:EP)
    // Nota: Kitsu usa ID specifici per stagione, quindi l'episodio è sempre relativo alla stagione/entry specifica
    let episode = null;
    if (parts.length >= 3) {
        episode = parseInt(parts[2]);
    }

    return { kitsuId, episode };
}

// --- HELPER: GENERATORE GRAFICA ---
function generateRichDescription(title, episode, langInfo) {
    return [
        `🎬 ${title} Ep. ${episode}`,
        `${langInfo} • 🔊 AAC`,
        `🎞️ FHD/HD • Streaming Web`,
        `☁️ Web Stream • ⚡ Instant`,
        `⛩️ AnimeWorld`
    ].join("\n");
}

// --- 1. GET INFO KITSU (FONDAMENTALE) ---
// Recupera il titolo esatto della stagione (es. "My Hero Academia 3") invece che generico
async function getInfoKitsu(kitsuId) {
    console.log(`🦊 [AW] Getting Kitsu Info for ID: ${kitsuId}`);
    try {
        const url = `https://kitsu.io/api/edge/anime/${kitsuId}`;
        const { data } = await axios.get(url, { timeout: TIMEOUT });
        
        if (data && data.data && data.data.attributes) {
            const attr = data.data.attributes;
            // Cerchiamo il titolo inglese, fallback su canonical
            let title = attr.titles.en || attr.canonicalTitle;
            const date = attr.startDate;
            
            console.log(`✅ [AW] Kitsu Data: "${title}" (${date})`);
            return { title, date };
        }
    } catch (e) {
        console.warn(`❌ [AW] Kitsu API Error: ${e.message}`);
    }
    return null;
}

// --- 2. GESTIONE COOKIE SECURITY ---
async function requestWithSecurity(url, headers = {}, cookies = "") {
    try {
        const config = { headers: { ...HEADERS, ...headers }, validateStatus: () => true };
        if (cookies) config.headers['Cookie'] = cookies;

        let response = await axios.get(url, config);

        // Bypass protezione AnimeWorld
        const securityMatch = response.data.match(/SecurityAW-([A-Za-z0-9]{2})=([^;"]+)/);
        
        if (securityMatch || response.status === 202) {
            console.log("🛡️ [AW] Security Check detected...");
            let newCookie = "";
            if (securityMatch) {
                newCookie = `SecurityAW-${securityMatch[1]}=${securityMatch[2]}`;
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

// --- 3. GET MP4 LINK ---
async function getMp4(animeUrl, isMovie, episode, cookies, index) {
    let langLabel = index === 1 ? "🇮🇹 ITA • Dub" : "🇯🇵 JPN • Sub ITA";

    console.log(`📥 [AW] Fetching MP4...`);

    try {
        let response = await requestWithSecurity(animeUrl, {}, cookies);
        if (!response) return null;
        if (response._securityCookie) cookies = response._securityCookie;

        const $ = cheerio.load(response.data);
        let targetUrl = animeUrl;

        if (!isMovie) {
            // Cerca il link dell'episodio specifico
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
            // Head request per verificare che il link sia vivo
            try {
                await axios.head(altLink, { timeout: 5000 });
                return { url: altLink, langLabel };
            } catch (e) {
                console.log(`❌ [AW] Dead Link: ${altLink}`);
            }
        }
    } catch (e) {
        console.error(`❌ [AW] getMp4 Error: ${e.message}`);
    }
    return null;
}

// --- 4. MAIN SEARCH FUNCTION ---
async function searchAnimeWorld(meta, config) {
    if (!config.filters.enableAnimeWorld) return [];

    console.log(`🚀 [AW] Start Process for: ${meta.title}`);

    // 1. IDENTIFICAZIONE ID KITSU
    // Cerchiamo l'ID Kitsu nei vari posti possibili
    let kitsuId = null;
    let episodeNumber = meta.episode || 1;

    // Caso A: L'addon riceve un ID stile "kitsu:1234:1"
    if (config.originalId && config.originalId.startsWith('kitsu')) {
        const parsed = parseKitsuId(config.originalId);
        kitsuId = parsed.kitsuId;
        if (parsed.episode) episodeNumber = parsed.episode;
    } 
    // Caso B: L'ID è nei meta
    else if (meta.kitsu_id) {
        kitsuId = meta.kitsu_id;
    }

    let searchTitle = meta.title;
    let targetDate = meta.year ? `${meta.year}-01-01` : null;
    let isSpecificSeason = false;

    // 2. FETCH DATI DA KITSU API (Cruciale per AnimeWorld)
    // Se abbiamo un Kitsu ID, chiediamo a Kitsu il titolo corretto della stagione
    if (kitsuId) {
        const kData = await getInfoKitsu(kitsuId);
        if (kData) {
            // Sovrascriviamo il titolo generico con quello specifico della stagione
            // Es: "Attack on Titan" diventa "Attack on Titan Season 2"
            searchTitle = kData.title; 
            targetDate = kData.date;
            isSpecificSeason = true;
        }
    }

    // 3. NORMALIZZAZIONE PER ANIMEWORLD
    const normalizedTitle = normalizeTitle(searchTitle);
    const searchYear = targetDate ? targetDate.substring(0, 4) : (meta.year || "");

    console.log(`🔎 [AW] Searching: "${normalizedTitle}" (Year: ${searchYear})`);
    
    const searchUrl = `${AW_DOMAIN}/filter?year=${searchYear}&sort=2&keyword=${encodeURIComponent(normalizedTitle)}`;
    
    // 4. ESECUZIONE RICERCA
    const streams = [];
    let currentCookies = "";

    const response = await requestWithSecurity(searchUrl, {}, currentCookies);
    if (!response) return [];
    if (response._securityCookie) currentCookies = response._securityCookie;

    const $ = cheerio.load(response.data);
    const animeList = $('a.poster');

    if (!animeList.length) {
        console.log(`❌ [AW] No results.`);
        return [];
    }

    let validMatchIndex = 0;

    for (let i = 0; i < animeList.length; i++) {
        const el = animeList[i];
        const dataTip = $(el).attr('data-tip');
        if (!dataTip) continue;

        const infoResp = await requestWithSecurity(`${AW_DOMAIN}/${dataTip}`, {}, currentCookies);
        if (!infoResp) continue;
        if (infoResp._securityCookie) currentCookies = infoResp._securityCookie;

        // Verifica Data Uscita
        const dateMatch = infoResp.data.match(/<label>Data di uscita:<\/label>\s*<span>\s*(.*?)\s*<\/span>/s);
        if (!dateMatch) continue;

        let releaseDateStr = dateMatch[1].trim();
        for (const [ita, eng] of Object.entries(MONTHS)) {
            releaseDateStr = releaseDateStr.replace(ita, eng);
        }

        try {
            const releaseDate = new Date(releaseDateStr);
            const target = new Date(targetDate);
            
            // Logica di confronto date:
            // Se abbiamo i dati Kitsu, vogliamo una corrispondenza precisa (stessa stagione)
            const diffDays = Math.abs((releaseDate - target) / (1000 * 60 * 60 * 24)); 
            
            // Se usiamo Kitsu, la data deve essere molto vicina (max 2 giorni di diff per fuso orario)
            // Se non usiamo Kitsu (fallback), ci accontentiamo dell'anno
            const isMatch = isSpecificSeason ? (diffDays <= 2 || releaseDateStr === targetDate) : true;

            if (isMatch) {
                console.log(`🎯 [AW] Match! "${normalizedTitle}" (${releaseDateStr})`);
                
                const animeLink = `${AW_DOMAIN}${$(el).attr('href')}`;
                
                // Se Kitsu tratta le stagioni separate, l'episodio 1 della S2 è l'episodio 1 assoluto per quella entry
                // Quindi usiamo episodeNumber così com'è (relativo alla stagione)
                const isMovie = !meta.isSeries && !isSpecificSeason; // Semplificazione per film

                const result = await getMp4(animeLink, isMovie, episodeNumber, currentCookies, validMatchIndex);
                
                if (result) {
                    streams.push({
                        name: `⛩️ AnimeWorld\n⚡ Direct`, 
                        title: generateRichDescription(searchTitle, episodeNumber, result.langLabel),           
                        url: result.url,
                        behaviorHints: {
                            notWebReady: false,
                            bingieGroup: "animeworld|sd"
                        }
                    });
                }
                validMatchIndex++; 
            }
        } catch (err) {
            console.error(`⚠️ [AW] Date Error: ${err.message}`);
        }
    }

    return streams;
}

module.exports = { searchAnimeWorld };
