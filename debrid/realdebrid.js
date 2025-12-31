// rd.js — VERSIONE DEFINITIVA (più risultati, zero clessidre, dashboard pulita)

const axios = require("axios");

const RD_TIMEOUT = 120000;
const MAX_POLL = 8;
const POLL_DELAY = 1500;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/* =========================
   FILE MATCHING INTELLIGENTE
========================= */
function matchFile(files, season, episode) {
    if (!files) return null;

    const videoFiles = files.filter(f => {
        const n = f.path.toLowerCase();
        return (
            /\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i.test(n) &&
            !n.includes("sample")
        );
    });

    if (!videoFiles.length) return null;
    if (!season || !episode) {
        return videoFiles.sort((a,b) => b.bytes - a.bytes)[0].id;
    }

    const s = parseInt(season);
    const e = parseInt(episode);
    const s2 = s.toString().padStart(2, "0");
    const e2 = e.toString().padStart(2, "0");

    const rules = [
        new RegExp(`S0*${s}.*?E0*${e}\\b`, "i"),       // S01E01
        new RegExp(`\\b${s}x0*${e}\\b`, "i"),         // 1x01
        new RegExp(`(^|\\D)${s}${e2}(\\D|$)`),        // 101 / 215
        new RegExp(`(ep|episode)[^0-9]*0*${e}\\b`, "i"),
        new RegExp(`[ \\-\\[_]0*${e}[ \\-\\]_]`)      // anime assoluto
    ];

    for (const rx of rules) {
        const f = videoFiles.find(v => rx.test(v.path));
        if (f) return f.id;
    }

    // fallback finale: file più grande
    return videoFiles.sort((a,b) => b.bytes - a.bytes)[0].id;
}

/* =========================
   RD REQUEST ROBUSTA
========================= */
async function rdRequest(method, url, token, data = null) {
    let attempt = 0;
    while (attempt < 4) {
        try {
            const res = await axios({
                method,
                url,
                headers: { Authorization: `Bearer ${token}` },
                timeout: RD_TIMEOUT,
                data
            });
            return res.data;
        } catch (e) {
            const st = e.response?.status;
            if (st === 403) return null;
            if (st === 429 || st >= 500) {
                await sleep(1000 + Math.random() * 1000);
                attempt++;
                continue;
            }
            return null;
        }
    }
    return null;
}

/* =========================
   MODULO RD
========================= */
const RD = {

    deleteTorrent: async (token, id) => {
        try {
            await rdRequest(
                "DELETE",
                `https://api.real-debrid.com/rest/1.0/torrents/delete/${id}`,
                token
            );
        } catch {}
    },

    checkInstantAvailability: async (token, hashes) => {
        try {
            const url =
                `https://api.real-debrid.com/rest/1.0/torrents/instantAvailability/${hashes.join("/")}`;
            return await rdRequest("GET", url, token) || {};
        } catch {
            return {};
        }
    },

    /* =========================
       STREAM LINK PRINCIPALE
    ========================= */
    getStreamLink: async (token, magnet, season = null, episode = null) => {
        let torrentId = null;

        try {
            /* 1️⃣ ADD MAGNET */
            const body = new URLSearchParams();
            body.append("magnet", magnet);

            const add = await rdRequest(
                "POST",
                "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
                token,
                body
            );

            if (!add?.id) return null;
            torrentId = add.id;

            /* 2️⃣ INFO + POLLING */
            let info = null;
            for (let i = 0; i < MAX_POLL; i++) {
                await sleep(POLL_DELAY);
                info = await rdRequest(
                    "GET",
                    `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
                    token
                );
                if (info?.status === "waiting_files_selection" || info?.status === "downloaded") {
                    break;
                }
            }

            if (!info) {
                await RD.deleteTorrent(token, torrentId);
                return null;
            }

            /* 3️⃣ FILE SELECTION */
            if (info.status === "waiting_files_selection") {
                let fileId = "all";
                if (info.files) {
                    const m = matchFile(info.files, season, episode);
                    if (m) fileId = m;
                }

                const sel = new URLSearchParams();
                sel.append("files", fileId);

                await rdRequest(
                    "POST",
                    `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
                    token,
                    sel
                );

                // reload info
                for (let i = 0; i < MAX_POLL; i++) {
                    await sleep(POLL_DELAY);
                    info = await rdRequest(
                        "GET",
                        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
                        token
                    );
                    if (info?.status === "downloaded") break;
                }
            }

            if (info.status !== "downloaded" || !info.links?.length) {
                await RD.deleteTorrent(token, torrentId);
                return null;
            }

            /* 4️⃣ LINK GIUSTO */
            let link = info.links[0];

            if (season && episode && info.files?.length === info.links.length) {
                const fid = matchFile(info.files, season, episode);
                const idx = info.files.findIndex(f => f.id === fid);
                if (idx >= 0 && info.links[idx]) {
                    link = info.links[idx];
                }
            }

            /* 5️⃣ UNRESTRICT */
            const uBody = new URLSearchParams();
            uBody.append("link", link);

            const un = await rdRequest(
                "POST",
                "https://api.real-debrid.com/rest/1.0/unrestrict/link",
                token,
                uBody
            );

            if (!un?.download) {
                await RD.deleteTorrent(token, torrentId);
                return null;
            }

            /* 🧹 DELETE FINALE */
            await RD.deleteTorrent(token, torrentId);

            return {
                type: "ready",
                url: un.download,
                filename: un.filename,
                size: un.filesize
            };

        } catch (e) {
            if (torrentId) await RD.deleteTorrent(token, torrentId);
            return null;
        }
    }
};

module.exports = RD;
