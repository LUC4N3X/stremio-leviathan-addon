const UNITS = ["B", "KB", "MB", "GB", "TB"];

// --- 1. REGEX & COSTANTI ---
const REGEX_YEAR = /(19|20)\d{2}/;
const REGEX_QUALITY = {
    "4K": /\b(?:2160p|4k|uhd|ultra[-.\s]?hd|2160i)\b/i,
    "1080p": /\b(?:1080p|1080i|fhd|full[-.\s]?hd|blu[-.\s]?ray|bd[-.\s]?rip)\b/i,
    "720p": /\b(?:720p|720i|hd[-.\s]?rip|hd)\b/i,
    "SD": /\b(?:480p|576p|sd|dvd|dvd[-.\s]?rip|dvd[-.\s]?scr|cd)\b/i
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
    if (matchEp) return `S${matchEp[1]}E${matchEp[2]}`;
    const matchX = f.match(/(\d+)x(\d+)/i);
    if (matchX) return `S${matchX[1].padStart(2, '0')}E${matchX[2].padStart(2, '0')}`;
    const sMatch = f.match(/s(\d+)\b|stagione (\d+)|season (\d+)/i);
    if (sMatch) {
        const num = sMatch[1] || sMatch[2] || sMatch[3];
        return `S${num} Complete`;
    }
    return "";
}

// --- GENERATORE FONT ---
function toStylized(text, type = 'std') {
    const maps = {
        // Sans-Serif Bold (Aggiornato con Numeri Sans)
        'bold': {
            nums: {'0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'},
            chars: {'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝','K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧','U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭','a':'𝗮','b':'𝗯','c':'𝗰','d':'𝗱','e':'𝗲','f':'𝗳','g':'𝗴','h':'𝗵','i':'𝗶','j':'j','k':'𝗸','l':'𝗹','m':'𝗺','n':'𝗻','o':'𝗼','p':'𝗽','q':'𝗾','r':'𝗿','s':'𝘀','t':'𝘁','u':'𝘂','v':'𝘃','w':'𝘄','x':'𝘅','y':'𝘆','z':'𝘇'}
        },
        'italic': {
            nums: {'0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'},
            chars: {'A':'𝘼','B':'𝘽','C':'𝘾','D':'𝘿','E':'𝙀','F':'𝙁','G':'𝙂','H':'𝙃','I':'𝙄','J':'𝙅','K':'𝙆','L':'𝙇','M':'𝙈','N':'𝙉','O':'𝙊','P':'𝙋','Q':'𝙌','R':'𝙍','S':'𝙎','T':'𝙏','U':'𝙐','V':'𝙑','W':'𝙒','X':'𝙓','Y':'𝙔','Z':'𝙕','a':'𝙖','b':'𝙗','c':'𝙘','d':'𝙙','e':'𝙚','f':'𝙛','g':'𝙜','h':'𝙝','i':'𝙞','j':'𝙟','k':'𝙠','l':'𝙡','m':'𝙢','n':'𝙣','o':'𝙤','p':'𝙥','q':'𝙦','r':'𝙧','s':'𝙨','t':'𝙩','u':'𝙪','v':'𝙫','w':'𝙬','x':'𝙭','y':'𝙮','z':'𝙯'}
        },
        'mono': {
            nums: {'0':'𝟶','1':'𝟷','2':'𝟸','3':'𝟹','4':'𝟺','5':'𝟻','6':'𝟼','7':'𝟽','8':'𝟾','9':'𝟿'},
            chars: {'A':'𝙰','B':'𝙱','C':'𝙲','D':'𝙳','E':'𝙴','F':'𝙵','G':'𝙶','H':'𝙷','I':'𝙸','J':'𝙹','K':'𝙺','L':'𝙻','M':'𝙼','N':'𝙽','O':'𝙾','P':'𝙿','Q':'𝚀','R':'𝚁','S':'𝚂','T':'𝚃','U':'𝚄','V':'𝚅','W':'𝚆','X':'𝚇','Y':'𝚈','Z':'𝚉','a':'𝚊','b':'𝚋','c':'𝚌','d':'𝚍','e':'𝚎','f':'𝚏','g':'𝚐','h':'𝚑','i':'𝚒','j':'𝚓','k':'𝚔','l':'𝚕','m':'𝚖','n':'𝚗','o':'𝚘','p':'𝚙','q':'𝚚','r':'𝚛','s':'𝚜','t':'𝚝','u':'𝚞','v':'𝚟','w':'𝚠','x':'𝚡','y':'𝚢','z':'𝚉'}
        },
        // Small Caps (Maiuscoletto)
        'small': {
            nums: {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'},
            chars: {'A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ꜰ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'ꜱ','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ','a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'}
        },
        'gothic': {
            nums: {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'}, 
            chars: {'A':'𝕬','B':'𝕭','C':'𝕮','D':'𝕯','E':'𝕰','F':'𝕱','G':'𝕲','H':'𝕳','I':'𝕴','J':'𝕵','K':'𝕶','L':'𝕷','M':'𝕸','N':'𝕹','O':'𝕺','P':'𝕻','Q':'𝕼','R':'𝕽','S':'𝕾','T':'𝕿','U':'𝖀','V':'𝖁','W':'𝖂','X':'𝖃','Y':'𝖄','Z':'𝖅','a':'𝖆','b':'𝖇','c':'𝖈','d':'𝖉','e':'𝖊','f':'𝖋','g':'𝖌','h':'𝖍','i':'𝖎','j':'𝖏','k':'𝖐','l':'𝖑','m':'𝖒','n':'𝖓','o':'𝖔','p':'𝖕','q':'𝖖','r':'𝖗','s':'𝖘','t':'𝖙','u':'𝖚','v':'𝖛','w':'𝖜','x':'𝖝','y':'𝖞','z':'𝖟'}
        },
        'double': {
            nums: {'0':'𝟘','1':'𝟙','2':'𝟚','3':'𝟛','4':'𝟜','5':'𝟝','6':'𝟞','7':'𝟟','8':'𝟠','9':'𝟡'},
            chars: {'A':'𝔸','B':'𝔹','C':'ℂ','D':'𝔻','E':'𝔼','F':'𝔽','G':'𝔾','H':'ℍ','I':'𝕀','J':'𝕁','K':'𝕂','L':'𝕃','M':'𝕄','N':'ℕ','O':'𝕆','P':'ℙ','Q':'ℚ','R':'ℝ','S':'𝕊','T':'𝕋','U':'𝕌','V':'𝕍','W':'𝕎','X':'𝕏','Y':'𝕐','Z':'ℤ','a':'𝕒','b':'𝕓','c':'𝕔','d':'𝕕','e':'𝕖','f':'𝕗','g':'𝕘','h':'𝕙','i':'𝕚','j':'𝕛','k':'𝕜','l':'𝕝','m':'𝕞','n':'𝕟','o':'𝕠','p':'𝕡','q':'𝕢','r':'𝕣','s':'𝕤','t':'𝕥','u':'𝕦','v':'𝕧','w':'𝕨','x':'𝕩','y':'𝕪','z':'𝕫'}
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
        { test: REGEX_AUDIO.atmos,  tag: "Atmos" },
        { test: REGEX_AUDIO.dtsx,   tag: "DTS:X" },
        { test: REGEX_AUDIO.truehd, tag: "TrueHD" },
        { test: REGEX_AUDIO.dtshd,  tag: "DTS-HD" },
        { test: REGEX_AUDIO.ddp,    tag: "DDP" },
        { test: REGEX_AUDIO.dts,    tag: "DTS" },
        { test: REGEX_AUDIO.flac,   tag: "FLAC" },
        { test: REGEX_AUDIO.dolby,  tag: "Dolby" },
        { test: REGEX_AUDIO.aac,    tag: "AAC" },
        { test: /\bmp3\b/i,         tag: "MP3" }
    ];

    let audioTag = AUDIO_PRIORITY.find(c => c.test.test(t))?.tag || "AAC";
    if (!audioTag && (channels === "5.1" || channels === "7.1")) audioTag = "Surround";
    
    return { tag: audioTag, channels: channels };
}

function extractStreamInfo(title, source) {
  const t = String(title).toLowerCase();
  let q = "SD"; 
  if (REGEX_QUALITY["4K"].test(t)) q = "4K"; 
  else if (REGEX_QUALITY["1080p"].test(t)) q = "1080p"; 
  else if (REGEX_QUALITY["720p"].test(t)) q = "720p";
  
  const videoTags = [];
  const isRemux = /remux/i.test(t);
  const isBluRay = /\bbd\b|\bbluray\b|\bbdrip\b|\bbrrip\b/i.test(t) && !isRemux;
  const isWeb = /\bweb-?dl\b|\bwebrip\b|\bweb\b|\bhdtv\b|\bppv\b|\bnf\b|\bamzn\b|\bdsnp\b|\bhmax\b|\bhulu\b|\bmax\b/i.test(t);
  
  if (isRemux) videoTags.push("Remux");
  else if (isBluRay) videoTags.push("BluRay");
  else if (isWeb) videoTags.push("WEB-DL");
  
  if (/hdr/.test(t)) videoTags.push("HDR");
  if (/dolby|vision|\bdv\b/.test(t)) videoTags.push("DV");
  if (/imax/.test(t)) videoTags.push("IMAX");
  if (/10bit|10-bit|hi10p/i.test(t)) videoTags.push("10bit");
  
  let codec = "";
  if (/x265|h\.?265|hevc/i.test(t)) { videoTags.push("HEVC"); codec="HEVC"; } 
  else if (/x264|h\.?264|avc|mpeg-?4/i.test(t)) { videoTags.push("AVC"); codec="AVC"; }

  let lang = "ENG";
  if (/corsaro/i.test(source) || /\bita\b/i.test(t)) {
      lang = "ITA";
      if (/multi|mui/i.test(t)) lang = "ITA/ENG";
  }
  
  const audioObj = extractAudioInfo(title);
  
  return { 
      quality: q, 
      videoTags, 
      lang, 
      codec,
      audioTag: audioObj.tag, 
      audioChannels: audioObj.channels 
  };
}

// =========================================================================
// 🌟 PRESET FIGHI
// =========================================================================

// 1. LEVIATHAN 1.0 (CLASSIC)
function styleLeviathan(p) {
    const qualityBold = toStylized(p.quality, 'bold');
    const leviathanStyled = toStylized("LEVIATHAN", "spaced");
    const name = `🦑 ${leviathanStyled}\n${p.serviceIconTitle} ┃ ${qualityBold}`;
    
    const lines = [];
    lines.push(`🗂️ ${p.cleanName} ${p.epTag}`);
    lines.push(`🗣️ ${p.lang} • 🔊 ${p.audioTag} ${p.audioChannels}`);
    lines.push(`${p.rawVideoTags.join(" • ")}`);
    lines.push(`🧲 ${p.sizeString} • 👥 ${p.seeders}`);
    lines.push(p.sourceLine);

    return { name, title: lines.join("\n") };
}

// 2. LEVIATHAN 2.0 (ARCHITECT) - Quello nuovo richiesto
function styleLeviathanTwo(p) {
    // 🦑 ʟᴇᴠɪᴀᴛʜᴀɴ ⚡ │ 𝟰𝗞
    const levText = toStylized("LEVIATHAN", "small");
    const qText = toStylized(p.quality, "bold"); 
    const name = `🦑 ${levText} ${p.serviceIconTitle} │ ${qText}`;
    
    const lines = [];
    // 🎬 𝗗𝘂𝗻𝗲 𝗣𝗮𝗿𝘁 𝗧𝘄𝗼 (𝟮𝟬𝟮𝟰)
    lines.push(`🎬 ${toStylized(p.cleanName, "bold")}`);
    
    // 📦 𝟲𝟰.𝟮 ɢʙ │ ʀᴇᴍᴜ𝘅 │ ᴅᴏʟʙʏ ᴠɪsɪᴏɴ
    // Formatta Size: 64.20 (Bold) GB (Small)
    const [sizeVal, sizeUnit] = p.sizeString.split(" ");
    const sizeStyled = toStylized(sizeVal || "0", "bold") + " " + toStylized(sizeUnit || "GB", "small");
    
    const videoParts = [sizeStyled];
    if(p.rawVideoTags[0]) videoParts.push(toStylized(p.rawVideoTags[0], "small")); // Es. REMUX
    const extraTag = p.rawVideoTags.find(t => t.includes("DV") || t.includes("HDR") || t.includes("10bit"));
    if(extraTag) videoParts.push(toStylized(extraTag === "DV" ? "Dolby Vision" : extraTag, "small"));
    
    lines.push(`📦 ${videoParts.join(" │ ")}`);
    
    // 🔊 ᴛʀᴜᴇʜᴅ 𝟳.𝟭 • 🇮🇹 ɪᴛᴀ ᴇɴɢ
    const audioStyled = toStylized(`${p.audioTag} ${p.audioChannels}`, "small");
    const langStyled = toStylized(p.lang, "small");
    const langFlag = p.lang.includes("ITA") ? "🇮🇹" : "🇬🇧";
    lines.push(`🔊 ${audioStyled} • ${langFlag} ${langStyled}`);
    
    // 🔗 ʀᴇᴀʟ-ᴅᴇʙʀɪᴅ │ ᴘ𝟚ᴘ
    // Service Name in Small Caps
    let sName = "ᴘ𝟚ᴘ";
    if(p.serviceTag === "RD") sName = "ʀᴇᴀʟ-ᴅᴇʙʀɪᴅ";
    if(p.serviceTag === "AD") sName = "ᴀʟʟ-ᴅᴇʙʀɪᴅ";
    if(p.serviceTag === "TB") sName = "ᴛᴏʀʙᴏx";
    
    const srcStyled = toStylized(p.displaySource, "small");
    lines.push(`🔗 ${sName} │ ${srcStyled}`);

    return { name, title: lines.join("\n") };
}

// 3. FRA STYLE
function styleFra(p) {
    let qShort = p.quality === "1080p" ? "FHD" : (p.quality === "4K" ? "4K" : "HD");
    const name = `⚡️ Leviathan ${qShort}`;
    const langFlag = p.lang.includes("ITA") ? "🇮🇹" : "🇬🇧";
    const lines = [];
    lines.push(`📄 ❯ ${p.fileTitle}`);
    lines.push(`🌎 ❯ ${langFlag} ${p.lang} • ${p.audioTag}`);
    lines.push(`✨ ❯ ${p.serviceTag} • ${p.displaySource}`);
    lines.push(`🔥 ❯ ${p.quality} • ${p.rawVideoTags.join(' • ')}`);
    lines.push(`💾 ❯ ${p.sizeString} / 👥 ❯ ${p.seeders}`);
    return { name, title: lines.join("\n") };
}

// 4. DAV STYLE
function styleDav(p) {
    let header = p.quality === "4K" ? "🎥4K UHD" : (p.quality === "1080p" ? "📀 FHD" : "💿 HD");
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

// 5. AND STYLE
function styleAnd(p) {
    const name = `🎬 ${p.cleanName} ${p.epTag}`;
    const lines = [];
    const cachedIcon = p.serviceTag === "RD" ? "⚡" : "⏳";
    lines.push(`${p.quality} ${cachedIcon}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    lines.push(`Lingue: ${p.lang.includes("ITA") ? "🇮🇹" : "🇬🇧"}`);
    lines.push(`Specifiche: ${p.quality} | 📺 ${p.rawVideoTags.join(' ')} | 🔊 ${p.audioTag}`);
    lines.push(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    lines.push(`📂 ${p.sizeString} | ☁️ ${p.serviceTag} | 🛰️ Leviathan`);
    return { name, title: lines.join("\n") };
}

// 6. LAD STYLE
function styleLad(p) {
    const name = `🖥️ ${p.quality} ${p.serviceTag}`;
    const lines = [];
    lines.push(`🎟️ ${p.cleanName}`);
    lines.push(`📜 ${p.epTag || "Movie"}`);
    lines.push(`🎥 ${p.quality} 🎞️ ${p.codec} 🎧 ${p.audioTag}`);
    lines.push(`📦 ${p.sizeString} • 🔗 Leviathan`);
    lines.push(`🌐 ${p.lang.includes("ITA") ? "🇮🇹" : "🇬🇧"}`);
    return { name, title: lines.join("\n") };
}

// 7. PRI STYLE
function stylePri(p) {
    let resIcon = p.quality === "4K" ? "4K🔥UHD" : (p.quality === "1080p" ? "FHD🚀1080p" : "HD💿720p");
    const name = `[${p.serviceTag}]⚡️☁️\n${resIcon}\n[Leviathan]`;
    const visualStr = p.rawVideoTags.map(t => {
        if(t==="Remux") return "💎 ʀᴇᴍᴜx";
        if(t==="BluRay") return "📀 ʙʟᴜʀᴀʏ";
        if(t==="WEB-DL") return "🖥 ᴡᴇʙ-ᴅʟ";
        return `🔆 ${t}`;
    }).join(" ");
    const lines = [];
    lines.push(`🎬 ${toStylized(p.cleanName, 'bold')} ${p.epTag}`);
    lines.push(`${visualStr}`);
    lines.push(`🎧 ${p.audioTag} | 🔊 ${p.audioChannels} | 🗣️ ${p.lang}`);
    lines.push(`📁 ${p.sizeString} | 🏷️ ${p.displaySource}`);
    lines.push(`📄 ▶️ ${p.fileTitle} ◀️`);
    return { name, title: lines.join("\n") };
}

// 🛠️ CUSTOM FORMATTER
function styleCustom(p, template) {
    if (!template) return styleLeviathan(p); 
    const vars = {
        "{title}": p.cleanName, "{originalTitle}": p.fileTitle, "{ep}": p.epTag || "",
        "{quality}": p.quality, "{quality_bold}": toStylized(p.quality, 'bold'),
        "{size}": p.sizeString, "{source}": p.displaySource, "{service}": p.serviceTag,
        "{lang}": p.lang, "{audio}": p.audioTag, "{seeders}": p.seedersStr, "{n}": "\n" 
    };
    let userString = template;
    Object.keys(vars).forEach(key => { userString = userString.replace(new RegExp(key, "g"), vars[key]); });
    userString = userString.replace(/\\n/g, "\n");
    if (userString.includes("|||")) {
        const parts = userString.split("|||");
        return { name: parts[0].trim(), title: parts[1].trim() };
    }
    const header = `Leviathan ${p.serviceTag}\n${p.quality}`;
    return { name: header, title: userString };
}

// =========================================================================
// 🚀 DISPATCHER PRINCIPALE
// =========================================================================

function formatStreamSelector(fileTitle, source, size, seeders, serviceTag = "RD", config = {}, infoHash = null, isLazy = false, isPackItem = false) {
    const { quality, videoTags, lang, codec, audioTag, audioChannels } = extractStreamInfo(fileTitle, source);
    
    let sizeString = size ? formatBytes(size) : "";
    if (!sizeString || size === 0) sizeString = "Unknown GB";

    const cleanName = cleanFilename(fileTitle).replace(/(s\d{1,2}e\d{1,2}|\d{1,2}x\d{1,2}|s\d{1,2})/ig, "").replace(/\s{2,}/g, " ").trim();
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
    const techClean = videoTags.join("") + codec;
    const bingeGroup = `Leviathan|${quality}|${techClean}|${serviceTag}`;

    const params = {
        fileTitle, source, displaySource, size, sizeString, 
        seeders, seedersStr: seeders != null ? `👥 ${seeders}` : "",
        quality, serviceTag, serviceIconTitle,
        rawVideoTags: videoTags, codec,
        lang, audioTag, audioChannels,
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
        case "custom": result = styleCustom(params, config.customTemplate || ""); break;
        case "leviathan": 
        default: 
            result = styleLeviathan(params); break;
    }

    result.bingeGroup = bingeGroup;
    return result;
}

module.exports = { formatStreamSelector, cleanFilename, formatBytes, extractStreamInfo, getEpisodeTag };
