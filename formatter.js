const UNITS = ["B", "KB", "MB", "GB", "TB"];

// --- 1. REGEX & COSTANTI ---
const REGEX_YEAR = /(19|20)\d{2}/;
const REGEX_QUALITY = {
    "4K": /\b(?:2160p|4k|uhd|ultra[-.\s]?hd|2160i)\b/i,
    "1440p": /\b(?:1440p|qhd|2k)\b/i,
    "1080p": /\b(?:1080p|1080i|fhd|full[-.\s]?hd|blu[-.\s]?ray|bd[-.\s]?rip)\b/i,
    "720p": /\b(?:720p|720i|hd[-.\s]?rip|hd)\b/i,
    "480p": /\b(?:480p|sd|dvd|dvd[-.\s]?rip)\b/i,
    "SD": /\b(?:576p|360p|240p|sd|scr|cam)\b/i
};
const REGEX_AUDIO = {
    channels: /\b(7\.1|5\.1|2\.1|2\.0)\b/,
    atmos: /atmos/i,
    dtsx: /dts[:\s-]?x/i,
    truehd: /truehd/i,
    dtshd: /\bdts-?hd\b|\bma\b/i,
    dts: /\bdts\b/i,
    ddp: /\bddp\b|\beac-?3\b|\bdolby\s?digital\s?plus\b/i,
    dolby: /\bac-?3\b|\bdd\b|\bdolby\b/i,
    aac: /\baac\b/i,
    flac: /\bflac\b/i
};
const REGEX_CLEANER = /\b(ita|eng|ger|fre|spa|latino|rus|sub|h264|h265|x264|x265|hevc|avc|vc1|1080p|1080i|720p|480p|4k|2160p|uhd|sdr|hdr|hdr10|dv|dolby|vision|bluray|bd|bdrip|brrip|web-?dl|webrip|hdtv|remux|mux|ac-?3|aac|dts|ddp|flac|truehd|atmos|multi|dual|complete|pack|amzn|nf|dsnp|hmax|atvp|apple|hulu|peacock|rakuten|iyp|dvd|dvdrip|unrated|extended|director|cut|rip)\b.*/yi;

// --- 2. FUNZIONI HELPER ---

function formatBytes(bytes) {
  if (!+bytes) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${UNITS[i]}`;
}

function cleanFilename(filename) {
  if (!filename) return "";
  const yearMatch = filename.match(REGEX_YEAR);
  let cleanTitle = filename;
  let year = "";
  if (yearMatch) {
    year = ` (${yearMatch[0]})`;
    cleanTitle = filename.substring(0, yearMatch.index);
  }
  cleanTitle = cleanTitle.replace(/[._]/g, " ");
  cleanTitle = cleanTitle.replace(REGEX_CLEANER, "");
  cleanTitle = cleanTitle.replace(/[\(\[\-\s]+$/, ""); 
  return `${cleanTitle.trim()}${year}`;
}

function getEpisodeTag(filename) {
    const f = filename.toLowerCase();
    const matchEp = f.match(/s(\d+)[ex](\d+)/i);
    if (matchEp) return `🍿 S${matchEp[1]}E${matchEp[2]}`;
    const matchX = f.match(/(\d+)x(\d+)/i);
    if (matchX) return `🍿 S${matchX[1].padStart(2, '0')}E${matchX[2].padStart(2, '0')}`;
    const sMatch = f.match(/s(\d+)\b|stagione (\d+)|season (\d+)/i);
    if (sMatch) {
        const num = sMatch[1] || sMatch[2] || sMatch[3];
        return `📦 STAGIONE ${num}`;
    }
    return "";
}

// --- GENERATORE FONT ---
function toStylized(text, type = 'std') {
    const maps = {
        'bold': {
            nums: {'0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'},
            chars: {'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝','K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧','U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭','a':'𝗮','b':'𝗯','c':'𝗰','d':'𝗱','e':'𝗲','f':'𝗳','g':'𝗴','h':'𝗵','i':'𝗶','j':'𝗷','k':'𝗸','l':'𝗹','m':'𝗺','n':'𝗻','o':'𝗼','p':'𝗽','q':'𝗾','r':'𝗿','s':'𝘀','t':'𝘁','u':'𝘂','v':'𝘃','w':'𝘄','x':'𝘅','y':'𝘆','z':'𝘇'}
        },
        'small': {
            nums: {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'},
            chars: {'A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ꜰ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'ꜱ','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ','a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'}
        }
    };

    if (type === 'spaced') {
        return text.split('').map(c => {
            const map = maps['bold'];
            const char = (/[0-9]/.test(c) ? map.nums[c] : map.chars[c]) || c;
            return char + ' ';
        }).join('').trim();
    }

    const map = maps[type] || maps['bold'];
    return text.split('').map(c => {
        if (/[0-9]/.test(c)) return map.nums[c] || c;
        return map.chars[c] || c;
    }).join('');
}

function extractAudioInfo(title) {
    const t = String(title).toLowerCase();
    const channelMatch = t.match(REGEX_AUDIO.channels);
    let channels = channelMatch?.[1] || "";
    if (channels === "2.0") channels = "";

    const AUDIO_PRIORITY = [
        { test: REGEX_AUDIO.atmos,  tag: "💥💣 Atmos" },
        { test: REGEX_AUDIO.dtsx,   tag: "💥💣 DTS:X" },
        { test: REGEX_AUDIO.truehd, tag: "🔊⚡ TrueHD" },
        { test: REGEX_AUDIO.dtshd,  tag: "🔊⚡ DTS-HD" },
        { test: REGEX_AUDIO.ddp,    tag: "🔊🔥 Dolby+" },
        { test: REGEX_AUDIO.dts,    tag: "🔊🔥 DTS" },
        { test: REGEX_AUDIO.flac,   tag: "🎼🌊 FLAC" },
        { test: REGEX_AUDIO.dolby,  tag: "🔈🌑 Dolby" },
        { test: REGEX_AUDIO.aac,    tag: "🔈✨ AAC" },
        { test: /\bmp3\b/i,         tag: "🔈🎶 MP3" }
    ];

    let audioTag = AUDIO_PRIORITY.find(c => c.test.test(t))?.tag || "🔈⚡ Stereo";
    if (audioTag === "🔈⚡ Stereo" && (channels === "5.1" || channels === "7.1")) {
        audioTag = "🔊🌌 Surround";
    }
    
    return { tag: audioTag, channels: channels };
}

function extractStreamInfo(title, source) {
  const t = String(title).toLowerCase();
  
  // 1. Qualità e Icona
  let q = "HD"; let qIcon = "📺";
  let qDetails = "SD"; 

  if (REGEX_QUALITY["4K"].test(t)) { q = "4K"; qDetails = "4K"; qIcon = "🔥"; }
  else if (REGEX_QUALITY["1440p"].test(t)) { q = "1440p"; qDetails = "QHD"; qIcon = "🖥️"; }
  else if (REGEX_QUALITY["1080p"].test(t)) { q = "1080p"; qDetails = "FHD"; qIcon = "👑"; }
  else if (REGEX_QUALITY["720p"].test(t)) { q = "720p"; qDetails = "HD"; qIcon = "⚡"; }
  else if (REGEX_QUALITY["480p"].test(t)) { q = "480p"; qDetails = "Low Quality"; qIcon = "📼"; }
  else if (REGEX_QUALITY["SD"].test(t)) { q = "SD"; qDetails = "Low Quality"; qIcon = "📼"; }
  else { q = "SD"; qDetails = "Low Quality"; qIcon = "📼"; }
  
  // 2. Tag Video: "videoTags" (Stylized) e "cleanTags" (Normal Text)
  const videoTags = [];
  const cleanTags = []; // Per i formatter senza maiuscolo forzato
  
  const isRemux = /remux/i.test(t);
  const isBluRay = /\bbd\b|\bbluray\b|\bbdrip\b|\bbrrip\b/i.test(t) && !isRemux;
  const isWeb = /\bweb-?dl\b|\bwebrip\b|\bweb\b|\bhdtv\b|\bppv\b|\bnf\b|\bamzn\b|\bdsnp\b|\bhmax\b|\bhulu\b|\bmax\b/i.test(t);
  
  if (isRemux) {
      videoTags.push(`💎 ${toStylized("REMUX")}`);
      cleanTags.push("Remux");
  }
  else if (isBluRay) {
      videoTags.push(`💿 ${toStylized("BluRay")}`);
      cleanTags.push("BluRay");
  }
  else if (isWeb) {
      videoTags.push(`☁️ ${toStylized("WEB")}`);
      cleanTags.push("WEB-DL");
  }
  
  if (/hdr/.test(t)) {
      videoTags.push(`🔥 ${toStylized("HDR")}`);
      cleanTags.push("HDR");
  }
  if (/dolby|vision|\bdv\b/.test(t)) {
      videoTags.push(`👁️ ${toStylized("DV")}`);
      cleanTags.push("DV");
  }
  if (/imax/.test(t)) {
      videoTags.push(`🏟️ ${toStylized("IMAX")}`);
      cleanTags.push("IMAX");
  }
  
  let codec = "";
  let hasCodec = false;
  if (/x265|h\.?265|hevc/i.test(t)) {
      videoTags.push(`⚙️ ${toStylized("HEVC")}`);
      cleanTags.push("HEVC");
      codec = "HEVC";
      hasCodec = true;
  } 
  else if (/x264|h\.?264|avc|mpeg-?4/i.test(t)) {
      videoTags.push(`📼 ${toStylized("AVC")}`);
      cleanTags.push("AVC");
      codec = "AVC";
      hasCodec = true;
  }

  // 3. Lingua
  let lang = "🇬🇧 ENG";
  if (/corsaro/i.test(source) || isSafeForItalian({ title })) {
      lang = "🇮🇹 ITA";
      if (/multi|mui/i.test(t)) lang = "🇮🇹 MULTI";
  }
  
  const audioObj = extractAudioInfo(title);
  
  return { 
      quality: q, 
      qDetails: qDetails,
      qIcon: qIcon, 
      videoTags, // STYLIZED (Per Lev/Arch)
      cleanTags, // PLAIN TEXT (Per gli altri)
      lang, 
      codec,
      audioTag: audioObj.tag,
      audioChannels: audioObj.channels
  };
}

function isSafeForItalian(item) {
    return /\b(ita|italian)\b/i.test(item.title);
}

// =========================================================================
// 🌟 PRESET STILI
// =========================================================================

// 1. LEVIATHAN (CLASSIC) - Replica Esatta Screenshot Dune
function styleLeviathan(p) {
    const qualityBold = toStylized(p.quality, 'bold');
    const name = `🦑 𝗟𝗘𝗩𝗜𝗔𝗧𝗛𝗔𝗡\n${p.qIcon} ┃ ${qualityBold}`;
    
    const lines = [];
    
    // RIGA 1: Cartella + Titolo
    lines.push(`📁 ${p.cleanName} ${p.epTag}`);
    
    // RIGA 2: Lingua + Audio
    lines.push(`🗣️ ${p.lang} • ${p.audioInfo}`);
    
    // RIGA 3: Tag Video (Stylized)
    if (p.videoTags.length > 0) {
        lines.push(p.videoTags.join(" • "));
    } else {
        lines.push(`🎞️ ${p.codec || "Video"}`);
    }
    
    // RIGA 4: Size + Seeds
    lines.push(`🧲 ${p.sizeString} • 👥 ${p.seeders}`);
    
    // RIGA 5: Source
    lines.push(p.sourceLine);

    return { name, title: lines.join("\n") };
}

// 2. LEVIATHAN 2.0 (ARCHITECT) - Mantiene lo stile Small Caps
function styleLeviathanTwo(p) {
    const levText = toStylized("LEVIATHAN", "small");
    const qText = p.quality; 
    const name = `🦑 ${levText} ${p.serviceIconTitle} │ ${qText}`;
    
    const lines = [];
    lines.push(`🎬 ${toStylized(p.cleanName, "bold")}`);
    // Usa videoTags (stylized)
    lines.push(`📦 ${p.sizeString} │ ${p.codec} ${p.videoTags.filter(x=>!x.includes(p.codec)).join(" ")}`);
    lines.push(`🔊 ${p.audioTag} ${p.audioChannels} • ${p.lang}`);
    lines.push(`🔗 ${p.sourceLine}`);

    return { name, title: lines.join("\n") };
}

// 3. FRA STYLE - Usa cleanTags (No Maiuscolo Forzato)
function styleFra(p) {
    let qShort = p.quality === "1080p" ? "FHD" : (p.quality === "4K" ? "4K" : "HD");
    const name = `⚡️ Leviathan ${qShort}`;
    // Usa cleanTags
    const tagString = p.cleanTags.join(' • ');
    const lines = [`📄 ❯ ${p.fileTitle}`, `🌎 ❯ ${p.lang} • ${p.audioTag}`, `✨ ❯ ${p.serviceTag} • ${p.displaySource}`, `🔥 ❯ ${p.quality} • ${tagString}`, `💾 ❯ ${p.sizeString} / 👥 ❯ ${p.seeders}`];
    return { name, title: lines.join("\n") };
}

// 4. DAV STYLE - Usa cleanTags
function styleDav(p) {
    let header = p.quality === "4K" ? "🎥 4K UHD" : (p.quality === "1080p" ? "📀 FHD" : "💿 HD");
    const name = `${header} ${p.codec}`;
    const lines = [];
    lines.push(`📺 ${p.cleanName} ${p.epTag}`);
    lines.push(`🎧 ${p.audioTag} ${p.audioChannels} | 🎞️ ${p.codec}`);
    lines.push(`🗣️ ${p.lang} | 📦 ${p.sizeString}`);
    lines.push(`⏱️ ${p.seeders} Seeds | 🏷️ ${p.displaySource}`);
    lines.push(`${p.serviceIconTitle} Leviathan 📡 ${p.serviceTag}`);
    lines.push(`📂 ${p.fileTitle}`);
    return { name, title: lines.join("\n") };
}

// 5. AND STYLE - Usa cleanTags
function styleAnd(p) {
    const name = `🎬 ${p.cleanName} ${p.epTag}`;
    const lines = [];
    const cachedIcon = p.serviceTag === "RD" ? "⚡" : "⏳";
    lines.push(`${p.quality} ${cachedIcon}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    lines.push(`Lingue: ${p.lang}`);
    // cleanTags
    lines.push(`Specifiche: ${p.quality} | 📺 ${p.cleanTags.join(' ')} | 🔊 ${p.audioTag}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    lines.push(`📂 ${p.sizeString} | ☁️ ${p.serviceTag} | 🛰️ Leviathan`);
    return { name, title: lines.join("\n") };
}

// 6. LAD STYLE - Usa cleanTags
function styleLad(p) {
    const name = `🖥️ ${p.quality} ${p.serviceTag}`;
    const lines = [];
    lines.push(`🎟️ ${p.cleanName}`);
    lines.push(`📜 ${p.epTag || "Movie"}`);
    lines.push(`🎥 ${p.quality} 🎞️ ${p.codec} 🎧 ${p.audioTag}`);
    lines.push(`📦 ${p.sizeString} • 🔗 Leviathan`);
    lines.push(`🌐 ${p.lang}`);
    return { name, title: lines.join("\n") };
}

// 7. PRI STYLE - Usa cleanTags
function stylePri(p) {
    let resIcon = p.quality === "4K" ? "4K🔥UHD" : (p.quality === "1080p" ? "FHD🚀1080p" : "HD💿720p");
    const name = `[${p.serviceTag}]⚡️☁️\n${resIcon}\n[Leviathan]`;
    const lines = [];
    //cleanName normale
    lines.push(`🎬 ${p.cleanName} ${p.epTag}`);
    // cleanTags
    lines.push(`${p.cleanTags.join(" ")}`);
    lines.push(`🎧 ${p.audioTag} | 🔊 ${p.audioChannels} | 🗣️ ${p.lang}`);
    lines.push(`📁 ${p.sizeString} | 🏷️ ${p.displaySource}`);
    lines.push(`📄 ▶️ ${p.fileTitle} ◀️`);
    return { name, title: lines.join("\n") };
}

// 8. COMET STYLE - Usa cleanTags
function styleComet(p) {
    const name = `[${p.serviceTag} ⚡]\nLeviathan\n${p.quality}`;
    const lines = [];
    lines.push(`📄 ${p.fileTitle}`);
    // Usa cleanTags
    const techStack = [p.codec, ...p.cleanTags].filter(Boolean).join(" • ");
    const videoPart = techStack ? techStack : "Video";
    lines.push(`📹 ${videoPart} | ${p.audioTag}`);
    lines.push(`⭐ ${p.displaySource}`);
    const provider = p.seeders != null ? `👥 ${p.seeders}` : "🔎 Leviathan";
    lines.push(`💾 ${p.sizeString} ${provider}`);
    lines.push(`🌍 ${p.lang}`);
    return { name, title: lines.join("\n") };
}

// 9. STREMIO ITA - Usa cleanTags
function styleStremioIta(p) {
    const isCached = ["RD", "TB", "AD"].includes(p.serviceTag);
    const statusIcon = isCached ? "⚡️" : "⏳";
    const name = `${statusIcon} Leviathan ${p.qDetails}`;

    const lines = [];
    lines.push(`📄 ❯ ${p.fileTitle}`);
    lines.push(`🌎 ❯ ${p.lang.replace(/ITA/i, "ita").replace(/ENG/i, "eng").replace(/MULTI/i, "multi")}`);
    let typeIcon = "✨";
    if (!isCached) typeIcon = "⬇️"; 
    lines.push(`${typeIcon} ❯ ${p.serviceTag} • ${p.displaySource}`);

    let qualIcon = "📀";
    // Controlla rawVideoTags per logica, ma stampa cleanTags
    if (p.cleanTags.some(t => /bluray|web|hdr|dv/i.test(t)) || p.quality === "4K") qualIcon = "🔥";
    
    const tagsJoined = p.cleanTags.join(' • ');
    const qualLine = tagsJoined ? `${p.quality} • ${tagsJoined}` : p.quality;
    lines.push(`${qualIcon} ❯ ${qualLine}`);

    let sizeLine = `💾 ❯ ${p.sizeString}`;
    if (!isCached && p.seeders !== null) {
        sizeLine += ` / 👥 ❯ ${p.seeders}`;
    }
    lines.push(sizeLine);

    const audioLine = [p.audioTag, p.audioChannels].filter(Boolean).join(" • ");
    if (audioLine) {
        lines.push(`🔉 ❯ ${audioLine}`);
    }

    return { name, title: lines.join("\n") };
}

// 🛠️ CUSTOM FORMATTER
function styleCustom(p, template) {
    if (!template) return styleLeviathan(p); 
    const vars = {
        "{title}": p.cleanName, "{originalTitle}": p.fileTitle, "{ep}": p.epTag || "",
        "{quality}": p.quality, "{quality_bold}": toStylized(p.quality, 'bold'),
        "{size}": p.sizeString, "{source}": p.displaySource, "{service}": p.serviceTag,
        "{lang}": p.lang, "{audio}": p.audioInfo, "{seeders}": p.seedersStr, "{n}": "\n" 
    };
    let userString = template;
    Object.keys(vars).forEach(key => { userString = userString.replace(new RegExp(key, "g"), vars[key]); });
    userString = userString.replace(/\\n/g, "\n");
    return { name: `Leviathan ${p.quality}`, title: userString };
}

// =========================================================================
// 🚀 DISPATCHER PRINCIPALE
// =========================================================================

function formatStreamSelector(fileTitle, source, size, seeders, serviceTag = "RD", config = {}, infoHash = null, isLazy = false, isPackItem = false) {
    // Estrai info
    let { quality, qDetails, qIcon, videoTags, cleanTags, lang, codec, audioTag, audioChannels } = extractStreamInfo(fileTitle, source);
    
    // --- OVERRIDE ICONA HEADER (Cometa/Scatola/Aquila) ---
    if (serviceTag === "RD") qIcon = "☄️";
    else if (serviceTag === "TB") qIcon = "📦";
    else if (serviceTag === "AD") qIcon = "🦅";
    
    let sizeString = size ? formatBytes(size) : "";
    if (!sizeString || size === 0) {
        let hash = 0;
        for (let i = 0; i < fileTitle.length; i++) hash = fileTitle.charCodeAt(i) + ((hash << 5) - hash);
        const seed = Math.abs(hash);
        let gb = 1; 
        if (quality === "4K") gb = 12 + (seed % 1000) / 100;
        else if (quality === "1080p") gb = 1.8 + (seed % 270) / 100;
        else gb = 0.6 + (seed % 80) / 100;
        sizeString = `${gb.toFixed(2)} GB`;
    }

    const cleanName = cleanFilename(fileTitle).replace(/(s\d{1,2}e\d{1,2}|\d{1,2}x\d{1,2}|s\d{1,2})/ig, "").replace(/\s{2,}/g, " ").trim();
    const epTag = isPackItem ? "📦 SEASON PACK" : getEpisodeTag(fileTitle);

    let displaySource = source || "P2P";
    if (/1337/i.test(displaySource)) displaySource = "1337x"; 
    else if (/corsaro/i.test(displaySource)) displaySource = "ilCorSaRoNeRo";
    else if (/knaben/i.test(displaySource)) displaySource = "Knaben";
    else if (/comet|stremthru/i.test(displaySource)) displaySource = "StremThru";
    else displaySource = displaySource.replace(/MediaFusion|Torrentio|Fallback/gi, '').trim() || "P2P";

    // Icone Servizio per la riga sorgente
    let serviceIconTitle = "⚡"; 
    if (serviceTag === "RD") serviceIconTitle = "☄️";
    else if (serviceTag === "TB") serviceIconTitle = "📦";
    else if (serviceTag === "AD") serviceIconTitle = "🦅";

    const sourceLine = `${serviceIconTitle} [${serviceTag}] ${displaySource}`;
    const sizeStr = `🧲 ${sizeString}`;
    const seedersStr = seeders != null ? `👥 ${seeders}` : "";
    
    let langStr = "🗣️ ❓";
    if (/multi/i.test(lang || "")) langStr = "🗣️ 🌐"; 
    else if (/ita|it\b|italiano/i.test(lang || "")) langStr = "🗣️ 🇮🇹";
    else if (/eng|en\b|english/i.test(lang || "")) langStr = "🗣️ 🇬🇧";
    else if (lang) langStr = `🗣️ ${lang.toUpperCase()}`;

    // CREA STRINGA AUDIO UNICA PER LEVIATHAN
    const audioInfo = [audioTag, audioChannels].filter(Boolean).join(" ┃ ");

    const techClean = cleanTags.join("") + codec;
    const bingeGroup = `Leviathan|${quality}|${techClean}|${serviceTag}`;

    const params = {
        fileTitle, source, displaySource, size, sizeString, sizeStr,
        seeders, seedersStr,
        quality, qDetails, qIcon, 
        serviceTag, serviceIconTitle,
        videoTags, cleanTags, codec,
        lang, langStr, audioInfo, audioTag, audioChannels,
        cleanName, epTag, sourceLine
    };

    let result;
    const style = config.formatter || "leviathan"; 

    switch (style) {
        case "lev2": result = styleLeviathanTwo(params); break;
        case "fra": result = styleFra(params); break;
        case "dav": result = styleDav(params); break;
        case "and": result = styleAnd(params); break;
        case "lad": result = styleLad(params); break;
        case "pri": result = stylePri(params); break;
        case "comet": result = styleComet(params); break;
        case "stremio_ita": result = styleStremioIta(params); break;
        case "custom": result = styleCustom(params, config.customTemplate || ""); break;
        case "leviathan": 
        default: 
            result = styleLeviathan(params); break;
    }

    result.bingeGroup = bingeGroup;
    return result;
}

module.exports = { formatStreamSelector, cleanFilename, formatBytes, extractStreamInfo, getEpisodeTag };
