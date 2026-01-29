const titleParser = require('parse-torrent-title'); 

const UNITS = ["B", "KB", "MB", "GB", "TB"];

// --- 1. CONFIGURAZIONE AGGIUNTIVA ---
const REGEX_ITA = {
    audio: /\b(ita|italian|italiano)\b/i,
    sub: /\b(sub|subs|subbed|sottotitoli)\s*[:.\-_]?\s*(ita|it|italian)\b/i,
    contextIt: /\b(ac-?3|aac|mp3|ddp|dts|truehd|audio|lingua)\W+(it)\b/i
};

// Mappa per le icone di qualità (Stile Leviathan)
const QUALITY_ICONS = {
    "4k": "🔥",
    "2160p": "🔥",
    "1440p": "🖥️",
    "1080p": "👑",
    "720p": "⚡",
    "480p": "📼",
    "dvd": "💿",
    "sd": "📼",
    "cam": "💩",
    "scr": "👀"
};

// --- 2. FUNZIONI HELPER ---

function formatBytes(bytes) {
  if (!+bytes) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${UNITS[i]}`;
}

function cleanFilename(filename) {
    if (!filename) return "";
    try {
        const info = titleParser.parse(filename);
        return info.title || filename;
    } catch (e) {
        return filename.replace(/\./g, " ").trim();
    }
}

function getEpisodeTag(filename) {
    const f = filename.toLowerCase();
    const matchEp = f.match(/s(\d+)[ex](\d+)/i);
    if (matchEp) return `🍿 S${matchEp[1]}E${matchEp[2]}`;
    const matchX = f.match(/(\d+)x(\d+)/i);
    if (matchX) return `🍿 S${matchX[1].padStart(2, '0')}E${matchX[2].padStart(2, '0')}`;
    
    if (/(?:complete|season|stagione|tutta)\s+(\d+)/i.test(f)) {
        const num = f.match(/(?:complete|season|stagione|tutta)\s+(\d+)/i)[1];
        return `📦 STAGIONE ${num}`;
    }
    return "";
}

// --- GENERATORE FONT ---
function toStylized(text, type = 'std') {
    if (!text) return "";
    text = String(text);
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

// === NUOVA ESTRAZIONE IBRIDA (TORRENTIO + LEVIATHAN) ===
function extractStreamInfo(title, source) {
  const t = String(title);
  
  // 1. Parser
  const info = titleParser.parse(t);
  
  // 2. Normalizzazione Qualità
  let q = "SD";
  let qDetails = "SD";
  
  if (info.resolution) {
      q = info.resolution.toUpperCase();
      if (q === "2160P") {
          q = "4K";
      }
      qDetails = q;
  } else if (info.source) {
      const camSources = ['CAM', 'TeleSync', 'TeleCine', 'SCR', 'Screener'];
      if (camSources.some(s => info.source.includes(s))) {
          q = "CAM";
          qDetails = "CAM";
      } else if (info.source.includes('BluRay') || info.source.includes('BD')) {
          q = "1080p";
      }
  }

  const qIcon = QUALITY_ICONS[q.toLowerCase()] || (q.includes('4K') ? "🔥" : "📺");

  // 3. Costruzione Tag Video
  const videoTags = [];
  const cleanTags = [];

  let isRemux = info.remux;
  let isWeb = info.source ? /web|hdtv/i.test(info.source) : false;
  let isBluRay = info.source ? /bluray|bd/i.test(info.source) : false;
  let sourceFound = false;

  // Priorità Sorgente
  if (isRemux) {
      videoTags.push(`💎 ${toStylized("REMUX")}`);
      cleanTags.push("Remux");
      sourceFound = true;
  } else if (isBluRay) {
      videoTags.push(`💿 ${toStylized("BluRay")}`);
      cleanTags.push("BluRay");
      sourceFound = true;
  } else if (isWeb) {
      videoTags.push(`☁️ ${toStylized("WEB")}`);
      cleanTags.push("WEB");
      sourceFound = true;
  } 

  // --- LOGICA ANTI-VUOTO ---
  if (!sourceFound) {
      videoTags.push(`🎞️ ${toStylized("RIP")}`);
      cleanTags.push("Rip");
  }

  // Codec
  if (info.codec) {
      const codec = info.codec.toUpperCase();
      const icon = /265|HEVC/i.test(codec) ? "⚙️" : "📼";
      videoTags.push(`${icon} ${toStylized(codec)}`);
      cleanTags.push(codec);
  }

  // --- NUOVA LOGICA HDR / DV INTELLIGENTE ---
  const rawT = String(title).toUpperCase();
  const hasDV = /\b(DV|DOLBY\s*VISION|DOVI)\b/.test(rawT) || (info.hdr && (/dolby|vision/i.test(info.hdr.toString())));
  const hasHDR = /\b(HDR|HDR10|HDR10\+|UHD\s*HDR)\b/.test(rawT) || (info.hdr && (/hdr/i.test(info.hdr.toString())));

  if (hasDV && hasHDR) {
      videoTags.push(`👁️🔥 ${toStylized("DV+HDR")}`);
      cleanTags.push("DV+HDR");
  } else if (hasDV) {
      videoTags.push(`👁️ ${toStylized("DV")}`);
      cleanTags.push("DV");
  } else if (hasHDR) {
      videoTags.push(`🔥 ${toStylized("HDR")}`);
      cleanTags.push("HDR");
  }

  // Audio Detection
  let lang = "🇬🇧 ENG";
  if (REGEX_ITA.audio.test(t) || REGEX_ITA.contextIt.test(t) || /corsaro/i.test(source)) {
      lang = "🇮🇹 ITA";
      if (/multi/i.test(t)) lang = "🇮🇹 MULTI";
  }

  // Audio Tags
  let audioTag = "🔈 Stereo";
  let audioChannels = "";

  if (info.audio) {
      const a = info.audio.toUpperCase();
      if (a.includes("ATMOS")) audioTag = "💥💣 Atmos";
      else if (a.includes("DTS-X") || a.includes("DTS:X")) audioTag = "💥💣 DTS:X";
      else if (a.includes("TRUEHD")) audioTag = "🔊⚡ TrueHD";
      else if (a.includes("DTS-HD") || a.includes("MA")) audioTag = "🔊⚡ DTS-HD";
      else if (a.includes("DDP") || a.includes("EAC3")) audioTag = "🔊🔥 Dolby+";
      else if (a.includes("AC3") || a.includes("DD")) audioTag = "🔈🌑 Dolby";
      else if (a.includes("AAC")) audioTag = "🔈✨ AAC";
      else if (a.includes("FLAC")) audioTag = "🎼🌊 FLAC";
      else audioTag = `🔈 ${a}`;
  }

  if (info.channels) {
      audioChannels = info.channels;
      if (audioChannels.includes("5.1") || audioChannels.includes("7.1")) {
          if (audioTag.includes("Stereo")) audioTag = "🔊🌌 Surround";
      }
  }
  
  return { 
      quality: q, 
      qDetails: qDetails, 
      qIcon: qIcon, 
      videoTags, 
      cleanTags, 
      lang, 
      codec: info.codec || "",
      audioTag: audioTag, 
      audioChannels: audioChannels, 
      rawInfo: info 
  };
}

// =========================================================================
// 🌟 PRESET STILI (MODIFICATI CON p.configFlag)
// =========================================================================

// 1. LEVIATHAN (CLASSIC)
function styleLeviathan(p) {
    const qualityBold = toStylized(p.quality, 'bold');
    // AGGIUNTA BANDIERA QUI
    const name = `🦑 𝗟𝗘𝗩𝗜𝗔𝗧𝗛𝗔𝗡 ${p.configFlag}\n${p.qIcon} ┃ ${qualityBold}`;
    const lines = [];
    lines.push(`📁 ${p.cleanName} ${p.epTag}`);
    lines.push(`🗣️ ${p.lang} • ${p.audioInfo}`);
    if (p.videoTags.length > 0) lines.push(p.videoTags.join(" • "));
    else lines.push(`🎞️ ${p.codec || "Video"}`);
    lines.push(`🧲 ${p.sizeString} • 👥 ${p.seeders}`);
    lines.push(p.sourceLine);
    return { name, title: lines.join("\n") };
}

// 2. LEVIATHAN 2.0 (ARCHITECT)
function styleLeviathanTwo(p) {
    const levText = toStylized("LEVIATHAN", "small");
    // AGGIUNTA BANDIERA QUI
    const name = `🦑 ${levText} ${p.configFlag} ${p.serviceIconTitle} │ ${p.quality}`;
    const lines = [];
    lines.push(`🎬 ${toStylized(p.cleanName, "bold")}`);
    lines.push(`📦 ${p.sizeString} │ ${p.codec} ${p.videoTags.filter(x=>!x.includes(p.codec)).join(" ")}`);
    lines.push(`🔊 ${p.audioTag} ${p.audioChannels} • ${p.lang}`);
    lines.push(`🔗 ${p.sourceLine}`);
    return { name, title: lines.join("\n") };
}

// 3. FRA STYLE
function styleFra(p) {
    let qShort = p.quality === "1080p" ? "FHD" : (p.quality === "4K" ? "4K" : "HD");
    // AGGIUNTA BANDIERA QUI
    const name = `⚡️ Leviathan ${p.configFlag} ${qShort}`;
    const tagString = p.cleanTags.join(' • ');
    const lines = [`📄 ❯ ${p.fileTitle}`, `🌎 ❯ ${p.lang} • ${p.audioTag}`, `✨ ❯ ${p.serviceTag} • ${p.displaySource}`, `🔥 ❯ ${p.quality} • ${tagString}`, `💾 ❯ ${p.sizeString} / 👥 ❯ ${p.seeders}`];
    return { name, title: lines.join("\n") };
}

// 4. DAV STYLE
function styleDav(p) {
    let header = p.quality === "4K" ? "🎥 4K UHD" : (p.quality === "1080p" ? "📀 FHD" : "💿 HD");
    const name = `${header} ${p.codec}`;
    const lines = [];
    lines.push(`📺 ${p.cleanName} ${p.epTag}`);
    lines.push(`🎧 ${p.audioTag} ${p.audioChannels} | 🎞️ ${p.codec}`);
    lines.push(`🗣️ ${p.lang} | 📦 ${p.sizeString}`);
    lines.push(`⏱️ ${p.seeders} Seeds | 🏷️ ${p.displaySource}`);
    // AGGIUNTA BANDIERA QUI NELLA DESCRIZIONE
    lines.push(`${p.serviceIconTitle} Leviathan ${p.configFlag} 📡 ${p.serviceTag}`);
    lines.push(`📂 ${p.fileTitle}`);
    return { name, title: lines.join("\n") };
}

// 5. AND STYLE
function styleAnd(p) {
    const name = `🎬 ${p.cleanName} ${p.epTag}`;
    const lines = [];
    const cachedIcon = p.serviceTag === "RD" ? "⚡" : "⏳";
    lines.push(`${p.quality} ${cachedIcon}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    lines.push(`Lingue: ${p.lang}`);
    lines.push(`Specifiche: ${p.quality} | 📺 ${p.cleanTags.join(' ')} | 🔊 ${p.audioTag}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    // AGGIUNTA BANDIERA QUI
    lines.push(`📂 ${p.sizeString} | ☁️ ${p.serviceTag} | 🛰️ Leviathan ${p.configFlag}`);
    return { name, title: lines.join("\n") };
}

// 6. LAD STYLE
function styleLad(p) {
    const name = `🖥️ ${p.quality} ${p.serviceTag}`;
    const lines = [];
    lines.push(`🎟️ ${p.cleanName}`);
    lines.push(`📜 ${p.epTag || "Movie"}`);
    lines.push(`🎥 ${p.quality} 🎞️ ${p.codec} 🎧 ${p.audioTag}`);
    // AGGIUNTA BANDIERA QUI
    lines.push(`📦 ${p.sizeString} • 🔗 Leviathan ${p.configFlag}`);
    lines.push(`🌐 ${p.lang}`);
    return { name, title: lines.join("\n") };
}

// 7. PRI STYLE
function stylePri(p) {
    let resIcon = p.quality === "4K" ? "4K🔥UHD" : (p.quality === "1080p" ? "FHD🚀1080p" : "HD💿720p");
    // AGGIUNTA BANDIERA QUI
    const name = `[${p.serviceTag}]⚡️☁️\n${resIcon}\n[Leviathan ${p.configFlag}]`;
    const lines = [];
    lines.push(`🎬 ${p.cleanName} ${p.epTag}`);
    lines.push(`${p.cleanTags.join(" ")}`);
    lines.push(`🎧 ${p.audioTag} | 🔊 ${p.audioChannels} | 🗣️ ${p.lang}`);
    lines.push(`📁 ${p.sizeString} | 🏷️ ${p.displaySource}`);
    lines.push(`📄 ▶️ ${p.fileTitle} ◀️`);
    return { name, title: lines.join("\n") };
}

// 8. COMET STYLE
function styleComet(p) {
    // AGGIUNTA BANDIERA QUI
    const name = `[${p.serviceTag} ⚡]\nLeviathan ${p.configFlag}\n${p.quality}`;
    const lines = [];
    lines.push(`📄 ${p.fileTitle}`);
    const techStack = [p.codec, ...p.cleanTags].filter(Boolean).join(" • ");
    const videoPart = techStack ? techStack : "Video";
    lines.push(`📹 ${videoPart} | ${p.audioTag}`);
    lines.push(`⭐ ${p.displaySource}`);
    const provider = p.seeders != null ? `👥 ${p.seeders}` : "🔎 Leviathan";
    lines.push(`💾 ${p.sizeString} ${provider}`);
    lines.push(`🌍 ${p.lang}`);
    return { name, title: lines.join("\n") };
}

// 9. STREMIO ITA
function styleStremioIta(p) {
    const isCached = ["RD", "TB", "AD"].includes(p.serviceTag);
    const statusIcon = isCached ? "⚡️" : "⏳";
    // AGGIUNTA BANDIERA QUI
    const name = `${statusIcon} Leviathan ${p.configFlag} ${p.qDetails}`;
    const lines = [];
    lines.push(`📄 ❯ ${p.fileTitle}`);
    lines.push(`🌎 ❯ ${p.lang.replace(/ITA/i, "ita").replace(/ENG/i, "eng").replace(/MULTI/i, "multi")}`);
    let typeIcon = "✨";
    if (!isCached) typeIcon = "⬇️"; 
    lines.push(`${typeIcon} ❯ ${p.serviceTag} • ${p.displaySource}`);
    let qualIcon = "📀";
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
    if (audioLine) lines.push(`🔉 ❯ ${audioLine}`);
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
    // Fallback standard se custom
    return { name: `Leviathan ${p.configFlag} ${p.quality}`, title: userString };
}

// =========================================================================
// 🚀 DISPATCHER PRINCIPALE
// =========================================================================

function formatStreamSelector(fileTitle, source, size, seeders, serviceTag = "RD", config = {}, infoHash = null, isLazy = false, isPackItem = false) {
    let { quality, qDetails, qIcon, videoTags, cleanTags, lang, codec, audioTag, audioChannels, rawInfo } = extractStreamInfo(fileTitle, source);
    
    // --- 🌍 CONFIG FLAG LOGIC ---
    // Determina quale bandiera mostrare in base alla modalità selezionata in index.html
    const langMode = (config.filters && config.filters.language) ? config.filters.language : (config.filters && config.filters.allowEng ? 'all' : 'ita');
    
    let configFlag = "🇮🇹"; // Default fallback
    if (langMode === 'eng') configFlag = "🇬🇧";
    else if (langMode === 'all') configFlag = "🇮🇹🇬🇧";
    // Se 'ita', resta default
    // -----------------------------

    if (serviceTag === "RD") qIcon = "☄️";
    else if (serviceTag === "TB") qIcon = "📦";
    else if (serviceTag === "AD") qIcon = "🦅";
    
    let sizeString = size ? formatBytes(size) : "";
    if (!sizeString || size === 0) {
        let hash = 0;
        for (let i = 0; i < fileTitle.length; i++) hash = fileTitle.charCodeAt(i) + ((hash << 5) - hash);
        const seed = Math.abs(hash);
        let gb = 1; 
        if (quality.includes("4K")) gb = 12 + (seed % 1000) / 100;
        else if (quality.includes("1080")) gb = 1.8 + (seed % 270) / 100;
        else gb = 0.6 + (seed % 80) / 100;
        sizeString = `${gb.toFixed(2)} GB`;
    }

    const cleanName = cleanFilename(fileTitle);
    const epTag = isPackItem ? "📦 SEASON PACK" : getEpisodeTag(fileTitle);

    let displaySource = source || "P2P";
    if (/1337/i.test(displaySource)) displaySource = "1337x"; 
    else if (/corsaro/i.test(displaySource)) displaySource = "ilCorSaRoNeRo";
    else if (/knaben/i.test(displaySource)) displaySource = "Knaben";
    else if (/comet|stremthru/i.test(displaySource)) displaySource = "StremThru";
    else displaySource = displaySource.replace(/MediaFusion|Torrentio|Fallback/gi, '').trim() || "P2P";

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

    const audioInfo = [audioTag, audioChannels].filter(Boolean).join(" ┃ ");
    const hdrPart = (rawInfo.hdr || []).join(''); 
    const bingeGroup = `Leviathan|${quality}|${hdrPart}|${serviceTag}|${infoHash || 'no-hash'}`;

    const params = {
        fileTitle, source, displaySource, size, sizeString, sizeStr,
        seeders, seedersStr,
        quality, qDetails, qIcon, 
        serviceTag, serviceIconTitle,
        videoTags, cleanTags, codec,
        lang, langStr, audioInfo, audioTag, audioChannels,
        cleanName, epTag, sourceLine,
        configFlag // <-- PASSAGGIO BANDIERA AGLI STILI
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
