function cleanFileNameForDisplay(filename) {
    let name = filename;

    // Rimuove tag tra parentesi quadre all'inizio/fine tipici dei release group
    name = name.replace(/\[[^\]]+\]/g, '').trim(); [cite: 1]
    name = name.replace(/\s{2,}/g, ' '); [cite: 2]

    // Pulisce parentesi tonde lasciando solo info tecniche essenziali
    name = name.replace(/\(([^)]*?(BluRay|WEB|HDR|HEVC|x265|10bit|AAC)[^)]*?)\)/gi, '($1)');

    // Se non ha estensione, aggiunge .mkv per coerenza visiva
    if (!/\.\w{2,4}$/.test(name)) {
        name += '.mkv'; [cite: 3]
    }

    return name;
}

/**
 * Formatta il nome del servizio/addon (Il box colorato a sinistra)
 */
function formatStreamName({ 
    addonName, 
    service, 
    cached, 
    quality, 
    hasError = false 
}) {
    // Mappa i codici servizio ai tag visualizzati
    const serviceAbbr = {
        'realdebrid': '[RD',
        'torbox': '[TB',
        'alldebrid': '[AD',
        'p2p': '[P2P',
        'web': '[WEB' // <--- AGGIUNTA FONDAMENTALE PER I SITI STREAMING
    };

    const srv = serviceAbbr[service?.toLowerCase()] || '[P2P'; [cite: 4]
    const bolt = cached ? '⚡]' : ']';
    
    // Costruisce la stringa: Es. "[WEB⚡] Leviathan"
    return `${srv}${bolt} ${addonName}${hasError ? ' ⚠️' : ''}`; [cite: 5]
}

/**
 * Formatta il titolo dello stream su 3 righe
 */
function formatStreamTitle({ 
    title,       
    size,        
    language,    
    source,      
    seeders,     
    episodeTitle, 
    infoHash     
}) {
    // Gestione seeders: se null (come per il web), mette un trattino
    const displaySeeders = seeders !== undefined && seeders !== null ? seeders : '-'; [cite: 6]
    const displayLang = language || '🌍';

    // --- CLEAN TITLE ---
    const cleanTitle = cleanFileNameForDisplay(title);

    // --- CLEAN PROVIDER ---
    let displaySource = source || 'Unknown Indexer'; [cite: 7]

    // Formattazione nomi provider specifici
    if (/corsaro/i.test(displaySource)) {
        displaySource = 'ilCorSaRoNeRo';
    } else {
        displaySource = displaySource
            .replace(/TorrentGalaxy|tgx/i, 'TGx')
            .replace(/1337/i, '1337x'); [cite: 8]
    }

    // --- RIGA 1: Nome file pulito ---
    const row1 = `📁 ${cleanTitle}`; [cite: 9]

    // --- RIGA 2: Dimensione, seeders, lingua ---
    // Se size è "Web" (passato da addon.js), apparirà "💾 Web"
    const row2 = `💾 ${size || 'Unknown'} • 👤 ${displaySeeders} • ${displayLang}`; [cite: 10, 11]

    // --- RIGA 3: Provider dedicato ---
    const row3 = `🔎 ${displaySource}`; [cite: 12]

    return `${row1}\n${row2}\n${row3}`;
}

/**
 * Controlla se AIOStreams è abilitato nella configurazione
 */
function isAIOStreamsEnabled(config) {
    return config?.aiostreams_mode === true; [cite: 13]
}

module.exports = {
    formatStreamName,
    formatStreamTitle,
    isAIOStreamsEnabled,
    cleanFileNameForDisplay
};
