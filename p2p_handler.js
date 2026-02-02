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

    // Costruiamo un magnet pulito
    const cleanTitle = encodeURIComponent(item.title.replace(/[^a-zA-Z0-9\.\-_ ]/g, '').trim());
    const finalMagnet = `magnet:?xt=urn:btih:${hash}&dn=${cleanTitle}${TRACKER_STRING}`;
    
    return { magnet: finalMagnet, hash: hash.toLowerCase() };
}

module.exports = {
    formatP2PStream: (item, config) => {
        
        // 1. Costruzione Magnet e Hash
        const { magnet, hash } = constructRobustMagnet(item);

        if (!magnet) return null;

        // 2. Formattazione Grafica (Skin)
        const { name, title, bingeGroup } = formatStreamSelector(
            item.title,             
            item.source || "P2P",   
            item._size || item.sizeBytes || 0, 
            item.seeders || 0,      
            "P2P",                  
            config,                 
            hash,                   
            false,                  
            item._isPack || false   
        );

        // 3. COSTRUZIONE OGGETTO STREAM
        const streamObj = {
            name: name,   
            title: title, 
            infoHash: hash, 
            sources: [
                magnet,              
                `dht:${hash}`        
            ],
            
            behaviorHints: {
                bingieGroup: bingeGroup, 
                notWebReady: false
            }
        };

        
        
        
        if (item.fileIdx !== undefined && item.fileIdx !== null && !isNaN(parseInt(item.fileIdx))) {
            streamObj.fileIdx = parseInt(item.fileIdx);
        }

        return streamObj;
    }
};
