function cleanFileNameForDisplay(filename) {
    let name = filename;
    // Rimuove tag tra parentesi quadre all'inizio/fine tipici dei release group
    name = name.replace(/\[[^\]]+\]/g, '').trim();
    name = name.replace(/\s{2,}/g, ' ');

    // Pulisce parentesi tonde lasciando solo info tecniche essenziali
    name = name.replace(/\(([^)]*?(BluRay|WEB|HDR|HEVC|x265|10bit|AAC)[^)]*?)\)/gi, '($1)');
    // Se non ha estensione, aggiunge .mkv per coerenza visiva
    if (!/\.\w{2,4}$/.test(name)) {
        name += '.mkv';
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
        'web': '[WEB' 
    };
    const srv = serviceAbbr[service?.toLowerCase()] || '[P2P';
    const bolt = cached ? '⚡]' : ']';
    
    // Esempio output: "[WEB⚡] Leviathan 1080p"
    return `${srv}${bolt} ${addonName} ${quality || ''}${hasError ? ' ⚠️' : ''}`;
}

/**
 * Formatta il titolo dello stream su 4 righe (Stile Ricco)
 */
function formatStreamTitle({ 
    title,       
    size,        
    language,    
    source,      
    seeders,     
    episodeTitle, 
    infoHash,
    techInfo     // <--- NUOVO: Stringa con icone (es. 🎞️ WEB-DL 🔊 AAC)
}) {
    // Gestione seeders
    const displaySeeders = seeders !== undefined && seeders !== null ? seeders : '-';
    const displayLang = language || '🌍';

    // --- CLEAN TITLE ---
    const cleanTitle = cleanFileNameForDisplay(title);

    // --- CLEAN PROVIDER ---
    let displaySource = source || 'Unknown Indexer';
    if (/corsaro/i.test(displaySource)) {
        displaySource = 'ilCorSaRoNeRo';
    } else {
        displaySource = displaySource
            .replace(/TorrentGalaxy|tgx/i, 'TGx')
            .replace(/1337/i, '1337x');
    }

    // --- RIGA 1: Info Tecniche (Icone) ---
    // Se techInfo è presente lo usa, altrimenti lascia vuoto
    const rowTech = techInfo ? `${techInfo}` : '';

    // --- RIGA 2: Dimensione, seeders, lingua ---
    const rowInfo = `💾 ${size || 'Unknown'} • 👤 ${displaySeeders} • ${displayLang}`;

    // --- RIGA 3: Nome file pulito ---
    const rowTitle = `📁 ${cleanTitle}`;

    // --- RIGA 4: Provider ---
    const rowSource = `🔎 ${displaySource}`;

    // Unisce le righe rimuovendo quelle vuote
    return [rowTech, rowInfo, rowTitle, rowSource].filter(Boolean).join('\n');
}

/**
 * Controlla se AIOStreams è abilitato nella configurazione
 */
function isAIOStreamsEnabled(config) {
    return config?.aiostreams_mode === true;
}

module.exports = {
    formatStreamName,
    formatStreamTitle,
    isAIOStreamsEnabled,
    cleanFileNameForDisplay
};
