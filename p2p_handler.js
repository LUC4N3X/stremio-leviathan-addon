const { formatStreamSelector, formatBytes } = require("./formatter");
const ptt = require('parse-torrent-title');

// --- LISTA TRACKER NUCLEARE ---
const BEST_TRACKERS = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://tracker.moeking.me:6969/announce",
    "udp://opentracker.i2p.rocks:6969/announce",
    "udp://tracker.auctor.tv:6969/announce",
    "udp://9.rarbg.me:2970/announce",
    "udp://tracker.leechers-paradise.org:6969/announce",
    "udp://tracker.coppersurfer.tk:6969/announce",
    "udp://exodus.desync.com:6969/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.internetwarriors.net:1337/announce",
    "udp://tracker.cyberia.is:6969/announce",
    "udp://tracker.openbittorrent.com:80/announce",
    "http://tracker.opentrackr.org:1337/announce",
    "http://tracker.openbittorrent.com:80/announce"
];

const TRACKER_STRING = BEST_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");

const languageMapping = {
  'english': '🇬🇧 ENG', 'japanese': '🇯🇵 JPN', 'italian': '🇮🇹 ITA',
  'french': '🇫🇷 FRA', 'german': '🇩🇪 GER', 'spanish': '🇪🇸 ESP',
  'russian': '🇷🇺 RUS', 'multi audio': '🌍 MULTI'
};

function parseDetails(title) {
    try {
        const info = ptt.parse(title);
        const codec = info.codec ? info.codec.toUpperCase() : '';
        const audio = info.audio ? info.audio.toUpperCase() : '';
        const source = info.source ? info.source.toUpperCase() : '';
        let languages = [];
        if (info.languages && Array.isArray(info.languages)) {
            languages = info.languages.map(l => languageMapping[l] || l.substring(0,3).toUpperCase());
        }
        return {
            quality: info.resolution || 'SD',
            tags: [source, codec, audio].filter(x => x).join(' '),
            languages: languages
        };
    } catch (e) {
        return { quality: 'SD', tags: '', languages: [] };
    }
}

function constructRobustMagnet(item) {
    let hash = item.hash || item.infoHash;
    
    if (!hash && item.magnet) {
        const match = item.magnet.match(/btih:([A-Fa-f0-9]{40}|[A-Za-z2-7]{32})/i);
        if (match) hash = match[1];
    }
    
    if (!hash) return { magnet: null, hash: null };

    const cleanTitle = encodeURIComponent(item.title.replace(/[^a-zA-Z0-9\.\-_ ]/g, '').trim());
    const finalMagnet = `magnet:?xt=urn:btih:${hash}&dn=${cleanTitle}${TRACKER_STRING}`;
    
    return { magnet: finalMagnet, hash: hash.toLowerCase() };
}

module.exports = {
    // Aggiunto parametro 'config' per supportare le Skin
    formatP2PStream: (item, config) => {
        
        // 1. Costruzione Magnet e Hash
        const { magnet, hash } = constructRobustMagnet(item);

        if (!magnet) return null;

        // 2. Integrazione con il Formatter (SKIN SYSTEM)
        // Questo fa sì che il P2P appaia graficamente identico a RD/TB
        const { name, title, bingeGroup } = formatStreamSelector(
            item.title,             // Nome file
            item.source || "P2P",   // Provider
            item._size || item.sizeBytes || 0, // Dimensione
            item.seeders || 0,      // Seeders
            "P2P",                  // Service Tag (per icona fulmine/P2P)
            config,                 // Configurazione utente (Skin scelta)
            hash,                   // Hash per ID univoci
            false,                  // isLazy (P2P è diretto, non lazy http)
            item._isPack || false   // isPack
        );

        const streamObj = {
            name: name,   // Nome formattato dalla Skin
            title: title, // Titolo formattato dalla Skin
            infoHash: hash, 
            sources: [magnet], 
            url: magnet,
            behaviorHints: {
                bingieGroup: bingeGroup, // Gruppo formattato dalla Skin
                notWebReady: false 
            }
        };

        // 3. Logica intelligente per fileIdx (Fix caricamento infinito)
        if (item.fileIdx !== undefined && item.fileIdx !== null && !isNaN(parseInt(item.fileIdx))) {
            const idx = parseInt(item.fileIdx);
            // Se l'indice è maggiore di 0 (es. episodi serie o pack) lo manteniamo.
            // Se è 0, lo rimuoviamo per lasciare che Stremio scelga il file video principale.
            if (idx > 0) {
                streamObj.fileIdx = idx;
            }
        }

        return streamObj;
    }
};
