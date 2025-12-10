const FuzzySet = require("fuzzyset");

// ==========================================
// 1. LISTE  DI FILTRAGGIO
// ==========================================

// Token tecnici da rimuovere PRIMA del confronto
const ULTRA_JUNK_TOKENS = new Set([
    // Codec & Risoluzione
    "h264","x264","h265","x265","hevc","1080p","720p","4k","2160p",
    "1080i", "720i", "480p", "sd", "hd", "fhd", "uhd", "sdr", "hdr", "vision",
    // Sorgenti & Formati
    "web","web-dl","bluray","rip","webrip", "bdrip", "dvdrip", "hdrip", "brrip", 
    "tsrip", "camrip", "cam", "ts", "hdtv", "mkv", "mp4", "avi", "divx", "xvid",
    // Audio
    "ac3", "aac", "dts", "truehd", "atmos", "dd5.1", "ddp5.1", "7.1", "5.1", 
    "stereo", "dual audio", "dolby",
    // Lingua & Sottotitoli
    "ita", "eng", "multi", "sub", "subs included", "multi sub", "forced subs", 
    "hardcoded", "softsubs", "dub",
    // Edizioni & Extra
    "repack", "remux", "proper", "complete", "pack", "season", "stagione", 
    "episode", "episodio", "vol", "extended", "directors cut", "unrated", 
    "theatrical", "imax", "series",
    // Streaming Services (Spesso nel nome file)
    "netflix", "amazon", "disney", "hulu", "hbo", "prime", "amzn", "dsnp", "nf",
    // Network & Distribuzione
    "torrent", "magnet", "ddl"
]);

// Parole comuni da ignorare nel confronto (Stop Words estese)
const ULTRA_STOP_WORDS = new Set([
    // Italiano
    "il","lo","la","i","gli","le","un","uno","una","di","del","della","dei",
    "delle","da","in","con","su","per","tra","fra",
    // Inglese
    "the","a","an","of","on","at","to","for","by","with","and","&","it","chapter",
    // Francese / Tedesco (comuni in multi)
    "les","une","des","du","au","aux","der","die","das","ein","eine","im","am","zum"
]);

// Parole che indicano un contenuto diverso dall'originale (Sequel, ecc.)
const ULTRA_FORBIDDEN_EXPANSIONS = new Set([
    "new","blood","resurrection","returns","reborn",
    "origins","legacy","revival","sequel",
    "redemption", "evolution", "dead city", "world beyond", "fear the",
    "remake", "reimagined", "extended edition", "fan edit", "bootleg", 
    "unaired", "pilot",
    // Specifici per evitare casi come "Lisa Frankenstein"
    "lisa", "bride", "son", "curse", "revenge"
]);

// Regex per contenuti spazzatura (Fanfic, Parodie)
const FORBIDDEN_REGEX = [/fanfic/i, /parody/i, /spoof/i, /mock/i, /fake/i];

// Grafo Spinoff Avanzato
const ULTRA_SPINOFF_GRAPH = {
    "dexter": { spinoffs: ["new blood", "original sin"] },
    "the walking dead": { spinoffs: ["dead city", "world beyond", "fear the walking dead", "daryl dixon", "ones who live"] },
    "breaking bad": { spinoffs: ["better call saul", "el camino"] },
    "game of thrones": { spinoffs: ["house of the dragon", "snow"] },
    "csi": { spinoffs: ["miami", "ny", "cyber", "vegas"] },
    "ncis": { spinoffs: ["los angeles", "new orleans", "hawaii", "sydney"] },
    "star trek": { spinoffs: ["next generation", "deep space nine", "voyager", "enterprise", "discovery", "picard", "strange new worlds"] },
    "star wars": { spinoffs: ["mandalorian", "andor", "obi-wan", "ahsoka", "book of boba fett"] },
    "naruto": { spinoffs: ["shippuden", "boruto"] },
    "dragon ball": { spinoffs: ["z", "super", "gt", "kai"] }
};

// ==========================================
// 2. FUNZIONI DI SUPPORTO
// ==========================================

function romanToArabic(str) {
    const map = { i:1,v:5,x:10,l:50,c:100 };
    let total = 0, prev = 0;
    str = str.toLowerCase();
    for (let c of str.split("").reverse()) {
        const val = map[c] || 0;
        total += val < prev ? -val : val;
        prev = val;
    }
    return total;
}

function normalizeTitle(t) {
    if (!t) return "";
    return t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Rimuove accenti
        .replace(/[':;-]/g, " ") // Punteggiatura -> Spazi
        .replace(/[^a-z0-9\s]/g, " ") // Via simboli
        .replace(/\b(ii|iii|iv|vi|vii|viii|ix|x)\b/gi, r => romanToArabic(r)) // Romani -> Arabi
        .replace(/\s+/g, " ").trim();
}

function tokenize(str) {
    return normalizeTitle(str).split(/\s+/).filter(t => t.length > 0);
}

function extractEpisodeInfo(filename) {
    const upper = filename.toUpperCase();
    // S01E01
    const sxeMatch = upper.match(/S(\d{1,2})(?:[._\s-]*E|x)(\d{1,3})/i);
    if (sxeMatch) return { season: parseInt(sxeMatch[1]), episode: parseInt(sxeMatch[2]) };
    
    // 1x01
    const xMatch = upper.match(/(\d{1,2})X(\d{1,3})/i);
    if (xMatch) return { season: parseInt(xMatch[1]), episode: parseInt(xMatch[2]) };
    
    // Stagione 1 Episodio 1
    const itaMatch = upper.match(/STAGIONE\s*(\d{1,2}).*EPISODIO\s*(\d{1,3})/i);
    if (itaMatch) return { season: parseInt(itaMatch[1]), episode: parseInt(itaMatch[2]) };

    return null;
}

function extractYear(filename) {
    // Cerca anno formato (19xx o 20xx)
    const match = filename.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0]) : null;
}

// Funzione Aggiornata per leggere ULTRA_SPINOFF_GRAPH
function isUnwantedSpinoff(cleanMeta, cleanFile) {
    for (const [parent, data] of Object.entries(ULTRA_SPINOFF_GRAPH)) {
        if (cleanMeta.includes(parent)) {
            const isSearchingForSpinoff = data.spinoffs.some(s => cleanMeta.includes(s));
            if (!isSearchingForSpinoff) {
                // Se NON cerco uno spinoff, ma il FILE ne contiene uno -> SCARTA
                for (const sp of data.spinoffs) {
                    if (cleanFile.includes(sp)) return true; // Trovato spinoff indesiderato
                }
            }
        }
    }
    return false;
}

// ==========================================
// 3. FUNZIONE PRINCIPALE: SMART MATCH
// ==========================================
// Aggiunto parametro opzionale metaYear
function smartMatch(metaTitle, filename, isSeries = false, metaSeason = null, metaEpisode = null, metaYear = null) {
    if (!filename) return false;
    const fLower = filename.toLowerCase();
    
    // Controllo Regex Spazzatura (Fanfic, Fake, ecc.)
    if (FORBIDDEN_REGEX.some(r => r.test(fLower))) return false;
    if (fLower.includes("sample") || fLower.includes("trailer") || fLower.includes("bonus")) return false;

    const cleanMetaString = normalizeTitle(metaTitle);
    const cleanFileString = normalizeTitle(filename);

    // Controllo Spinoff
    if (isUnwantedSpinoff(cleanMetaString, cleanFileString)) return false;

    // Tokenizzazione con Liste ULTRA
    const fTokens = tokenize(filename).filter(t => !ULTRA_JUNK_TOKENS.has(t) && !ULTRA_STOP_WORDS.has(t));
    const mTokens = tokenize(metaTitle).filter(t => !ULTRA_STOP_WORDS.has(t));

    if (mTokens.length === 0) return false;

    // Controllo "Forbidden Expansions" (Sequel/Remake non richiesti)
    const isCleanSearch = !mTokens.some(mt => ULTRA_FORBIDDEN_EXPANSIONS.has(mt));
    if (isCleanSearch) {
        if (fTokens.some(ft => ULTRA_FORBIDDEN_EXPANSIONS.has(ft))) return false;
    }

    // === LOGICA SERIE TV ===
    if (isSeries && metaSeason !== null) {
        // [LOGICA SERIE INVARIATA...]
        const epInfo = extractEpisodeInfo(filename);
        if (epInfo) {
            if (epInfo.season !== metaSeason || epInfo.episode !== metaEpisode) return false;
            const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
            if (fuz && fuz[0][0] > 0.75) return true;
            let matchCount = 0;
            mTokens.forEach(mt => { if (fTokens.some(ft => ft.includes(mt))) matchCount++; });
            if (matchCount / mTokens.length >= 0.6) return true;
            return false;
        }

        const seasonMatch = filename.match(/(?:S|Season|Stagione|Stg)[._\s-]*(\d{1,2})(?!\d|E|x)/i);
        if (seasonMatch) {
             const foundSeason = parseInt(seasonMatch[1]);
             if (foundSeason !== metaSeason) return false;
             const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
             if (fuz && fuz[0][0] > 0.70) return true; 
             let matchCount = 0;
             mTokens.forEach(mt => { if (fTokens.includes(mt)) matchCount++; });
             if (matchCount / mTokens.length >= 0.7) return true;
        }
        return false;
    }

    // === LOGICA FILM ===
    
    // 1. Controllo Anno (Cruciale per Frankenstein 2025 vs Lisa Frankenstein 2024)
    if (metaYear) {
        const fileYear = extractYear(filename);
        if (fileYear) {
            // Se gli anni sono diversi e la distanza è >= 1 anno, stai attento
            // Esempio: Cerco 2025, trovo 2024. Se il titolo non è IDENTICO, scarta.
            if (Math.abs(fileYear - metaYear) >= 1) {
                // Tolleranza zero se il titolo non è esattamente lo stesso
                // Se cerco "Frankenstein" (2025) e trovo "Lisa Frankenstein" (2024), qui verrebbe bloccato
                // perché "Lisa" sporca il match esatto.
                const strictFuzzy = FuzzySet([cleanMetaString]).get(cleanFileString);
                // Se il fuzzy score è basso (< 0.95) e l'anno è diverso, è un altro film
                if (!strictFuzzy || strictFuzzy[0][0] < 0.95) return false;
            }
        }
    }

    // 2. Controllo Prefisso Intruso ("Lisa" Check)
    // Se la prima parola del file (pulito) NON è la prima parola del titolo cercato
    // E la prima parola del file non è contenuta nel titolo cercato... è un altro film.
    if (fTokens.length > 0 && mTokens.length > 0) {
        const firstMeta = mTokens[0];
        const firstFile = fTokens[0];
        
        // Esempio: Meta="Frankenstein", File="Lisa Frankenstein"
        // firstMeta="frankenstein", firstFile="lisa"
        // "lisa" != "frankenstein" e "lisa" non è in mTokens -> SCARTA
        if (firstFile !== firstMeta && !mTokens.includes(firstFile)) {
            
            // Eccezione: a volte il file ha il titolo inglese prima?
            // Controlliamo se il titolo cercato appare DOPO interamente
            const joinedFile = fTokens.join(" ");
            const joinedMeta = mTokens.join(" ");
            
            // Se il titolo cercato è "Frankenstein" e il file è "Lisa Frankenstein"
            // joinedFile include joinedMeta, MA c'è robaccia prima.
            if (joinedFile.includes(joinedMeta)) {
                // Se c'è un prefisso significativo, scarta.
                return false;
            }
        }
    }

    const cleanF = fTokens.join(" ");
    const cleanM = mTokens.join(" ");
    
    // Fuzzy Match
    const fuzzyScore = FuzzySet([cleanM]).get(cleanF)?.[0]?.[0] || 0;
    
    // Aumentato threshold per evitare falsi positivi corti
    if (fuzzyScore > 0.85) return true;

    // Token Match Fallback
    let found = 0;
    fTokens.forEach(ft => {
        if (mTokens.some(mt => mt === ft || (mt.length > 3 && ft.includes(mt)))) found++;
    });
    
    // Richiedi che quasi tutte le parole del titolo siano presenti
    const ratio = found / mTokens.length;
    if (ratio >= 0.90) return true; // Alzato da 0.80 a 0.90 per precisione

    return false;
}

module.exports = { smartMatch };
