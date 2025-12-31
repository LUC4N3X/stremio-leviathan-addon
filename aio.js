// --- AIO.js ---
const winston = require('winston');
const PackResolver = require("./leviathan-pack-resolver");
const RD = require("./debrid/realdebrid");
const AD = require("./debrid/alldebrid");
const TB = require("./debrid/torbox");

const CONFIG = {
    REAL_SIZE_FILTER: 80 * 1024 * 1024,
    TIMEOUTS: { PACK_RESOLVER: 8000 }
};

const UNITS = ["B", "KB", "MB", "GB", "TB"];
function formatBytes(bytes) {
  if (!+bytes) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${UNITS[i]}`;
}

const REGEX_QUALITY = { "4K": /2160p|4k|uhd/i, "1080p": /1080p/i, "720p": /720p/i, "SD": /480p|\bsd\b/i };
const REGEX_AUDIO = {
    channels: /\b(7\.1|5\.1|2\.1|2\.0)\b/,
    atmos: /atmos/i, dtsx: /dts[:\s-]?x/i, truehd: /truehd/i, dtshd: /\bdts-?hd\b|\bma\b/i,
    dts: /\bdts\b/i, ddp: /\bddp\b|\beac-?3\b|\bdolby\s?digital\s?plus\b/i, 
    dolby: /\bac-?3\b|\bdd\b|\bdolby\b/i, aac: /\baac\b/i, flac: /\bflac\b/i 
};
const REGEX_ITA = [ /\b(ITA|ITALIAN|ITALY)\b/i, /\b(AUDIO|LINGUA)\s*[:\-]?\s*(ITA|IT)\b/i ];

function isSafeForItalian(item) {
  if (!item || !item.title) return false;
  return REGEX_ITA.some(p => p.test(item.title));
}

function extractAudioInfo(title) {
    const t = String(title).toLowerCase();
    const channelMatch = t.match(REGEX_AUDIO.channels);
    let channels = channelMatch ? channelMatch[1] : "";
    if (channels === "2.0") channels = ""; 
    let audioTag = "";
    if (REGEX_AUDIO.atmos.test(t)) audioTag = "Atmos";
    else if (REGEX_AUDIO.dtsx.test(t)) audioTag = "DTS:X";
    else if (REGEX_AUDIO.truehd.test(t)) audioTag = "TrueHD";
    else if (REGEX_AUDIO.dtshd.test(t)) audioTag = "DTS-HD";
    else if (REGEX_AUDIO.ddp.test(t)) audioTag = "DD+";
    else if (REGEX_AUDIO.dts.test(t)) audioTag = "DTS";
    else if (REGEX_AUDIO.flac.test(t)) audioTag = "FLAC";
    else if (REGEX_AUDIO.dolby.test(t)) audioTag = "Dolby";
    else if (REGEX_AUDIO.aac.test(t)) audioTag = "AAC";
    else if (/\bmp3\b/i.test(t)) audioTag = "MP3";
    
    if (!audioTag && (channels === "5.1" || channels === "7.1")) audioTag = "Surround";
    if (!audioTag) return "Stereo";
    return channels ? `${audioTag} ${channels}` : audioTag;
}

function extractStreamInfo(title, source) {
  const t = String(title).toLowerCase();
  let q = "HD"; let qIcon = "📺";
  if (REGEX_QUALITY["4K"].test(t)) { q = "4K"; qIcon = "🔥"; }
  else if (REGEX_QUALITY["1080p"].test(t)) { q = "1080p"; qIcon = "✨"; }
  else if (REGEX_QUALITY["720p"].test(t)) { q = "720p"; qIcon = "🎞️"; }
  else if (REGEX_QUALITY["SD"].test(t)) { q = "SD"; qIcon = "🐢"; }
  
  const videoTags = [];
  if (/web-?dl/i.test(t)) videoTags.push("WEB-DL");
  else if (/webrip/i.test(t)) videoTags.push("WEBRip");
  else if (/bluray/i.test(t)) videoTags.push("BluRay");
  else if (/remux/i.test(t)) videoTags.push("Remux");

  if (/hdr/.test(t)) videoTags.push("HDR");
  if (/dolby|vision|\bdv\b/.test(t)) videoTags.push("DV");
  if (/imax/.test(t)) videoTags.push("IMAX");
  if (/x265|h265|hevc/.test(t)) videoTags.push("HEVC");
  else if (/x264|h264|avc/.test(t)) videoTags.push("AVC");

  let lang = "ENG"; 
  if (/corsaro/i.test(source) || isSafeForItalian({ title })) {
      lang = "ITA";
      if (/multi|mui/i.test(t)) lang = "ITALIAN / ENGLISH";
  } 
  const audioInfo = extractAudioInfo(title);
  
  return { quality: q, qIcon, videoTags, lang, audioInfo };
}

function formatStreamTitleAIO(fileTitle, source, size, seeders, serviceTag = "RD") {
    const { quality, qIcon, videoTags, lang, audioInfo } = extractStreamInfo(fileTitle, source);
    const sizeStr = size ? `${formatBytes(size)}` : "";
    
    const techVideoLine = videoTags.length > 0 ? `🎥 ${videoTags.join(" | ")}` : "";
    const audioLine = `🎧 ${audioInfo}`;
    const langLine = `🗣️ ${lang}`;
    const sizeSourceLine = `📦 ${sizeStr} ⚡ LEVIATHAN ${serviceTag}`;

    const name = `🦑 LEVIATHAN\n${serviceTag}`; 
    const cleanName = fileTitle.replace(/\./g, " ").trim();
    const fileLine = `📄 ${cleanName}`;

    const lines = [];
    if (techVideoLine) lines.push(techVideoLine);
    lines.push(audioLine);
    lines.push(langLine);
    lines.push(sizeSourceLine);
    lines.push(fileLine);
    
    return { name, title: lines.join("\n") };
}

async function withTimeout(promise, ms, operation = 'Operation') {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => { reject(new Error(`TIMEOUT: ${operation} exceeded ${ms}ms`)); }, ms);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timer);
        return result;
    } catch (error) {
        clearTimeout(timer);
        throw error; 
    }
}

async function resolveDebridLinkAIO(config, item, showFake, reqHost, meta = null, dbHelper = null) {
    try {
        const service = config.service || 'rd';
        const apiKey = config.key || config.rd;
        if (!apiKey) return null;

        const isSeries = meta && meta.isSeries;
        if (isSeries && PackResolver.isSeasonPack(item.title) && item.fileIdx === undefined) {
             try {
                const resolverConfig = { 
                    rd_key: service === 'rd' ? apiKey : null,
                    torbox_key: service === 'tb' ? apiKey : null 
                };
                const resolved = await withTimeout(
                    PackResolver.resolveSeriesPackFile(
                        item.hash, 
                        resolverConfig, 
                        meta.imdb_id, 
                        meta.season, 
                        meta.episode, 
                        dbHelper
                    ), 
                    CONFIG.TIMEOUTS.PACK_RESOLVER,
                    'Pack Resolution'
                );
                if (resolved) {
                    item.fileIdx = resolved.fileIndex;
                    item.title = resolved.fileName;
                    item._size = resolved.fileSize;
                    item.source += " [PACK]";
                }
             } catch (err) {}
        }

        if (service === 'tb') {
            if (item._tbCached) {
                const serviceTag = "TB";
                const { name, title } = formatStreamTitleAIO(item.title, item.source, item._size, item.seeders, serviceTag);
                const proxyUrl = `${reqHost}/${config.rawConf}/play_tb/${item.hash}?s=${item.season || 0}&e=${item.episode || 0}`;
                
                return { 
                    name, 
                    title, 
                    url: proxyUrl, 
                    infoHash: item.hash ? item.hash.toUpperCase() : null, // Assicuriamo Maiuscolo
                    behaviorHints: { 
                        notWebReady: false, 
                        bingieGroup: `corsaro-tb`,
                        filename: item.title 
                    } 
                };
            } else { return null; }
        }

        let streamData = null;
        if (service === 'rd') streamData = await RD.getStreamLink(apiKey, item.magnet, item.season, item.episode, item.fileIdx);
        else if (service === 'ad') streamData = await AD.getStreamLink(apiKey, item.magnet, item.season, item.episode, item.fileIdx);

        if (!streamData || (streamData.type === "ready" && streamData.size < CONFIG.REAL_SIZE_FILTER)) return null;

        const serviceTag = service.toUpperCase();
        const finalFilename = streamData.filename || item.title; 

        const { name, title } = formatStreamTitleAIO(finalFilename, item.source, streamData.size || item.size, item.seeders, serviceTag);
        
        return { 
            name, 
            title, 
            url: streamData.url, 
            infoHash: item.hash ? item.hash.toUpperCase() : null, // Assicuriamo Maiuscolo
            fileIdx: item.fileIdx,
            behaviorHints: { 
                notWebReady: false, 
                bingieGroup: `corsaro-${service}`,
                filename: finalFilename 
            } 
        };
    } catch (e) {
        if (showFake) return { 
            name: `[P2P ⚠️]`, 
            title: `${item.title}\n⚠️ Cache Assente`, 
            url: item.magnet, 
            infoHash: item.hash ? item.hash.toUpperCase() : null,
            behaviorHints: { notWebReady: true } 
        };
        return null;
    }
}

module.exports = { resolveDebridLink: resolveDebridLinkAIO };
