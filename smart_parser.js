const FuzzySet = require("fuzzyset");

// 1. JUNK TECNICO (ALLINEATO CON AI_QUERY BOMBA EDITION)
// Questi token vengono rimossi PRIMA del confronto per capire se è il film giusto.
const JUNK_TOKENS = new Set([
    // Video
    "h264","x264","h265","x265","hevc","1080p","720p","4k","2160p","480p","sd","hd","fhd","uhd",
    "hdr","web","web-dl","webrip","bdrip","dvdrip","bluray","rip","remux","proper","repack",
    "internal","extended","director","cut","edition","remastered",
    // Audio & Lingua (Li rimuoviamo per il match del TITOLO, il controllo lingua si fa dopo)
    "ita","eng","multi","sub","dub","ac3","aac","dts","truehd","atmos","dd5.1","5.1","7.1",
    // Container & Extra
    "mkv","mp4","avi","complete","pack","season","stagione","episode","episodio","vol",
    "torrent","magnet","streaming"
]);

// 2. STOP WORDS (Parole grammaticali da ignorare)
const STOP_WORDS = new Set([
    "il","lo","la","i","gli","le","un","uno","una","del","della","dei","al","alla","ai",
    "the","a","an","of","in","on","at","to","for","by","with","and","&",
    "chapter", "capitolo", "part", "parte"
]);

// 3. BLACKLIST (Parole che se presenti nel file ma non nella query indicano un altro film)
const FORBIDDEN_EXPANSIONS = new Set([
    "new","blood","resurrection","returns","reborn",
    "origins","legacy","revival","sequel",
    "redemption", "evolution", "dead city", "world beyond", "fear the"
]);

// Spinoff noti da escludere
const SPINOFF_KEYWORDS = {
    "dexter": ["new blood"],
    "the walking dead": ["dead city", "world beyond", "fear", "daryl"],
    "breaking bad": ["better call saul"],
    "game of thrones": ["house of the dragon"],
    "naruto": ["shippuden", "boruto"], // Aggiunto per anime
    "dragon ball": ["z", "super", "gt", "kai"] // Aggiunto per anime
};

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

// Normalizzazione "Ultra" (Coerente con ai_query)
function normalizeTitle(t) {
    if (!t) return "";
    return t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Via accenti
        .replace(/[':;-]/g, " ") // Punteggiatura -> Spazi
        .replace(/[^a-z0-9\s]/g, " ") // Via simboli strani
        .replace(/\b(ii|iii|iv|vi|vii|viii|ix|x)\b/gi, r => romanToArabic(r)) // Romani -> Arabi
        .replace(/\s+/g, " ").trim(); // Trim spazi
}

function tokenize(str) {
    return normalizeTitle(str).split(/\s+/).filter(t => t.length > 0);
}

function extractEpisodeInfo(filename) {
    const upper = filename.toUpperCase();
    // Match Standard: S01E01, S1E1
    const sxeMatch = upper.match(/S(\d{1,2})(?:[._\s-]*E|x)(\d{1,3})/i);
    if (sxeMatch) return { season: parseInt(sxeMatch[1]), episode: parseInt(sxeMatch[2]) };
    
    // Match Alternativo: 1x01
    const xMatch = upper.match(/(\d{1,2})X(\d{1,3})/i);
    if (xMatch) return { season: parseInt(xMatch[1]), episode: parseInt(xMatch[2]) };
    
    // Match Italiano: Stagione 1 Episodio 1 (Raro nei filename torrent, ma possibile)
    const itaMatch = upper.match(/STAGIONE\s*(\d{1,2}).*EPISODIO\s*(\d{1,3})/i);
    if (itaMatch) return { season: parseInt(itaMatch[1]), episode: parseInt(itaMatch[2]) };

    return null;
}

function isUnwantedSpinoff(cleanMeta, cleanFile) {
    for (const [parent, spinoffs] of Object.entries(SPINOFF_KEYWORDS)) {
        // Se cerchiamo il padre (es. "The Walking Dead")
        if (cleanMeta.includes(parent) && !spinoffs.some(s => cleanMeta.includes(s))) {
            // Ma il file contiene uno spinoff (es. "Dead City")
            for (const sp of spinoffs) {
                if (cleanFile.includes(sp)) return true; // Scarta
            }
        }
    }
    return false;
}

// ==========================================
//  FUNZIONE PRINCIPALE: SMART MATCH
// ==========================================
function smartMatch(metaTitle, filename, isSeries = false, metaSeason = null, metaEpisode = null) {
    if (!filename) return false;
    const fLower = filename.toLowerCase();
    
    // Filtri preliminari rapidi
    if (fLower.includes("sample") || fLower.includes("trailer") || fLower.includes("bonus")) return false;

    const cleanMetaString = normalizeTitle(metaTitle);
    const cleanFileString = normalizeTitle(filename);

    if (isUnwantedSpinoff(cleanMetaString, cleanFileString)) return false;

    // Tokenizzazione
    const fTokens = tokenize(filename).filter(t => !JUNK_TOKENS.has(t) && !STOP_WORDS.has(t));
    const mTokens = tokenize(metaTitle).filter(t => !STOP_WORDS.has(t));

    if (mTokens.length === 0) return false;

    // Controllo "Forbidden Expansions" (Sequel/Prequel non richiesti)
    const isCleanSearch = !mTokens.some(mt => FORBIDDEN_EXPANSIONS.has(mt));
    if (isCleanSearch) {
        if (fTokens.some(ft => FORBIDDEN_EXPANSIONS.has(ft))) return false;
    }

    // === LOGICA SERIE TV ===
    if (isSeries && metaSeason !== null) {
        // 1. Cerca Episodio Specifico
        const epInfo = extractEpisodeInfo(filename);
        if (epInfo) {
            // Se c'è info episodio, deve combaciare perfettamente
            if (epInfo.season !== metaSeason || epInfo.episode !== metaEpisode) return false;
            
            // Verifica semantica titolo (il nome della serie deve combaciare)
            const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
            if (fuz && fuz[0][0] > 0.75) return true; // Soglia 0.75 per tollerare piccole differenze
            
            // Fallback Token Match (se Fuzzy fallisce)
            let matchCount = 0;
            mTokens.forEach(mt => { if (fTokens.some(ft => ft.includes(mt))) matchCount++; });
            if (matchCount / mTokens.length >= 0.6) return true;

            return false;
        }

        // 2. Cerca Season Pack (Senza info episodio)
        // Regex per: "S01", "Season 1", "Stagione 1", "Complete S1"
        const seasonMatch = filename.match(/(?:S|Season|Stagione|Stg)[._\s-]*(\d{1,2})(?!\d|E|x)/i);
        if (seasonMatch) {
             const foundSeason = parseInt(seasonMatch[1]);
             if (foundSeason !== metaSeason) return false;

             // Verifica titolo per i pack
             const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
             // Soglia leggermente più bassa per i pack (spesso hanno nomi strani)
             if (fuz && fuz[0][0] > 0.70) return true; 
             
             // Fallback Token
             let matchCount = 0;
             mTokens.forEach(mt => { if (fTokens.includes(mt)) matchCount++; });
             if (matchCount / mTokens.length >= 0.7) return true;
        }
        
        return false; // Se è serie ma non è match episodio né match stagione -> scarta
    }

    // === LOGICA FILM ===
    const cleanF = fTokens.join(" ");
    const cleanM = mTokens.join(" ");
    
    // 1. Fuzzy Match (Alta precisione)
    const fuzzyScore = FuzzySet([cleanM]).get(cleanF)?.[0]?.[0] || 0;
    if (fuzzyScore > 0.85) return true;

    // 2. Token Inclusion (Fallback per titoli lunghi)
    if (!isSeries) {
        let found = 0;
        fTokens.forEach(ft => {
            // Match esatto o substring significativa (>3 char)
            if (mTokens.some(mt => mt === ft || (mt.length > 3 && ft.includes(mt)))) found++;
        });
        const ratio = found / mTokens.length;
        if (ratio >= 0.80) return true; // 80% dei token devono esserci
    }

    return false;
}

module.exports = { smartMatch };
