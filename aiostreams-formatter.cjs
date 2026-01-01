function formatStreamName({ 
    addonName, 
    service, 
    provider, 
    cached, 
    quality, 
    size, 
    source, 
    title, 
    hasError = false 
}) {
    // 1. Abbreviazioni dei servizi
    const serviceAbbr = {
        'realdebrid': 'RD',
        'torbox': 'TB',
        'alldebrid': 'AD',
        'p2p': 'P2P'
    };
    const abbr = serviceAbbr[service?.toLowerCase()] || 'P2P';

    // 2. Icone e stati
    const cacheSymbol = cached ? '⚡' : '⏳';
    const errorIndicator = hasError ? ' ⚠️' : '';

    // 3. Pulizia dati
    const cleanQuality = quality ? quality.replace("1080p", "FHD").replace("2160p", "4K") : "SD";
    const cleanSize = size ? `• ${size}` : "• ?";
    const cleanSource = source ? `• ${source}` : "";
    const cleanProvider = provider ? `• ${provider}` : "";

    // 4. Generatore tag unico per evitare raggruppamenti
    const uniqueTag = title ? title.slice(0,3).toUpperCase() : Math.random().toString(36).slice(2,5);

    // 5. Composizione nome finale
    return `${abbr}${cacheSymbol} ${cleanQuality} ${cleanSize} ${cleanSource} ${cleanProvider} • ${uniqueTag}${errorIndicator}`.replace(/\s+/g,' ').trim();
}

/**
 * Titolo descrittivo compatto per seconda riga in Stremio
 */
function formatStreamTitle({ 
    title, 
    size, 
    language, 
    source, 
    seeders, 
    isPack = false, 
    episodeTitle 
}) {
    const lines = [];

    // Linea principale
    if (isPack && episodeTitle) {
        lines.push(`📂 ${episodeTitle}`);
    } else {
        lines.push(`📄 ${title}`);
    }

    // Lingua
    if (language) lines.push(`🗣️ ${language}`);

    // Seeders se P2P
    if (seeders !== undefined && seeders !== null) lines.push(`👥 ${seeders}`);

    // Fonte/Dimensioni opzionali
    if (source) lines.push(`• ${source}`);
    if (size) lines.push(`• ${size}`);

    return lines.join(' ');
}

/**
 * Controllo se AIOStreams è abilitato
 */
function isAIOStreamsEnabled(config) {
    return config?.aiostreams_mode === true;
}

module.exports = {
    formatStreamName,
    formatStreamTitle,
    isAIOStreamsEnabled
};
