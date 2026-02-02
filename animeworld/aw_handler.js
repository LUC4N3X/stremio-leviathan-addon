const axios = require("axios");
const cheerio = require("cheerio");

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

// SOSTITUZIONI TITOLI
const SHOWNAME_REPLACE = {
    "Attack on Titan": "L'attacco dei Giganti",
    "Season": "",
    "Shippuuden": "Shippuden",
    "Solo Leveling 2": "Solo Leveling 2:",
    "-": ""
};

// --- HELPER: GENERATORE GRAFICA (STILE GUARDAHD) ---
function generateRichDescription(title, episode, langInfo) {
    const lines = [];
    lines.push(`🎬 ${title} Ep. ${episode}`); // Riga 1: Titolo e Episodio
    lines.push(`${langInfo} • 🔊 AAC`);        // Riga 2: Bandiera, Lingua e Audio
    lines.push(`🎞️ FHD/HD • Streaming Web`);   // Riga 3: Qualità (AnimeWorld è solitamente buono)
    lines.push(`☁️ Web Stream • ⚡ Instant`);   // Riga 4: Info Server
    lines.push(`⛩️ AnimeWorld`);               // Riga 5: Branding
    return lines.join("\n");
}

// --- 1. GET INFO KITSU ---
async function getInfoKitsu(kitsuId) {
    console.log(`🦊 [AW] Getting Kitsu Info for ID: ${kitsuId}`);
    try {
        const url = `https://kitsu.io/api/edge/anime/${kitsuId}`;
        const { data } = await axios.get(url, { timeout: 5000 });
        
        if (data && data.data && data.data.attributes) {
            const attr = data.data.attributes;
            let showname;
            try {
                showname = attr.titles.en;
                if (!showname) throw new Error("No EN title");
            } catch (e) {
                showname = attr.canonicalTitle;
            }
            const date = attr.startDate;
            console.log(`✅ [AW] Kitsu Info Found: Title="${showname}" | Date="${date}"`);
            return { title: showname, date: date };
        }
    } catch (e) {
        console.warn(`❌ [AW] Kitsu Fetch Error: ${e.message}`);
    }
    return null;
}

// --- 2. GESTIONE COOKIE SECURITY ---
async function requestWithSecurity(url, headers = {}, cookies = "") {
    try {
        const config = { headers: { ...HEADERS, ...headers }, validateStatus: () => true };
        if (cookies) config.headers['Cookie'] = cookies;

        let response = await axios.get(url, config);

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

// --- 3. GET MP4 LINK ---
async function getMp4(animeUrl, isMovie, episode, cookies, index) {
    // Determina Lingua e Info per la grafica
    let langLabel = "🇯🇵 JPN • Sub ITA"; // Default Original
    
    if (index === 1) {
        langLabel = "🇮🇹 ITA • Dub"; // Index 1 è ITA
    }

    console.log(`📥 [AW] Fetching MP4 for Index ${index} (${langLabel})...`);

    try {
        let response = await requestWithSecurity(animeUrl, {}, cookies);
        if (!response) return null;
        if (response._securityCookie) cookies = response._securityCookie;

        const $ = cheerio.load(response.data);
        let targetUrl = animeUrl;

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
                await axios.head(altLink);
                console.log(`✅ [AW] Valid Link Found: ${altLink}`);
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

// --- 4. MAIN SEARCH FUNCTION ---
async function searchAnimeWorld(meta, config) {
    if (!config.filters.enableAnimeWorld) return [];

    console.log(`🚀 [AW] Start Search for: ${meta.title}`);

    let showname = meta.title;
    let targetDate = meta.year ? `${meta.year}-01-01` : null;
    let isKitsuMode = false;

    let kitsuId = meta.kitsu_id || (config.originalId && config.originalId.startsWith('kitsu:') ? config.originalId.split(':')[1] : null);

    if (kitsuId) {
        const kData = await getInfoKitsu(kitsuId);
        if (kData) {
            showname = kData.title;
            targetDate = kData.date;
            isKitsuMode = true;
        }
    }

    for (const [key, val] of Object.entries(SHOWNAME_REPLACE)) {
        if (showname.includes(key)) {
            showname = showname.replace(key, val);
            if (showname.includes("Naruto:")) showname = showname.replace(":", "");
            if (showname.includes("’")) showname = showname.split("’")[0];
            if (showname.includes(":")) showname = showname.split(":")[0];
        }
    }
    showname = showname.replace(/Season|Stagione/yi, "").replace(/\(\d{4}\)/, "").trim();
    
    const searchYear = targetDate ? targetDate.substring(0, 4) : (meta.year || "");
    const searchUrl = `${AW_DOMAIN}/filter?year=${searchYear}&sort=2&keyword=${encodeURIComponent(showname)}`;
    
    console.log(`🔎 [AW] Query: "${showname}" | Year: ${searchYear} | Target Date: ${targetDate}`);

    const streams = [];
    let currentCookies = "";

    const response = await requestWithSecurity(searchUrl, {}, currentCookies);
    if (!response) return [];
    if (response._securityCookie) currentCookies = response._securityCookie;

    const $ = cheerio.load(response.data);
    const animeList = $('a.poster');

    if (animeList.length === 0) {
        console.log(`❌ [AW] Nessun risultato nella ricerca.`);
        return [];
    }

    let validMatchIndex = 0; // 0 = Originale, 1 = Italiano

    for (let i = 0; i < animeList.length; i++) {
        const el = animeList[i];
        const dataTip = $(el).attr('data-tip');
        if (!dataTip) continue;

        const animeInfoUrl = `${AW_DOMAIN}/${dataTip}`;
        const infoResp = await requestWithSecurity(animeInfoUrl, {}, currentCookies);
        if (!infoResp) continue;
        if (infoResp._securityCookie) currentCookies = infoResp._securityCookie;

        const dateMatch = infoResp.data.match(/<label>Data di uscita:<\/label>\s*<span>\s*(.*?)\s*<\/span>/s);
        if (!dateMatch) continue;

        let releaseDateStr = dateMatch[1].trim();
        for (const [ita, eng] of Object.entries(MONTHS)) {
            releaseDateStr = releaseDateStr.replace(ita, eng);
        }

        try {
            const releaseDate = new Date(releaseDateStr);
            const target = new Date(targetDate);
            
            const diffTime = Math.abs(releaseDate - target);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            const isMatch = isKitsuMode ? (diffDays <= 1 || releaseDateStr === targetDate) : true;

            if (isMatch) {
                console.log(`🎯 [AW] Match Trovato! ID: ${validMatchIndex} | Date: ${releaseDateStr}`);
                
                const animeLink = $(el).attr('href');
                const animeUrl = `${AW_DOMAIN}${animeLink}`;
                const episodeNum = meta.episode || 1;
                const isMovie = !meta.isSeries;

                const result = await getMp4(animeUrl, isMovie, episodeNum, currentCookies, validMatchIndex);
                
                if (result) {
                    // --- COSTRUZIONE GRAFICA  ---
                    const richDescription = generateRichDescription(meta.title, episodeNum, result.langLabel);

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
