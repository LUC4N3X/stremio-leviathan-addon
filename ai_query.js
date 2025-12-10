// 1. CONFIGURAZIONE JUNK & PATTERN

// Token tecnici da rimuovere per trovare il "vero" titolo
const ULTRA_JUNK_TOKENS = new Set([
    // Lingua e Audio
    "ita", "eng", "sub", "subita", "dub", "multi", "dual", "audio",
    "ac3", "aac", "aac5.1", "dd5.1", "ddp5.1", "dts", "truehd", "stereo", "5.1", "7.1",
    // Video Codec e Qualità
    "x264", "x265", "h264", "hevc", "divx", "xvid",
    "webrip", "bdrip", "dvdrip", "hdrip", "brrip", "tsrip", "camrip", "web-dl", "bluray", "remux",
    "1080i", "720i", "480p", "576p", "sd", "hd", "fhd", "uhd", "4k", "8k", "2160p", "1080p", "720p",
    // Edizioni e Sorgenti
    "extended", "directors cut", "unrated", "theatrical", "imax", "remastered",
    "netflix", "amazon", "disney", "hulu", "hbo", "prime", "apple tv",
    // Network & Release
    "torrent", "magnet", "ddl", "direct download", "subs included",
    "multi sub", "forced subs", "hardcoded", "softsubs", "complete", "pack", "season pack"
]);

// Pattern dinamici per identificare variazioni del titolo (Reboot, Sequel, Spinoff)
const DYNAMIC_PATTERNS = {
    reboot: [/reboot/i, /remake/i, /legacy/i, /returns/i, /resurrection/i],
    sequel: [/part \d/i, /chapter \d/i, /\d{1,2}/, /sequel/i, /ii/i, /iii/i],
    spinoff: [/origins/i, /begins/i, /rises/i, /chronicles/i, /story/i]
};

// ==========================================
// 2. DIZIONARIO AI "BOMBA EDITION" (ITA)
// ==========================================
const ULTRA_SEMANTIC_ALIASES = {
    // --- SERIE TV POPOLARI ---
    "la casa di carta": ["money heist", "la casa de papel", "lcdp"],
    "il trono di spade": ["game of thrones", "got", "a song of ice and fire"],
    "l'attacco dei giganti": ["attack on titan", "shingeki no kyojin", "aot"],
    "demon slayer": ["kimetsu no yaiba", "ds"],
    "jujutsu kaisen": ["sorcery fight", "jjk"],
    "my hero academia": ["boku no hero academia", "mha"],
    "one piece": ["one piece ita", "op"],
    "breaking bad": ["bb", "brba"],
    "stranger things": ["st"],
    "the mandalorian": ["mando", "star wars mandalorian"],
    "the witcher": ["witcher"],
    "squid game": ["ojingeo geim"],
    "naruto": ["naruto shippuden"],
    "dragon ball": ["dbz", "dbs", "dragonball", "dragon ball z", "dragon ball super"],
    
    // --- SERIE ITALIANE ---
    "gomorra": ["gomorrah", "gomorra la serie"],
    "mare fuori": ["the sea beyond"],
    "zero calcare": ["strappare lungo i bordi", "questo mondo non mi rendera cattivo"],
    "l'amica geniale": ["my brilliant friend"],
    "suburra": ["suburra la serie"],

    // --- FRANCHISE & FILM ---
    "fast and furious": ["fast & furious", "f9", "fast x", "the fast saga"],
    "harry potter": ["hp", "philosopher stone", "chamber secrets", "prisoner azkaban", "goblet fire", "order phoenix", "half blood prince", "deathly hallows"],
    "star wars": ["sw", "a new hope", "empire strikes back", "return jedi", "phantom menace", "attack clones", "revenge sith", "force awakens", "last jedi", "rise skywalker"],
    "marvel": ["mcu", "avengers", "iron man", "captain america", "thor", "black widow", "spider-man", "guardians of the galaxy"],
    "dc": ["dceu", "batman", "superman", "wonder woman", "justice league", "joker", "the batman"],
    "il signore degli anelli": ["lord of the rings", "lotr", "fellowship ring", "two towers", "return king"],
    
    // --- CORREZIONI COMUNI ---
    "dr house": ["house md", "house m.d.", "dr. house"],
    "it welcome to derry": ["welcome to derry"],
    "the walking dead": ["twd"],
    "better call saul": ["bcs"],
    "house of the dragon": ["hotd"]
};

// ==========================================
// 3. FUNZIONI DI NORMALIZZAZIONE E LOGICA
// ==========================================

// Funzione potente per pulire i titoli 
function ultraNormalizeTitle(t) {
    if (!t) return "";
    return t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Rimuove accenti (è -> e)
        .replace(/[':;,-.?!]/g, " ") // Punteggiatura diventa spazio
        .replace(/[^a-z0-9\s]/g, "") // Via tutto ciò che non è testo/numeri
        .replace(/\s+/g, " ").trim(); // Via doppi spazi
}

// Espansione intelligente tramite Pattern e Dizionario
function autoExpandAliases(cleanTitle) {
    let aliases = new Set();
    
    // 1. Controllo Dizionario Statico
    if (ULTRA_SEMANTIC_ALIASES[cleanTitle]) {
        ULTRA_SEMANTIC_ALIASES[cleanTitle].forEach(a => aliases.add(a));
    }
    // Controllo inverso (se la chiave è contenuta nel titolo)
    Object.keys(ULTRA_SEMANTIC_ALIASES).forEach(key => {
        if (cleanTitle.includes(key)) {
             ULTRA_SEMANTIC_ALIASES[key].forEach(a => aliases.add(a));
        }
    });

    // 2. Pattern Matching Dinamico (Sequel, Reboot, ecc.)
    for (const [type, patterns] of Object.entries(DYNAMIC_PATTERNS)) {
        patterns.forEach(p => {
            if (p.test(cleanTitle)) {
                // Rimuove il pattern (es: "Batman Returns" -> "Batman")
                const stripped = cleanTitle.replace(p, '').trim();
                
                // SICUREZZA: Evita alias troppo corti (< 3 caratteri)
                if (stripped.length > 3) {
                    aliases.add(stripped);
                }
            }
        });
    }
    return Array.from(aliases);
}

// ==========================================
// 4. GENERATORE QUERY (CORE)
// ==========================================
function generateSmartQueries(meta) {
    // Imposta "ITA" come lingua predefinita se non specificata
    const { title, originalTitle, year, season, episode, isSeries, language = "ita" } = meta;
    
    // Normalizzazione
    const cleanTitle = ultraNormalizeTitle(title);
    const cleanOriginal = originalTitle ? ultraNormalizeTitle(originalTitle) : "";
    
    // Creazione set base dei titoli
    let titles = new Set();
    if (title) titles.add(title);
    if (cleanTitle && cleanTitle.length > 2) titles.add(cleanTitle);
    if (originalTitle) titles.add(originalTitle);
    
    // Espansione Aliases
    [cleanTitle, cleanOriginal].forEach(t => {
        if (t) {
            autoExpandAliases(t).forEach(alias => titles.add(alias));
        }
    });

    let queries = new Set();
    const sStr = season ? String(season).padStart(2, "0") : "";
    const eStr = episode ? String(episode).padStart(2, "0") : "";
    const langSuffix = "ITA"; // Forza ITA per le ricerche prioritarie

    titles.forEach(t => {
        if (!t) return;
        
        // Pulizia finale del titolo (trim)
        t = t.trim();

        if (isSeries) {
            // === SERIE TV ===
            
            // A. EPISODIO SPECIFICO
            if (episode) {
                // Query prioritarie (con ITA)
                queries.add(`${t} S${sStr}E${eStr} ${langSuffix}`);
                queries.add(`${t} ${season}x${eStr} ${langSuffix}`);
                
                // Query secondarie (Senza ITA, per file Multilang/DL)
                queries.add(`${t} S${sStr}E${eStr}`);
                queries.add(`${t} ${season}x${eStr}`);
            }
            
            // B. PACK STAGIONE (Fondamentale per serie vecchie o finite)
            // ITA Prima
            queries.add(`${t} Stagione ${season} ${langSuffix}`);
            queries.add(`${t} Season ${season} ${langSuffix}`);
            queries.add(`${t} S${sStr} ${langSuffix}`);
            
            // Varianti generiche
            queries.add(`${t} Stagione ${season}`);
            queries.add(`${t} S${sStr}`); // Spesso trova pack tipo "Nome Serie S01 1080p"
            
            // C. Varianti con Anno (utile per reboot)
            if (year) {
                queries.add(`${t} ${year} S${sStr}E${eStr}`);
                queries.add(`${t} ${year} S${sStr}`);
            }

        } else {
            // === FILM ===
            
            // 1. Titolo + Anno + ITA (Massima precisione)
            queries.add(`${t} ${year} ${langSuffix}`);
            
            // 2. Titolo + ITA (Senza anno)
            queries.add(`${t} ${langSuffix}`);
            
            // 3. Fallback (Solo Titolo + Anno)
            // Utile per file MKV che contengono audio ITA ma non lo scrivono nel titolo
            queries.add(`${t} ${year}`);
            
            // 4. Titolo secco (Solo se molto specifico/lungo)
            if (t.length > 5 && !year) {
                queries.add(t);
            }
        }
    });

    // ==========================================
    // 5. ORDINAMENTO INTELLIGENTE (ITA FIRST)
    // ==========================================
    return Array.from(queries).sort((a, b) => {
        // Calcolo punteggio per ordinamento
        let scoreA = 0;
        let scoreB = 0;

        // Regole di punteggio
        if (a.includes("ITA")) scoreA += 10;
        if (b.includes("ITA")) scoreB += 10;
        
        if (a.includes("E" + eStr)) scoreA += 5; // Episodio specifico
        if (b.includes("E" + eStr)) scoreB += 5;
        
        if (a.includes("Stagione")) scoreA += 2; // Preferisci "Stagione" a "Season" per ITA
        if (b.includes("Stagione")) scoreB += 2;

        // Ordinamento decrescente (punteggio più alto prima)
        if (scoreA !== scoreB) return scoreB - scoreA;
        
        // A parità di punteggio, preferisci la query più corta 
        return a.length - b.length;
    });
}

// Export moduli
module.exports = { generateSmartQueries, ultraNormalizeTitle, ULTRA_SEMANTIC_ALIASES, ULTRA_JUNK_TOKENS };
