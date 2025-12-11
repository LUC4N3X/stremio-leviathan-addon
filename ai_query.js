// 1. CONFIGURAZIONE JUNK & PATTERN
const ULTRA_JUNK_TOKENS = new Set([
    "ita", "eng", "sub", "subita", "dub", "multi", "dual", "audio",
    "x264", "x265", "h264", "hevc", "divx", "xvid",
    "webrip", "bdrip", "dvdrip", "hdrip", "brrip", "web-dl", "bluray", "remux",
    "1080p", "720p", "4k", "2160p", "sd", "hd", "extended", "director", "unrated"
]);

// 2. DIZIONARIO STATIC (FALLBACK VELOCE)
const ULTRA_SEMANTIC_ALIASES = {
    "the conjuring": ["the conjuring 3", "per ordine del diavolo", "il caso enfield"],
    "harry potter": ["hp", "pietra filosofale", "camera segreti", "prigioniero azkaban", "calice fuoco", "ordine fenice", "principe mezzosangue", "doni morte"],
    "il signore degli anelli": ["lord of the rings", "lotr", "compagnia anello", "due torri", "ritorno re"],
    "fast and furious": ["fast & furious", "fast x", "f10"],
    "la casa di carta": ["money heist", "la casa de papel"],
    "il trono di spade": ["game of thrones", "got"],
    "l'attacco dei giganti": ["attack on titan", "aot"]
};

// ==========================================
// 3. FUNZIONI DI NORMALIZZAZIONE E LOGICA
// ==========================================

function ultraNormalizeTitle(t) {
    if (!t) return "";
    return t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[':;,-.?!]/g, " ") 
        .replace(/[^a-z0-9\s]/g, "") 
        .replace(/\s+/g, " ").trim(); 
}

function autoExpandAliases(cleanTitle) {
    let aliases = new Set();
    // Check Dizionario Statico
    for (const [key, variants] of Object.entries(ULTRA_SEMANTIC_ALIASES)) {
        if (cleanTitle.includes(key) || key.includes(cleanTitle)) {
             variants.forEach(a => aliases.add(a));
        }
    }
    return Array.from(aliases);
}

function commonWordsOnly(text) {
    const commons = ["the", "and", "for", "with", "movie", "film"];
    return text.split(" ").every(w => commons.includes(w.toLowerCase()));
}

// ==========================================
// 4. GENERATORE QUERY (DINAMICO + STATICO)
// ==========================================
// Nota: dynamicAliases è opzionale
function generateSmartQueries(meta, dynamicAliases = []) {
    const { title, originalTitle, year, season, episode, isSeries } = meta;
    
    const cleanTitle = ultraNormalizeTitle(title);
    const cleanOriginal = originalTitle ? ultraNormalizeTitle(originalTitle) : "";
    
    let titles = new Set();
    
    // 1. Titoli Base (Meta)
    if (title) titles.add(title);
    if (cleanTitle && cleanTitle.length > 2) titles.add(cleanTitle);
    if (originalTitle) titles.add(originalTitle);
    
    // 2. Logica Split (es. "The Conjuring: ...")
    const splitRegex = /[:\-–]/;
    if (title && splitRegex.test(title)) {
        const parts = title.split(splitRegex);
        const mainPart = parts[0].trim();
        if (mainPart.length > 3) {
            titles.add(mainPart);
            titles.add(ultraNormalizeTitle(mainPart));
        }
    }

    // 3. --- INIEZIONE TITOLI DINAMICI (TMDB) ---
    if (dynamicAliases && dynamicAliases.length > 0) {
        dynamicAliases.forEach(alias => {
            const cleanAlias = ultraNormalizeTitle(alias);
            if (cleanAlias && cleanAlias.length > 2) {
                titles.add(alias);      // Aggiunge raw (es. "The Conjuring - Per Ordine...")
                titles.add(cleanAlias); // Aggiunge clean (es. "the conjuring per ordine...")
            }
        });
        console.log(`🧠 [AI-Dynamic] Integrati ${dynamicAliases.length} alias dinamici da TMDB.`);
    }

    // 4. Espansione Alias Statici (Fallback)
    [cleanTitle, cleanOriginal].forEach(t => {
        if (t) autoExpandAliases(t).forEach(alias => titles.add(alias));
    });

    let queries = new Set();
    const sStr = season ? String(season).padStart(2, "0") : "";
    const eStr = episode ? String(episode).padStart(2, "0") : "";
    const langSuffix = "ITA";

    titles.forEach(t => {
        if (!t) return;
        t = t.trim();

        if (isSeries) {
            if (episode) {
                queries.add(`${t} S${sStr}E${eStr} ${langSuffix}`);
                queries.add(`${t} S${sStr}E${eStr}`);
            }
            queries.add(`${t} Stagione ${season} ${langSuffix}`);
            queries.add(`${t} S${sStr}`);
        } else {
            // === FILM ===
            queries.add(`${t} ${year} ${langSuffix}`);
            queries.add(`${t} ${langSuffix}`);
            queries.add(`${t} ${year}`);
            
            if (t.length > 4 && !commonWordsOnly(t)) {
                queries.add(t);
            }
        }
    });

    // Ordinamento Intelligente
    return Array.from(queries).sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        if (a.includes("ITA")) scoreA += 10;
        if (b.includes("ITA")) scoreB += 10;
        if (a.includes(year)) scoreA += 5;
        if (b.includes(year)) scoreB += 5;
        if (scoreA === scoreB) return a.length - b.length; 
        return scoreB - scoreA;
    });
}

module.exports = { generateSmartQueries, ultraNormalizeTitle, ULTRA_SEMANTIC_ALIASES, ULTRA_JUNK_TOKENS };
