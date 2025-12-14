// ==========================================
// 1. CONFIGURAZIONE & LISTE ULTRA
// ==========================================

// Token tecnici (Riferimento per pulizia)
const ULTRA_JUNK_TOKENS = new Set([
    "ita", "eng", "sub", "subita", "dub", "multi", "dual", "audio",
    "x264", "x265", "h264", "hevc", "divx", "xvid", "av1", "vp9",
    "webrip", "bdrip", "dvdrip", "hdrip", "brrip", "web-dl", "bluray", "remux",
    "1080p", "720p", "4k", "2160p", "sd", "hd", "fhd", "uhd",
    "extended", "director", "unrated", "uncut", "repack"
]);

// Dizionario Alias Statici
const ULTRA_SEMANTIC_ALIASES = {
    "harry potter": ["hp", "pietra filosofale", "camera segreti", "prigioniero azkaban", "calice fuoco", "ordine fenice", "principe mezzosangue", "doni morte"],
    "il signore degli anelli": ["lord of the rings", "lotr", "compagnia anello", "due torri", "ritorno re"],
    "fast and furious": ["fast & furious", "fast x", "f10"],
    "la casa di carta": ["money heist", "la casa de papel"],
    "il trono di spade": ["game of thrones", "got"],
    "l'attacco dei giganti": ["attack on titan", "aot", "shingeki no kyojin"],
    "one piece": ["one piece", "op"],
    "demon slayer": ["kimetsu no yaiba"],
    "jujutsu kaisen": ["sorcery fight"],
    "my hero academia": ["boku no hero academia"],
    "star wars": ["guerre stellari"],
    "the avengers": ["avengers"]
};

// ==========================================
// 2. FUNZIONI DI SUPPORTO
// ==========================================

function ultraNormalizeTitle(t) {
    if (!t) return "";
    return t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/&/g, " and ") 
        .replace(/[':;,-.?!]/g, " ") 
        .replace(/[^a-z0-9\s]/g, "") 
        .replace(/\s+/g, " ").trim(); 
}

// Converte Romani <-> Arabi (Fondamentale per Black Phone 2 vs II)
function getNumericVariants(title) {
    const romanMap = { " 1 ": " i ", " 2 ": " ii ", " 3 ": " iii ", " 4 ": " iv ", " 5 ": " v ", " 6 ": " vi ", " 7 ": " vii " };
    const arabicMap = { " i ": " 1 ", " ii ": " 2 ", " iii ": " 3 ", " iv ": " 4 ", " v ": " 5 ", " vi ": " 6 ", " vii ": " 7 " };
    
    let variants = [];
    let padded = " " + title + " "; 

    for (let [num, rom] of Object.entries(romanMap)) {
        if (padded.includes(num)) variants.push(padded.replace(num, rom).trim());
    }
    for (let [rom, num] of Object.entries(arabicMap)) {
        if (padded.includes(rom)) variants.push(padded.replace(rom, num).trim());
    }
    return variants;
}

function stripArticles(title) {
    const regex = /^(the|il|lo|la|i|gli|le|un|uno|una|a|an)\s+/i;
    if (regex.test(title)) {
        return title.replace(regex, "").trim();
    }
    return null;
}

function autoExpandAliases(cleanTitle) {
    let aliases = new Set();
    for (const [key, variants] of Object.entries(ULTRA_SEMANTIC_ALIASES)) {
        if (cleanTitle.includes(key) || key.includes(cleanTitle)) {
             variants.forEach(a => aliases.add(a));
        }
    }
    return Array.from(aliases);
}

function commonWordsOnly(text) {
    const commons = ["the", "and", "for", "with", "movie", "film", "la", "il", "di", "dei", "le", "un", "in", "on", "at", "to"];
    return text.split(" ").every(w => commons.includes(w.toLowerCase()));
}

// ==========================================
// 3. GENERATORE QUERY ULTRA (LOGICA IBRIDA)
// ==========================================

function generateSmartQueries(meta, dynamicAliases = []) {
    const { title, originalTitle, year, season, episode, isSeries } = meta;
    
    // Normalizzazione
    const cleanTitle = ultraNormalizeTitle(title);
    const cleanOriginal = originalTitle ? ultraNormalizeTitle(originalTitle) : "";
    
    let baseTitles = new Set();
    
    // Aggiunta Titoli Base
    if (cleanTitle) baseTitles.add(cleanTitle);
    if (cleanOriginal) baseTitles.add(cleanOriginal);

    // Varianti (Senza articoli, Numeriche, Split)
    [cleanTitle, cleanOriginal].forEach(t => {
        const stripped = stripArticles(t);
        if (stripped && stripped.length > 2) baseTitles.add(stripped);
        getNumericVariants(t).forEach(v => baseTitles.add(v));
        
        if (title && (title.includes(":") || title.includes("-"))) {
            const parts = title.split(/[:\-]/);
            const firstPart = ultraNormalizeTitle(parts[0]);
            if (firstPart.length > 3 && !commonWordsOnly(firstPart)) baseTitles.add(firstPart);
        }
    });

    // Dynamic Aliases
    if (dynamicAliases && dynamicAliases.length > 0) {
        dynamicAliases.forEach(alias => {
            const ca = ultraNormalizeTitle(alias);
            if (ca && ca.length > 2) baseTitles.add(ca);
        });
    }

    // Static Aliases
    [...baseTitles].forEach(t => {
        autoExpandAliases(t).forEach(a => baseTitles.add(a));
    });

    // --- GENERAZIONE QUERY ---
    let queries = new Set();
    const sStr = season ? String(season).padStart(2, "0") : "";
    const eStr = episode ? String(episode).padStart(2, "0") : "";
    const langSuffix = "ITA"; 

    baseTitles.forEach(t => {
        if (!t || t.length < 2) return;

        if (isSeries) {
            // === LOGICA SERIE (STRICT) ===
            // Qui NON aggiungiamo MAI il titolo da solo. Solo combinato con Stagione/Episodio.
            // Questo impedisce di trovare "Stranger Things Capitolo Nove" (senza S04) che è il risultato errato.
            
            if (episode) {
                // S01E01 Patterns
                queries.add(`${t} S${sStr}E${eStr} ${langSuffix}`); 
                queries.add(`${t} S${sStr}E${eStr}`); 
                queries.add(`${t} ${season}x${eStr}`); 
                
                // Anime / Absolute Numbering
                queries.add(`${t} ${episode}`); 
            }

            // Season Packs
            queries.add(`${t} Stagione ${season} ${langSuffix}`);
            queries.add(`${t} Season ${season}`);
            queries.add(`${t} S${sStr}`);
        
        } else {
            // === LOGICA FILM (BROAD / AGGRESSIVE) ===
            // Qui SI che aggiungiamo il titolo da solo, per trovare "Black Phone 2" senza anno.
            
            // 1. Titolo + Anno (Preciso)
            queries.add(`${t} ${year} ${langSuffix}`);
            queries.add(`${t} ${year}`);

            // 2. Tolleranza Anno
            if (year) {
                const yNum = parseInt(year);
                queries.add(`${t} ${yNum - 1}`);
                queries.add(`${t} ${yNum + 1}`);
            }

            // 3. Titolo Secco (SALVA-VITA per Black Phone 2)
            // Abilitato SOLO per i film.
            if (t.length >= 3 && !commonWordsOnly(t)) {
                queries.add(t); 
                queries.add(`${t} ${langSuffix}`);
            }
            
            // 4. Se contiene numeri (Black Phone 2), forziamo la ricerca secca
            if (/\d/.test(t)) {
                queries.add(t);
            }
        }
    });

    // Ordinamento
    return Array.from(queries).sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        
        if (a.includes("ITA")) scoreA += 20;
        if (b.includes("ITA")) scoreB += 20;
        
        if (isSeries && /S\d+E\d+/i.test(a)) scoreA += 15;
        if (isSeries && /S\d+E\d+/i.test(b)) scoreB += 15;

        // Anno importante solo per i film
        if (!isSeries && year && a.includes(year)) scoreA += 10;
        if (!isSeries && year && b.includes(year)) scoreB += 10;

        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.length - b.length;
    });
}

module.exports = { generateSmartQueries, ultraNormalizeTitle, ULTRA_SEMANTIC_ALIASES, ULTRA_JUNK_TOKENS };
