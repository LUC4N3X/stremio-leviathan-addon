const FuzzySet = require("fuzzyset");

// 1. JUNK TECNICO
const JUNK_TOKENS = new Set([
    "h264","x264","h265","x265","hevc","1080p","720p","4k","2160p",
    "hdr","web","web-dl","bluray","rip","ita","eng","multi","sub",
    "ac3","aac","mkv","mp4","avi","divx","xvid","dts","truehd",
    "atmos","vision","repack","remux","proper","complete","pack",
    "uhd","sdr","season","stagione","episode","episodio","cam","ts",
    "hdtv", "amzn", "dsnp", "nf", "series", "vol"
]);

// 2. STOP WORDS
const STOP_WORDS = new Set([
    "il","lo","la","i","gli","le","un","uno","una",
    "the","a","an","of","in","on","at","to","for","by","with","and","&",
    "it", "chapter", "capitolo"
]);

// 3. BLACKLIST
const FORBIDDEN_EXPANSIONS = new Set([
    "new","blood","resurrection","returns","reborn",
    "origins","legacy","revival","sequel",
    "redemption", "evolution", "dead city", "world beyond", "fear the"
]);

const SPINOFF_KEYWORDS = {
    "dexter": ["new blood"],
    "the walking dead": ["dead city", "world beyond", "fear", "daryl"],
    "breaking bad": ["better call saul"],
    "game of thrones": ["house of the dragon"],
    "csi": ["miami", "ny", "cyber", "vegas"],
    "ncis": ["los angeles", "new orleans", "hawaii", "sydney"]
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

function normalizeTitle(t) {
    return t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[':;-]/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\b(ii|iii|iv|vi|vii|viii|ix|x)\b/gi, r => romanToArabic(r))
        .replace(/\s+/g, " ").trim();
}

function tokenize(str) {
    return normalizeTitle(str).split(/\s+/).filter(t => t.length > 0);
}

function extractEpisodeInfo(filename) {
    const upper = filename.toUpperCase();
    const sxeMatch = upper.match(/S(\d{1,2})(?:[._\s-]*E|x)(\d{1,3})/i);
    if (sxeMatch) return { season: parseInt(sxeMatch[1]), episode: parseInt(sxeMatch[2]) };
    
    // Supporto per "1x01"
    const xMatch = upper.match(/(\d{1,2})X(\d{1,3})/i);
    if (xMatch) return { season: parseInt(xMatch[1]), episode: parseInt(xMatch[2]) };
    
    return null;
}

function isUnwantedSpinoff(cleanMeta, cleanFile) {
    for (const [parent, spinoffs] of Object.entries(SPINOFF_KEYWORDS)) {
        if (cleanMeta.includes(parent)) {
            for (const sp of spinoffs) {
                if (cleanFile.includes(sp) && !cleanMeta.includes(sp)) return true;
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
    
    if (fLower.includes("sample") || fLower.includes("trailer") || fLower.includes("bonus")) return false;

    const cleanMetaString = normalizeTitle(metaTitle);
    const cleanFileString = normalizeTitle(filename);

    if (isUnwantedSpinoff(cleanMetaString, cleanFileString)) return false;

    const fTokens = tokenize(filename).filter(t => !JUNK_TOKENS.has(t) && !STOP_WORDS.has(t));
    const mTokens = tokenize(metaTitle).filter(t => !STOP_WORDS.has(t));

    if (mTokens.length === 0) return false;

    const isCleanSearch = !mTokens.some(mt => FORBIDDEN_EXPANSIONS.has(mt));
    if (isCleanSearch) {
        if (fTokens.some(ft => FORBIDDEN_EXPANSIONS.has(ft))) return false;
    }

    // 6. LOGICA SERIE TV (AGGIORNATA PER PACK)
    if (isSeries && metaSeason !== null && metaEpisode !== null) {
        const epInfo = extractEpisodeInfo(filename);
        
        // CASO A: Troviamo un numero di episodio specifico nel file (es. S01E05)
        if (epInfo) {
            // I numeri DEVONO coincidere.
            if (epInfo.season !== metaSeason || epInfo.episode !== metaEpisode) return false;
            
            // Verifica semantica titolo
            let matchCount = 0;
            mTokens.forEach(mt => {
                if (fTokens.some(ft => ft.includes(mt) || mt.includes(ft))) matchCount++;
            });
            const matchRatio = matchCount / mTokens.length;
            if (matchRatio >= 0.6) return true;
            
            const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
            if (fuz && fuz[0][0] > 0.8) return true;

            return false;
        }

        // CASO B: Non troviamo episodio, ma cerchiamo se è un "Season Pack" (es. Serie S01)
        const seasonMatch = filename.match(/S(?:eason|tagione)?\s*(\d{1,2})/i);
        if (seasonMatch) {
             const foundSeason = parseInt(seasonMatch[1]);
             // La stagione DEVE coincidere
             if (foundSeason !== metaSeason) return false;

             
             const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
             // Soglia abbassata a 0.75 per i pack
             if (fuz && fuz[0][0] > 0.75) return true;
             
             // Fallback token match
             let matchCount = 0;
             mTokens.forEach(mt => { if (fTokens.includes(mt)) matchCount++; });
             if (matchCount / mTokens.length >= 0.7) return true;
        }
        
        // Se non è né episodio singolo né pack valido, scarta.
        return false;
    }

    // 7. LOGICA FILM
    const cleanF = fTokens.join(" ");
    const cleanM = mTokens.join(" ");
    const fuzzyScore = FuzzySet([cleanM]).get(cleanF)?.[0]?.[0] || 0;
    
    if (fuzzyScore > 0.85) return true;

    if (!isSeries) {
        let found = 0;
        fTokens.forEach(ft => {
            if (mTokens.some(mt => mt === ft || (mt.length > 3 && ft.includes(mt)))) found++;
        });
        const ratio = found / mTokens.length;
        if (ratio >= 0.75) return true;
    }

    return false;
}

module.exports = { smartMatch };
