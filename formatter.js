const titleParser = require('parse-torrent-title'); 

const UNITS = ["B", "KB", "MB", "GB", "TB"];

// =========================================================================
// 1. CONFIGURAZIONE & COSTANTI
// =========================================================================

// CONFIGURAZIONE SEPARATORE LINGUE
const LANG_SEP = " / "; 

// Mappa Lingue Estesa
const LANG_FLAGS = [
    { id: "ita", flag: "🇮🇹", label: "ITA", regex: /\b(ita|italian|italiano|it)\b/i },
    { id: "eng", flag: "🇬🇧", label: "ENG", regex: /\b(eng|english|en)\b/i },
    { id: "jpn", flag: "🇯🇵", label: "JPN", regex: /\b(jap|jpn|japanese|jp)\b/i },
    { id: "fra", flag: "🇫🇷", label: "FRA", regex: /\b(fra|french|fre|fr)\b/i },
    { id: "deu", flag: "🇩🇪", label: "DEU", regex: /\b(ger|german|deu|de|deutsch)\b/i },
    { id: "esp", flag: "🇪🇸", label: "ESP", regex: /\b(spa|spanish|esp|es|español)\b/i },
    { id: "rus", flag: "🇷🇺", label: "RUS", regex: /\b(rus|russian|ru)\b/i },
    { id: "por", flag: "🇵🇹", label: "POR", regex: /\b(por|portuguese|pt|br)\b/i },
    { id: "ukr", flag: "🇺🇦", label: "UKR", regex: /\b(ukr|ukrainian)\b/i },
    { id: "kor", flag: "🇰🇷", label: "KOR", regex: /\b(kor|korean)\b/i },
    { id: "chi", flag: "🇨🇳", label: "CHI", regex: /\b(chi|chinese)\b/i },
    { id: "hin", flag: "🇮🇳", label: "HIN", regex: /\b(hin|hindi)\b/i }
];

const REGEX_EXTRA = {
    contextIt: /\b(ac-?3|aac|mp3|ddp|dts|truehd|audio|lingua)\W+(it)\b/i,
    dualAudio: /\b(dual[\s\.-]*audio)\b/i,
    multiAudio: /\b(multi[\s\.-]*audio|multi)\b/i
};

// Icone Qualità
const QUALITY_ICONS = {
    "8k": "🪐",
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

// Lista nera ESTESA per evitare falsi positivi nel riconoscimento gruppi
// Include ogni possibile termine tecnico che potrebbe trovarsi alla fine del file
const GROUP_BLACKLIST = new Set([
    // Estensioni
    "mkv", "mp4", "avi", "wmv", "iso", "flv", "mov", "ts", "m2ts",
    // Codec Video
    "h264", "h265", "x264", "x265", "hevc", "av1", "divx", "xvid", "mpeg", "avc", "vp9",
    // Risoluzioni
    "4k", "2160p", "1080p", "1080i", "720p", "576p", "480p", "sd", "hd", "uhd", "fhd",
    // Audio
    "aac", "ac3", "mp3", "dts", "dtshd", "dts-ma", "truehd", "atmos", "ddp", "dd", "flac", "opus", "pcm", "stereo", "5.1", "7.1", "2.0", "dual", "audio",
    // Sorgenti
    "bluray", "bd", "bdrip", "brrip", "web", "web-dl", "webrip", "hdtv", "tvrip", "dvd", "dvdrip", "scr", "screener", "cam", "tc", "telesync", "remux", "iso",
    // Lingue
    "ita", "eng", "jpa", "chn", "kor", "rus", "spa", "fre", "ger", "multi", "multisub", "sub", "dub", "ita-eng", "eng-ita",
    // Varie
    "repack", "proper", "internal", "readnfo", "extended", "cut", "director", "unrated", "complete", "season", "episode", "ep", "s01", "e01"
]);

// =========================================================================
// 2. FUNZIONI UTILI
// =========================================================================

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

// Parsing Episodi Intelligente
function getEpisodeTag(filename) {
    const f = filename.toLowerCase();

    // 1. Range Episodi (S01E01-E04 o 1x01-04)
    const matchMulti = f.match(/s(\d+)[ex](\d+)\s*-\s*(?:[ex]?(\d+))/i) || f.match(/(\d+)x(\d+)\s*-\s*(\d+)/i);
    if (matchMulti) {
        const s = matchMulti[1].padStart(2, '0');
        const eStart = matchMulti[2].padStart(2, '0');
        const eEnd = matchMulti[3].padStart(2, '0');
        return `🍿 S${s} E${eStart}-${eEnd}`;
    }

    // 2. Anime Batch [01-12]
    const matchAnimeBatch = f.match(/(?:ep|eps|episode|^|\s)\[?(\d{1,3})\s*-\s*(\d{1,3})\]?(?:\s|$)/i);
    if (matchAnimeBatch) {
        if (parseInt(matchAnimeBatch[1]) < 1900) { 
             return `🍿 Ep ${matchAnimeBatch[1].padStart(2, '0')}-${matchAnimeBatch[2].padStart(2, '0')}`;
        }
    }

    // 3. Episodio Singolo
    const matchEp = f.match(/s(\d+)[ex](\d+)/i);
    if (matchEp) return `🍿 S${matchEp[1].padStart(2, '0')}E${matchEp[2].padStart(2, '0')}`;
    
    const matchX = f.match(/(\d+)x(\d+)/i);
    if (matchX) return `🍿 S${matchX[1].padStart(2, '0')}E${matchX[2].padStart(2, '0')}`;
    
    // 4. Stagione Intera
    if (/(?:complete|season|stagione|tutta)\s+(\d+)/i.test(f)) {
        const num = f.match(/(?:complete|season|stagione|tutta)\s+(\d+)/i)[1];
        return `📦 STAGIONE ${num.padStart(2, '0')}`;
    }

    return "";
}

// Generatore Testo Stilizzato (Font)
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
        },
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

// =========================================================================
// 3. ESTRAZIONE DATI PRINCIPALE (REVISIONATA)
// =========================================================================
function extractStreamInfo(title, source) {
  const t = String(title);
  const info = titleParser.parse(t);
  
  // ==========================================================
  // LOGICA ESTRAZIONE RELEASE GROUP DEFINITIVA
  // ==========================================================
  let releaseGroup = info.group || "";

  // 1. Pulizia: Rimuovi estensione file (.mkv, .mp4, ecc.)
  const cleanT = t.replace(/\.(mkv|mp4|avi|iso|wmv|ts|flv|mov)$/i, "").trim();

  if (!releaseGroup) {
      // Strategia 1: Cerca il pattern "- GRUPPO" alla fine
      const endHyphen = cleanT.match(/[-_]\s?([a-zA-Z0-9@\.]+)$/);
      
      // Strategia 2: Cerca il pattern "[GRUPPO]" alla fine
      const endBracket = cleanT.match(/\[([a-zA-Z0-9_\-\.\s]+)\]$/);
      
      // Strategia 3: Cerca il pattern "[GRUPPO]" all'inizio
      const startBracket = t.match(/^\[([a-zA-Z0-9_\-\.\s]+)\]/);

      if (endHyphen) {
          releaseGroup = endHyphen[1];
      } else if (endBracket) {
          releaseGroup = endBracket[1];
      } else if (startBracket) {
          releaseGroup = startBracket[1];
      } else {
          // Strategia 4: LOGICA "LAST TOKEN" (Per MirCrew e simili senza trattino)
          // Divide la stringa per punti o spazi e prende l'ultimo pezzo
          const tokens = cleanT.split(/[\s\.]+/);
          const candidate = tokens[tokens.length - 1]; // Prendi l'ultima parola

          // Se il candidato esiste e NON è nella blacklist, è probabilmente il gruppo
          if (candidate && candidate.length > 2 && !GROUP_BLACKLIST.has(candidate.toLowerCase()) && !/^\d+$/.test(candidate)) {
              releaseGroup = candidate;
          }
      }
  }

  // VALIDAZIONE FINALE GRUPPO
  if (releaseGroup) {
      // Pulisci caratteri residui
      releaseGroup = releaseGroup.replace(/^(-|_|\[|\]|\s|\.)+|(-|_|\[|\]|\s|\.)+$/g, "").trim();
      
      // Controllo finale Blacklist (nel caso sia passato da regex)
      if (GROUP_BLACKLIST.has(releaseGroup.toLowerCase()) || releaseGroup.length > 25 || releaseGroup.length < 2) {
          releaseGroup = "";
      }
  }
  // ==========================================================

  // A. Qualità
  let q = "SD";
  let qDetails = "SD";
  
  if (info.resolution) {
      q = info.resolution.toUpperCase();
      if (q === "2160P") q = "4K";
      else if (q === "4320P") q = "8K";
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

  // B. Tags Video
  const videoTags = [];
  const cleanTags = [];

  let isRemux = info.remux;
  let isWeb = info.source ? /web|hdtv/i.test(info.source) : false;
  let isBluRay = info.source ? /bluray|bd/i.test(info.source) : false;
  let sourceFound = false;

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

  if (!sourceFound) {
      videoTags.push(`🎞️ ${toStylized("RIP")}`);
      cleanTags.push("Rip");
  }

  // IMAX
  if (/\bIMAX\b/i.test(t)) {
      videoTags.push(`📏 ${toStylized("IMAX")}`);
      cleanTags.push("IMAX");
  }

  // Codec
  if (info.codec) {
      const codec = info.codec.toUpperCase();
      let icon = "📼";
      let stylCodec = codec;

      if (/AV1/i.test(codec)) {
          icon = "🪐";
          stylCodec = "AV1";
      } else if (/VVC|H266/i.test(codec)) {
          icon = "⚡";
          stylCodec = "VVC";
      } else if (/265|HEVC/i.test(codec)) {
          icon = "⚙️";
      }

      videoTags.push(`${icon} ${toStylized(stylCodec)}`);
      cleanTags.push(stylCodec);
  }

  // HDR / Dolby Vision
  const rawT = String(title).toUpperCase();
  const isDV = /\b(DV|DOLBY\s*VISION|DOVI)\b/.test(rawT) || (info.hdr && (/dolby|vision/i.test(info.hdr.toString())));
  const isHDR10Plus = /\b(HDR10\+|HDR10PLUS)\b/.test(rawT) || (info.hdr && (/hdr10\+|plus/i.test(info.hdr.toString())));
  const isHDR = /\b(HDR|HDR10|UHD\s*HDR)\b/.test(rawT) || (info.hdr && (/hdr/i.test(info.hdr.toString())));

  if (isDV && (isHDR || isHDR10Plus)) {
      videoTags.push(`👁️ ${toStylized("DV+HDR")}`);
      cleanTags.push("DV+HDR");
  } else if (isDV) {
      videoTags.push(`👁️ ${toStylized("DV")}`);
      cleanTags.push("DV");
  } else if (isHDR10Plus) {
      videoTags.push(`🔥 ${toStylized("HDR10+")}`);
      cleanTags.push("HDR10+");
  } else if (isHDR) {
      videoTags.push(`🔥 ${toStylized("HDR")}`);
      cleanTags.push("HDR");
  }

  // C. Audio & Lingue
  let detectedLangs = [];
  
  LANG_FLAGS.forEach(l => {
      if (l.regex.test(t)) detectedLangs.push(l);
  });

  const uniqueLangs = [...new Map(detectedLangs.map(item => [item.id, item])).values()];
  let lang = "🇬🇧 ENG"; 

  if (uniqueLangs.length > 0) {
      uniqueLangs.sort((a, b) => (a.id === 'ita' ? -1 : (b.id === 'ita' ? 1 : 0)));
      if (uniqueLangs.length === 1) {
          lang = `${uniqueLangs[0].flag} ${uniqueLangs[0].label}`;
      } else if (uniqueLangs.length <= 3) {
          lang = uniqueLangs.map(l => l.flag).join(LANG_SEP);
      } else {
          lang = `${uniqueLangs[0].flag}${LANG_SEP}🌐`;
      }
  } else {
      if (REGEX_EXTRA.multiAudio.test(t)) lang = `🌐${LANG_SEP}MULTI`;
      else if (REGEX_EXTRA.dualAudio.test(t)) lang = `🌐${LANG_SEP}DUAL`;
      else if (REGEX_EXTRA.contextIt.test(t) || /corsaro/i.test(source)) lang = "🇮🇹 ITA";
  }

  // D. Audio Details
  let audioTag = "🔈 Stereo";
  let audioChannels = "";

  if (info.audio) {
      const a = info.audio.toUpperCase();
      const rawUpper = t.toUpperCase(); 

      if (a.includes("ATMOS")) {
          if (a.includes("TRUEHD") || rawUpper.includes("TRUEHD")) audioTag = "Atmos TrueHD";
          else if (a.includes("DDP") || a.includes("EAC3") || rawUpper.includes("JOC")) audioTag = "Atmos DDP";
          else audioTag = "Atmos";
      }
      else if (a.includes("DTS-X") || a.includes("DTS:X")) audioTag = "DTS:X";
      else if (a.includes("TRUEHD")) audioTag = "TrueHD";
      else if (a.includes("DTS-HD") || a.includes("MA")) audioTag = "DTS-HD";
      else if (a.includes("DDP") || a.includes("EAC3")) audioTag = "Dolby+";
      else if (a.includes("AC3") || a.includes("DD")) audioTag = "Dolby";
      else if (a.includes("AAC")) audioTag = "AAC";
      else if (a.includes("FLAC")) audioTag = "FLAC";
      else if (a.includes("OPUS")) audioTag = "OPUS";
      else audioTag = `${a}`;
  }

  if (info.channels) {
      const ch = info.channels;
      if (ch.includes("7.1")) audioChannels = "🔊 7.1";
      else if (ch.includes("5.1")) audioChannels = "🔊 5.1";
      else if (ch.includes("2.0")) audioChannels = "🔉 2.0";
      else if (ch.includes("1.0")) audioChannels = "🔈 1.0";
      else audioChannels = ch;

      if ((ch.includes("5.1") || ch.includes("7.1")) && audioTag.includes("Stereo")) {
          audioTag = "Surround";
      }
  }
  
  return { 
      quality: q, qDetails, qIcon, videoTags, cleanTags, lang, 
      codec: info.codec || "", audioTag, audioChannels, rawInfo: info,
      releaseGroup 
  };
}

// =========================================================================
// 4. STILI DI FORMATTAZIONE
// =========================================================================

function styleLeviathan(p) {
    let cleanAudio = p.audioTag.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
    if (!cleanAudio) cleanAudio = p.audioTag; 
    
    const titleIcon = "▶️"; 
    const techIcon = "🔱"; 

    const brandName = toStylized("LEVIATHAN", "small"); 
    const name = `[${p.serviceTag}]🦑${brandName}`;

    let techSpecs = [p.quality, ...p.cleanTags].filter(Boolean);
    techSpecs = [...new Set(techSpecs)]; 
    let techLine = techSpecs.map(t => toStylized(t, 'small')).join(" • ");

    const lines = [];
    lines.push(`${titleIcon} ${toStylized(p.cleanName, "bold")} ${p.epTag}`);
    if (techLine) lines.push(`${techIcon} ${techLine}`);
    
    let audioPart = [cleanAudio, p.audioChannels].filter(Boolean).join(" ");
    lines.push(`🗣️ ${p.lang}  |  🔊 ${audioPart}`);

    let fileInfo = `🧲 ${p.sizeString}`;
    if (p.seedersStr) fileInfo += `  |  ${p.seedersStr}`;
    lines.push(fileInfo);

    let sourceRow = `${p.serviceIconTitle} ${p.displaySource}`;
    if (p.releaseGroup) {
        const styledGroup = toStylized(p.releaseGroup, 'small');
        sourceRow += ` | 🏷️ ${styledGroup}`;
    }
    lines.push(sourceRow);

    return { name, title: lines.join("\n") };
}

function styleLeviathanTwo(p) {
    const levText = toStylized("LEVIATHAN", "small");
    const name = `🦑 ${levText} ${p.serviceIconTitle} │ ${p.quality}`;
    const lines = [];
    lines.push(`🎬 ${toStylized(p.cleanName, "bold")}`);
    lines.push(`📦 ${p.sizeString} │ ${p.codec} ${p.videoTags.filter(x=>!x.includes(p.codec)).join(" ")}`);
    lines.push(`🔊 ${p.audioTag} ${p.audioChannels} • ${p.lang}`);
    
    let sourceRow = `🔗 ${p.sourceLine}`;
    if (p.seedersStr) sourceRow += ` ${p.seedersStr}`;
    lines.push(sourceRow);
    
    return { name, title: lines.join("\n") };
}

function styleFra(p) {
    let qShort = p.quality === "1080p" ? "FHD" : (p.quality === "4K" ? "4K" : "HD");
    const name = `⚡️ Leviathan ${qShort}`;
    const tagString = p.cleanTags.join(' • ');
    const lines = [
        `📄 ❯ ${p.fileTitle}`, 
        `🌎 ❯ ${p.lang} • ${p.audioTag}`, 
        `✨ ❯ ${p.serviceTag} • ${p.displaySource}`, 
        `🔥 ❯ ${p.quality} • ${tagString}`, 
        `💾 ❯ ${p.sizeString} / 👥 ❯ ${p.seeders}`
    ];
    return { name, title: lines.join("\n") };
}

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

function styleAnd(p) {
    const name = `🎬 ${p.cleanName} ${p.epTag}`;
    const lines = [];
    const cachedIcon = p.serviceTag === "RD" ? "⚡" : "⏳";
    lines.push(`${p.quality} ${cachedIcon}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    lines.push(`Lingue: ${p.lang}`);
    lines.push(`Specifiche: ${p.quality} | 📺 ${p.cleanTags.join(' ')} | 🔊 ${p.audioTag}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    lines.push(`📂 ${p.sizeString} | ☁️ ${p.serviceTag} | 🛰️ Leviathan`);
    return { name, title: lines.join("\n") };
}

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

function stylePri(p) {
    let resIcon = p.quality === "4K" ? "4K🔥UHD" : (p.quality === "1080p" ? "FHD🚀1080p" : "HD💿720p");
    const name = `[${p.serviceTag}]⚡️☁️\n${resIcon}\n[Leviathan]`;
    const lines = [];
    lines.push(`🎬 ${p.cleanName} ${p.epTag}`);
    lines.push(`${p.cleanTags.join(" ")}`);
    lines.push(`🎧 ${p.audioTag} | 🔊 ${p.audioChannels} | 🗣️ ${p.lang}`);
    lines.push(`📁 ${p.sizeString} | 🏷️ ${p.displaySource}`);
    lines.push(`📄 ▶️ ${p.fileTitle} ◀️`);
    return { name, title: lines.join("\n") };
}

function styleComet(p) {
    const name = `[${p.serviceTag} ⚡]\nLeviathan\n${p.quality}`;
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
// 5. MAIN DISPATCHER
// =========================================================================

function formatStreamSelector(fileTitle, source, size, seeders, serviceTag = "RD", config = {}, infoHash = null, isLazy = false, isPackItem = false) {
    let { quality, qDetails, qIcon, videoTags, cleanTags, lang, codec, audioTag, audioChannels, rawInfo, releaseGroup } = extractStreamInfo(fileTitle, source);
    
    let serviceIconTitle = "🦈"; 
    if (serviceTag === "RD") { qIcon = "🐋"; serviceIconTitle = "🐋"; }
    else if (serviceTag === "TB") { qIcon = "⚓"; serviceIconTitle = "⚓"; }
    else if (serviceTag === "AD") { qIcon = "🐚"; serviceIconTitle = "🐚"; }
    
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

    const sourceLine = `${serviceIconTitle} [${serviceTag}] ${displaySource}`;
    const sizeStr = `🧲 ${sizeString}`;
    const seedersStr = seeders != null ? `👥 ${seeders}` : "";
    
    const audioInfo = [audioTag, audioChannels].filter(Boolean).join(" ┃ ");
    const hdrPart = (rawInfo.hdr || []).join(''); 
    
    const bingeGroup = `Leviathan|${quality}|${hdrPart}|${serviceTag}|${infoHash || 'no-hash'}`;

    const params = {
        fileTitle, source, displaySource, size, sizeString, sizeStr,
        seeders, seedersStr,
        quality, qDetails, qIcon, 
        serviceTag, serviceIconTitle,
        videoTags, cleanTags, codec,
        lang, audioInfo, audioTag, audioChannels,
        cleanName, epTag, sourceLine,
        releaseGroup
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
