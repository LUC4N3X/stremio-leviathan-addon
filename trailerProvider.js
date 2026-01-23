const fetch = require('node-fetch');

// Shared Configuration
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = '4b9dfb8b1c9f1720b5cd1d7efea1d845';

// ==========================================
// CONFIGURATION & TRANSLATIONS
// ==========================================

/**
 * Recap translations for YouTube search queries
 */
const RECAP_TRANSLATIONS = {
    'en-US': { recap: 'recap', season: 'Season', langKeyword: '' },
    'it-IT': { recap: 'recap', season: 'Stagione', langKeyword: 'italiano' },
    'es-MX': { recap: 'resumen', season: 'Temporada', langKeyword: 'español latino' },
    'es-ES': { recap: 'resumen', season: 'Temporada', langKeyword: 'español' },
    'pt-BR': { recap: 'recap', season: 'Temporada', langKeyword: 'português' },
    'pt-PT': { recap: 'recap', season: 'Temporada', langKeyword: 'português' },
    'de-DE': { recap: 'Recap', season: 'Staffel', langKeyword: 'deutsch' },
    'fr-FR': { recap: 'recap', season: 'Saison', langKeyword: 'français' },
    'ru-RU': { recap: 'recap', season: 'Сезон', langKeyword: 'русский' },
    'ja-JP': { recap: 'recap', season: 'シーズン', langKeyword: '日本語' },
    'hi-IN': { recap: 'recap', season: 'सीज़न', langKeyword: 'हिंदी' },
    'ta-IN': { recap: 'recap', season: 'சீசன்', langKeyword: 'தமிழ்' },
    'tr-TR': { recap: 'özet', season: 'Sezon', langKeyword: 'türkçe' }
};

/**
 * Trailer translations
 */
const TRAILER_TRANSLATIONS = {
    'it-IT': { trailer: 'trailer ita', season: 'Stagione' },
    'en-US': { trailer: 'trailer', season: 'Season' }
};

/**
 * Language code to TMDB country code mapping
 */
const LANGUAGE_TO_COUNTRY = {
    'en-US': 'US', 'it-IT': 'IT', 'es-MX': 'MX', 'es-ES': 'ES',
    'pt-BR': 'BR', 'pt-PT': 'PT', 'de-DE': 'DE', 'fr-FR': 'FR',
    'ru-RU': 'RU', 'ja-JP': 'JP', 'hi-IN': 'IN', 'ta-IN': 'IN',
    'tr-TR': 'TR'
};

/**
 * Provider ID to display name for YouTube search
 */
const PROVIDER_NAMES = {
    8: 'Netflix', 119: 'Prime Video', 9: 'Prime Video',
    337: 'Disney Plus', 384: 'HBO Max', 1899: 'Max',
    15: 'Hulu', 350: 'Apple TV', 531: 'Paramount Plus',
    283: 'Crunchyroll', 2: 'Apple TV', 3: 'Google Play',
    10: 'Amazon Video'
};

// ==========================================
// SHARED UTILS (SCRAPER)
// ==========================================

/**
 * Search YouTube using HTML scraping (Robust Version)
 * Used by both Recaps and Trailers
 * @param {string} query - Search query
 * @param {string} language - Language code (e.g. 'it-IT')
 */
async function searchYouTubeScraping(query, language = 'en-US') {
    try {
        const encodedQuery = encodeURIComponent(query);
        // Extract country and lang from language code (e.g. 'it-IT' -> gl=IT, hl=it)
        const [lang, country] = language.split('-');
        const gl = country || 'US';
        const hl = lang || 'en';
        const url = `https://www.youtube.com/results?search_query=${encodedQuery}&gl=${gl}&hl=${hl}`;

        console.log(`[YouTube Scraper] Search: ${query} (gl=${gl}, hl=${hl})`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': `${hl}-${gl},${hl};q=0.9,en;q=0.8`,
                'Cookie': `PREF=hl=${hl}&gl=${gl}; CONSENT=YES+`
            }
        });

        if (response.status !== 200) {
            console.log('[YouTube Scraper] Failed:', response.status);
            return null;
        }

        const html = await response.text();

        // Extract video ID
        const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (!videoIdMatch) {
            console.log('[YouTube Scraper] No video ID found');
            return null;
        }

        const ytId = videoIdMatch[1];

        // Try to extract title
        let videoTitle = '';
        const titleMatch = html.match(/"title":\s*{\s*"runs":\s*\[\s*{\s*"text":\s*"([^"]+)"/);
        if (titleMatch) {
            videoTitle = titleMatch[1];
        } else {
            const simpleTitleMatch = html.match(/"title":\s*"([^"]+)"/);
            if (simpleTitleMatch) {
                videoTitle = simpleTitleMatch[1];
            }
        }

        if (!videoTitle) {
            // Fallback if title scrape fails but ID was found
            videoTitle = query;
        } else {
            // Decode HTML entities
            videoTitle = videoTitle
                .replace(/\\u0026/g, '&')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
        }

        console.log(`[YouTube Scraper] Found: "${videoTitle}" (${ytId})`);
        return { ytId, title: videoTitle };

    } catch (e) {
        console.error('[YouTube Scraper] Error:', e);
        return null;
    }
}

// ==========================================
// TMDB API HELPERS
// ==========================================

async function getWatchProviders(tmdbId, language = 'it-IT') {
    if (!TMDB_KEY) return null;
    const country = LANGUAGE_TO_COUNTRY[language] || 'US';

    try {
        const url = `${TMDB_BASE}/tv/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results[country]) {
            const countryData = data.results[country];
            if (countryData.flatrate && countryData.flatrate.length > 0) {
                const provider = countryData.flatrate[0];
                const providerName = PROVIDER_NAMES[provider.provider_id] || provider.provider_name;
                return providerName;
            }
        }

        // Fallback to US
        if (country !== 'US' && data.results && data.results['US']) {
            const usData = data.results['US'];
            if (usData.flatrate && usData.flatrate.length > 0) {
                const provider = usData.flatrate[0];
                const providerName = PROVIDER_NAMES[provider.provider_id] || provider.provider_name;
                return providerName;
            }
        }
        return null;
    } catch (e) {
        console.error('[TMDB] Error fetching watch providers:', e);
        return null;
    }
}

async function imdbToTmdbWithLanguage(imdbId, type, language) {
    if (!TMDB_KEY) return null;
    try {
        const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=${language}`;
        const response = await fetch(url);
        const data = await response.json();
        const results = type === 'series' ? data.tv_results : data.movie_results;
        if (results && results.length > 0) {
            const item = results[0];
            return { id: item.id, title: item.title || item.name || '' };
        }
    } catch (e) { return null; }
    return null;
}

async function fetchTMDBVideos(tmdbId, type, language, season) {
    if (!TMDB_KEY) return [];
    try {
        let url;
        if (type === 'series' && season > 0) {
            url = `${TMDB_BASE}/tv/${tmdbId}/season/${season}/videos?api_key=${TMDB_KEY}&language=${language}`;
        } else {
            const mediaType = type === 'series' ? 'tv' : 'movie';
            url = `${TMDB_BASE}/${mediaType}/${tmdbId}/videos?api_key=${TMDB_KEY}&language=${language}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        return data.results || [];
    } catch (e) { return []; }
}

// ==========================================
// RECAP LOGIC
// ==========================================

function getRecapTranslation(language) {
    return RECAP_TRANSLATIONS[language] || RECAP_TRANSLATIONS['en-US'];
}

async function searchRecapVideo(seriesName, season, provider, language = 'it-IT') {
    const recapT = getRecapTranslation(language);
    const isEnglish = language.startsWith('en');
    const langKeyword = recapT.langKeyword ? ` ${recapT.langKeyword}` : '';

    // Step 1: Localized with provider + language keyword
    if (provider) {
        const query1 = `${seriesName} ${recapT.recap} ${recapT.season} ${season} ${provider}${langKeyword}`;
        const result1 = await searchYouTubeScraping(query1, language);
        if (result1) return result1;
    }

    // Step 2: Localized without provider + language keyword
    const query2 = `${seriesName} ${recapT.recap} ${recapT.season} ${season}${langKeyword}`;
    const result2 = await searchYouTubeScraping(query2, language);
    if (result2) return result2;

    // Skip English fallback if already English
    if (isEnglish) return null;

    // Step 3: English with provider
    if (provider) {
        const query3 = `${seriesName} recap Season ${season} ${provider}`;
        const result3 = await searchYouTubeScraping(query3, 'en-US');
        if (result3) return result3;
    }

    // Step 4: English without provider
    const query4 = `${seriesName} recap Season ${season}`;
    const result4 = await searchYouTubeScraping(query4, 'en-US');
    if (result4) return result4;

    return null;
}

async function getRecapStreams(tmdbId, seriesName, currentSeason, language = 'it-IT', useExternalLink = false, imdbId = null) {
    // Only for season >= 2
    if (currentSeason < 2) return [];

    console.log(`[RecapProvider] Searching recaps for "${seriesName}" (season ${currentSeason})`);
    const streams = [];
    const recapT = getRecapTranslation(language);

    // Get watch provider
    let provider = tmdbId ? await getWatchProviders(tmdbId, language) : null;

    // Get recap for previous season first (most important)
    const previousSeason = currentSeason - 1;
    const prevRecap = await searchRecapVideo(seriesName, previousSeason, provider, language);
    
    if (prevRecap) {
        const recapStream = createRecapStreamObject(prevRecap, previousSeason, recapT, useExternalLink);
        streams.push(recapStream);
    }

    // Get recaps for seasons (currentSeason - 2) down to 1
    for (let s = previousSeason - 1; s >= 1; s--) {
        const recap = await searchRecapVideo(seriesName, s, provider, language);
        if (recap) {
            const recapStream = createRecapStreamObject(recap, s, recapT, useExternalLink);
            streams.push(recapStream);
        }
    }

    return streams;
}

function createRecapStreamObject(videoData, seasonNum, translations, useExternalLink) {
    const recapStreamName = useExternalLink
        ? `🔗 📝 Recap ${translations.season} ${seasonNum}`
        : `📝 Recap ${translations.season} ${seasonNum}`;

    const stream = {
        name: recapStreamName,
        title: videoData.title,
        behaviorHints: { notWebReady: true, bingeGroup: 'recap' }
    };

    if (useExternalLink) {
        stream.externalUrl = `https://www.youtube.com/watch?v=${videoData.ytId}`;
    } else {
        stream.ytId = videoData.ytId;
    }
    return stream;
}

async function searchGenericRecap(seriesName, language = 'it-IT', useExternalLink = false) {
    console.log(`[RecapProvider] Searching generic recap for "${seriesName}"`);
    const recapT = getRecapTranslation(language);
    const langKeyword = recapT.langKeyword ? ` ${recapT.langKeyword}` : '';

    const query = `${seriesName} ${recapT.recap}${langKeyword}`;
    const result = await searchYouTubeScraping(query, language);

    if (!result) return null;

    const recapStreamName = useExternalLink ? `🔗 ⚠️ Recap (Spoiler Alert!)` : `⚠️ Recap (Spoiler Alert!)`;
    const stream = {
        name: recapStreamName,
        title: result.title,
        behaviorHints: { notWebReady: true, bingeGroup: 'recap' }
    };

    if (useExternalLink) {
        stream.externalUrl = `https://www.youtube.com/watch?v=${result.ytId}`;
    } else {
        stream.ytId = result.ytId;
    }

    return stream;
}

// ==========================================
// TRAILER LOGIC
// ==========================================

function getTrailerTranslation(language) {
    return TRAILER_TRANSLATIONS[language] || TRAILER_TRANSLATIONS['en-US'];
}

function selectBestTrailer(videos) {
    if (!videos || videos.length === 0) return null;
    const youtubeVideos = videos.filter(v => v.site === 'YouTube');
    if (youtubeVideos.length === 0) return null;
    
    // Priority: Official Trailer > Generic Trailer > Teaser
    const official = youtubeVideos.find(v => v.type === 'Trailer' && v.official);
    if (official) return official;
    
    const anyTrailer = youtubeVideos.find(v => v.type === 'Trailer');
    if (anyTrailer) return anyTrailer;

    return youtubeVideos[0];
}

async function getTrailerStreams(type, imdbId, contentName, season, tmdbId, language = 'it-IT') {
    if (!TMDB_KEY) return [];

    try {
        let tmdbIdNum = tmdbId;
        let finalTitle = contentName;

        if (!tmdbIdNum && imdbId) {
            const mapped = await imdbToTmdbWithLanguage(imdbId, type, language);
            if (mapped) {
                tmdbIdNum = mapped.id;
                finalTitle = mapped.title;
            }
        }
        
        if (!tmdbIdNum) return [];

        let trailerResult = null;
        let videos = await fetchTMDBVideos(tmdbIdNum, type, language, season);
        let best = selectBestTrailer(videos);
        
        if (!best) {
            // Fallback to English TMDB videos
            videos = await fetchTMDBVideos(tmdbIdNum, type, 'en-US', season);
            best = selectBestTrailer(videos);
        }

        if (best) {
            trailerResult = { ytId: best.key, title: best.name };
        } else {
            // Fallback to YouTube Scraping
            const t = getTrailerTranslation(language);
            const query = `${finalTitle} ${type === 'series' ? `${t.season} ${season}` : ''} ${t.trailer}`;
            // Uses the robust shared scraper now
            const scraped = await searchYouTubeScraping(query, language);
            if (scraped) trailerResult = scraped;
        }

        if (!trailerResult) return [];

        return [{
            name: "🎬 Trailer",
            title: trailerResult.title,
            externalUrl: `https://www.youtube.com/watch?v=${trailerResult.ytId}`,
            behaviorHints: {
                bingeGroup: "trailer"
            }
        }];

    } catch (e) {
        console.error('[TrailerProvider] Error:', e.message);
        return [];
    }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Recap Exports
    getRecapStreams,
    searchGenericRecap,
    getWatchProviders,
    getRecapTranslation,
    // Trailer Exports
    getTrailerStreams
};
