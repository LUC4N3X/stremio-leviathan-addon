/**
 * smart_parser.js 
 * "Super AI" Logic - Token Weighting & Strict Numbering
 * Non richiede alias manuali per prefissi comuni.
 */

const FuzzySet = require("fuzzyset");

// 1. JUNK TECNICO (Da rimuovere sempre)
const JUNK_TOKENS = new Set([
    "h264","x264","h265","x265","hevc","1080p","720p","4k","2160p",
    "hdr","web","web-dl","bluray","rip","ita","eng","multi","sub",
    "ac3","aac","mkv","mp4","avi","divx","xvid","dts","truehd",
    "atmos","vision","repack","remux","proper","complete","pack",
    "uhd","sdr","season","stagione","episode","episodio","cam","ts",
    "hdtv", "amzn", "dsnp", "nf", "series", "vol"
]);

// 2. STOP WORDS (Parole che l'AI deve ignorare per capire il "senso" del titolo)
// Qui mettiamo "IT", "The", "A", così "IT: Welcome" diventa uguale a "Welcome"
const STOP_WORDS = new Set([
    "il","lo","la","i","gli","le","un","uno","una",
    "the","a","an","of","in","on","at","to","for","by","with","and","&",
    "it", "chapter", "capitolo" // Aggiunte parole che creano rumore
]);

// 3. BLACKLIST (Per evitare falsi positivi su spinoff)
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

// Helper: Romani -> Arabi
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

// Helper: Normalizzazione Potente
function normalizeTitle(t) {
    return t
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Via accenti
        .replace(/[':;-]/g, " ") // Via punteggiatura specifica
        .replace(/[^a-z0-9\s]/g, " ") // Via simboli strani
        .replace(/\b(ii|iii|iv|vi|vii|viii|ix|x)\b/gi, r => romanToArabic(r)) // Romani
        .replace(/\s+/g, " ")
        .trim();
}

// Helper: Tokenizer Intelligente
function tokenize(str) {
    return normalizeTitle(str).split(/\s+/).filter(t => t.length > 0);
}

// Helper: Estrazione Episodi (Supporta 1x01, S01E01, Stagione 1)
function extractEpisodeInfo(filename) {
    const upper = filename.toUpperCase();
    
    const sxeMatch = upper.match(/S(\d{1,2})(?:[._\s-]*E|x)(\d{1,3})/i);
    if (sxeMatch) return { season: parseInt(sxeMatch[1]), episode: parseInt(sxeMatch[2]) };

    const xMatch = upper.match(/(\d{1,2})X(\d{1,3})/i);
    if (xMatch) return { season: parseInt(xMatch[1]), episode: parseInt(xMatch[2]) };
    
    const itMatch = upper.match(/STAGIONE\s*(\d{1,2}).*?EPISODIO\s*(\d{1,3})/i);
    if (itMatch) return { season: parseInt(itMatch[1]), episode: parseInt(itMatch[2]) };

    return null;
}

// Helper: Controllo Spinoff
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
// 🧠 FUNZIONE PRINCIPALE: SMART MATCH
// ==========================================
function smartMatch(metaTitle, filename, isSeries = false, metaSeason = null, metaEpisode = null) {
    if (!filename) return false;
    const fLower = filename.toLowerCase();
    
    // 1. Filtro Spazzatura immediato
    if (fLower.includes("sample") || fLower.includes("trailer") || fLower.includes("bonus")) return false;

    // 2. Normalizzazione
    const cleanMetaString = normalizeTitle(metaTitle);
    const cleanFileString = normalizeTitle(filename);

    // 3. Controllo Spinoff
    if (isUnwantedSpinoff(cleanMetaString, cleanFileString)) return false;

    // 4. Tokenizzazione e Pulizia (Il cuore dell'AI)
    // Rimuove STOP_WORDS (es. "IT", "The") e JUNK (es. "1080p")
    const fTokens = tokenize(filename).filter(t => !JUNK_TOKENS.has(t) && !STOP_WORDS.has(t));
    const mTokens = tokenize(metaTitle).filter(t => !STOP_WORDS.has(t));

    if (mTokens.length === 0) return false; // Titolo vuoto dopo pulizia?

    // 5. Controllo "Forbidden" (Se non cercato)
    const isCleanSearch = !mTokens.some(mt => FORBIDDEN_EXPANSIONS.has(mt));
    if (isCleanSearch) {
        if (fTokens.some(ft => FORBIDDEN_EXPANSIONS.has(ft))) return false;
    }

    // 6. LOGICA SERIE TV (Rigorosa sui numeri, Flessibile sul titolo)
    if (isSeries && metaSeason !== null && metaEpisode !== null) {
        const epInfo = extractEpisodeInfo(filename);
        
        if (epInfo) {
            // I numeri DEVONO coincidere. Nessuna eccezione.
            if (epInfo.season !== metaSeason || epInfo.episode !== metaEpisode) return false;
            
            // Se i numeri coincidono, verifichiamo il titolo "Semanticamente"
            // Calcoliamo quanti token "chiave" del Meta sono presenti nel File.
            let matchCount = 0;
            mTokens.forEach(mt => {
                // Controllo se il token meta è contenuto in uno dei token file (o viceversa)
                if (fTokens.some(ft => ft.includes(mt) || mt.includes(ft))) matchCount++;
            });

            // Calcolo percentuale di match
            // Es. "Welcome", "Derry" (2 tokens). Se ne trovo 2, 100%. Se ne trovo 1, 50%.
            const matchRatio = matchCount / mTokens.length;

            // Se ho matchato almeno il 60% delle parole chiave E i numeri sono giusti -> OK
            // Questo permette a "Welcome to Derry" di passare anche se manca "IT".
            if (matchRatio >= 0.6) return true;
            
            // Fallback Fuzzy per errori di battitura lievi
            const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
            if (fuz && fuz[0][0] > 0.8) return true;

            return false;
        }

        // Gestione Season Pack (Se non c'è episodio specifico)
        const seasonMatch = filename.match(/S(?:eason|tagione)?\s*(\d{1,2})/i);
        if (seasonMatch) {
             const foundSeason = parseInt(seasonMatch[1]);
             if (foundSeason !== metaSeason) return false;
             // Per i pack, richiediamo un match del titolo più alto
             const fuz = FuzzySet([mTokens.join(" ")]).get(fTokens.join(" "));
             return (fuz && fuz[0][0] > 0.85);
        }
    }

    // 7. LOGICA FILM (Token Overlap + Fuzzy)
    const cleanF = fTokens.join(" ");
    const cleanM = mTokens.join(" ");

    // Fuzzy Set (Tolleranza errori battitura)
    const fuzzyScore = FuzzySet([cleanM]).get(cleanF)?.[0]?.[0] || 0;
    if (fuzzyScore > 0.85) return true;

    // Token Overlap (Per titoli con parole in ordine diverso)
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
