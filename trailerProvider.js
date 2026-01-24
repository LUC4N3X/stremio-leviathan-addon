const fetch = require("node-fetch");

/* =====================================================
   TMDB CONFIG
===================================================== */
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = "4b9dfb8b1c9f1720b5cd1d7efea1d845";

/* =====================================================
   LOCALIZATION
===================================================== */
const RECAP_TRANSLATIONS = {
    "it-IT": { recap: "recap", season: "Stagione", lang: "italiano" },
    "en-US": { recap: "recap", season: "Season", lang: "" },
    "es-ES": { recap: "resumen", season: "Temporada", lang: "español" },
    "fr-FR": { recap: "recap", season: "Saison", lang: "français" }
};

const TRAILER_TRANSLATIONS = {
    "it-IT": { trailer: "trailer ita", season: "Stagione" },
    "en-US": { trailer: "trailer", season: "Season" }
};

const LANGUAGE_TO_COUNTRY = {
    "it-IT": "IT",
    "en-US": "US",
    "es-ES": "ES",
    "fr-FR": "FR"
};

const PROVIDER_NAMES = {
    8: "Netflix",
    119: "Prime Video",
    337: "Disney+",
    384: "HBO Max",
    1899: "Max",
    350: "Apple TV+",
    531: "Paramount+"
};

/* =====================================================
   UTILS
===================================================== */

// 🔥 pulizia titoli YouTube (CRITICA)
function cleanTitle(raw, fallback) {
    if (!raw) return fallback;
    return raw
        .replace(/\|.*$/g, "")
        .replace(/trailer ufficiale/ig, "")
        .replace(/official trailer/ig, "")
        .replace(/netflix/ig, "")
        .replace(/italia/ig, "")
        .replace(/prime video/ig, "")
        .replace(/\s+/g, " ")
        .trim() || fallback;
}

// nome recap Leviathan-style
const recapName = s => `🧠 Recap • S${s}`;

/* =====================================================
   YOUTUBE SCRAPER (SAFE)
===================================================== */
async function searchYouTube(query, language = "en-US") {
    try {
        const [hl, gl] = language.split("-");
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}`;

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept-Language": `${hl}-${gl}`
            }
        });

        const html = await res.text();
        const idMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (!idMatch) return null;

        const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);
        return {
            ytId: idMatch[1],
            title: titleMatch ? titleMatch[1] : query
        };
    } catch {
        return null;
    }
}

/* =====================================================
   TMDB HELPERS
===================================================== */
async function getWatchProvider(tmdbId, language) {
    try {
        const country = LANGUAGE_TO_COUNTRY[language] || "US";
        const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`);
        const data = await res.json();
        const list = data?.results?.[country]?.flatrate;
        if (!list?.length) return null;
        return PROVIDER_NAMES[list[0].provider_id] || list[0].provider_name;
    } catch {
        return null;
    }
}

async function imdbToTmdb(imdbId, type, language) {
    try {
        const res = await fetch(
            `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=${language}`
        );
        const data = await res.json();
        const r = type === "series" ? data.tv_results : data.movie_results;
        return r?.[0]
            ? { id: r[0].id, title: r[0].name || r[0].title }
            : null;
    } catch {
        return null;
    }
}

async function fetchVideos(tmdbId, type, language, season) {
    try {
        const url =
            type === "series" && season
                ? `${TMDB_BASE}/tv/${tmdbId}/season/${season}/videos?api_key=${TMDB_KEY}&language=${language}`
                : `${TMDB_BASE}/${type === "series" ? "tv" : "movie"}/${tmdbId}/videos?api_key=${TMDB_KEY}&language=${language}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.results || [];
    } catch {
        return [];
    }
}

/* =====================================================
   RECAP ENGINE (LEVIATHAN STYLE)
===================================================== */
async function findRecap(series, season, provider, language) {
    const t = RECAP_TRANSLATIONS[language] || RECAP_TRANSLATIONS["en-US"];
    const langTag = t.lang ? ` ${t.lang}` : "";

    const queries = [
        provider && `${series} ${t.recap} ${t.season} ${season} ${provider}${langTag}`,
        `${series} ${t.recap} ${t.season} ${season}${langTag}`,
        `${series} recap Season ${season}`
    ].filter(Boolean);

    for (const q of queries) {
        const r = await searchYouTube(q, language);
        if (r) return r;
    }
    return null;
}

async function getRecapStreams(tmdbId, series, currentSeason, language = "it-IT") {
    if (currentSeason < 2) return [];

    const provider = await getWatchProvider(tmdbId, language);
    const streams = [];

    for (let s = currentSeason - 1; s >= 1; s--) {
        const recap = await findRecap(series, s, provider, language);
        if (recap) {
            streams.push({
                name: recapName(s),
                title: cleanTitle(recap.title, `${series} – Stagione ${s}`),
                ytId: recap.ytId,
                behaviorHints: {
                    bingeGroup: "leviathan_extras",
                    notWebReady: true
                }
            });
        }
    }
    return streams;
}

/* =====================================================
   TRAILER ENGINE (FIX DEFINITIVO)
===================================================== */
function selectBestTrailer(videos) {
    return (
        videos.find(v => v.type === "Trailer" && v.official) ||
        videos.find(v => v.type === "Trailer") ||
        videos[0]
    );
}

async function getTrailerStreams(type, imdbId, title, season, tmdbId, language = "it-IT") {
    if (!tmdbId && imdbId) {
        const map = await imdbToTmdb(imdbId, type, language);
        if (!map) return [];
        tmdbId = map.id;
        title = map.title;
    }

    let videos = await fetchVideos(tmdbId, type, language, season);
    let best = selectBestTrailer(videos);

    if (!best) {
        videos = await fetchVideos(tmdbId, type, "en-US", season);
        best = selectBestTrailer(videos);
    }

    let yt = best
        ? { ytId: best.key, title: best.name }
        : await searchYouTube(`${title} trailer`, language);

    if (!yt) return [];

    return [{
        name: "🎞 Trailer Ufficiale",
        title: cleanTitle(yt.title, title),
        externalUrl: `https://www.youtube.com/watch?v=${yt.ytId}`,
        behaviorHints: {
            bingeGroup: "leviathan_extras",
            notWebReady: true
        }
    }];
}

/* =====================================================
   EXPORTS
===================================================== */
module.exports = {
    getRecapStreams,
    getTrailerStreams
};
