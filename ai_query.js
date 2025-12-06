
// Dizionario AI statico
const SEMANTIC_ALIASES = {
    // Serie Popolari
    "la casa di carta": ["money heist", "la casa de papel"],
    "il trono di spade": ["game of thrones"],
    "l'attacco dei giganti": ["attack on titan", "shingeki no kyojin"],
    "demon slayer": ["kimetsu no yaiba"],
    "jujutsu kaisen": ["sorcery fight"],
    "my hero academia": ["boku no hero academia"],
    "one piece": ["one piece ita"],
    // Film / Franchise complessi
    "fast and furious": ["fast & furious", "f9", "fast x"],
    "harry potter": ["hp"],
    // Correzioni comuni & Prequel
    "dr house": ["house md", "house m.d.", "dr. house"],
    "it welcome to derry": ["welcome to derry"], // FIX FONDAMENTALE
    "it: welcome to derry": ["welcome to derry"]
};

function generateSmartQueries(meta) {
    const { title, originalTitle, year, season, episode, isSeries } = meta;
    const cleanTitle = title.toLowerCase().trim();
    
    // 1. Base Set: Titolo Italiano e Originale
    let titles = new Set();
    titles.add(title);
    if (originalTitle) titles.add(originalTitle);

    // 2. Espansione Semantica (AI Dictionary)
    // Cerca sia il titolo pulito che l'originale nel dizionario
    [cleanTitle, (originalTitle || "").toLowerCase().trim()].forEach(t => {
        if (SEMANTIC_ALIASES[t]) {
            SEMANTIC_ALIASES[t].forEach(alias => titles.add(alias));
        }
    });

    // 3. Generazione Query Combinate
    let queries = new Set();
    const sStr = season ? String(season).padStart(2, "0") : "";
    const eStr = episode ? String(episode).padStart(2, "0") : "";

    titles.forEach(t => {
        if (isSeries) {
            // Standard: Titolo SxxExx
            queries.add(`${t} S${sStr}E${eStr}`);
            
            // Varianti Anno (Critico per reboot)
            if (year) queries.add(`${t} ${year} S${sStr}E${eStr}`);
            
            // Formato XxY (vecchi tracker)
            queries.add(`${t} ${season}x${eStr}`);
            
            // Pack Stagionali
            queries.add(`${t} Stagione ${season}`);
            queries.add(`${t} Season ${season}`);
        } else {
            // Film
            queries.add(`${t} ${year}`);
            if (!t.toLowerCase().includes("ita")) queries.add(`${t} ITA`);
        }
    });

    return Array.from(queries).sort((a, b) => {
        if (originalTitle && a.startsWith(originalTitle)) return -1;
        return 0;
    });
}

module.exports = { generateSmartQueries };
