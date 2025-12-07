<div align="center">

  <img src="https://api.iconify.design/game-icons:sea-dragon.svg?color=%2300eaff&width=200" style="filter: drop-shadow(0 0 10px rgba(0, 234, 255, 0.4)); margin-bottom: 15px;" />

  <h1 style="font-size: 5rem; font-weight: 800; margin: 0; line-height: 1; letter-spacing: -2px; color: #fff;">
    LEVIATHAN
  </h1>

  <div style="font-size: 1.1rem; color: #94a3b8; margin-top: 10px; font-weight: 400; letter-spacing: 1px;">
    ADVANCED TORRENT AGGREGATION PROTOCOL
  </div>

  <br>

  <p>
    <img src="https://img.shields.io/badge/Real_Debrid-NATIVE_SUPPORT-A2B9F0?style=for-the-badge&logo=realdebrid&logoColor=black" />
    <img src="https://img.shields.io/badge/AllDebrid-MODULE_ACTIVE-F5A623?style=for-the-badge&logo=alldebrid&logoColor=white" />
    <img src="https://img.shields.io/badge/TorBox-COMPATIBLE-7A4EE3?style=for-the-badge&logo=torbox&logoColor=white" />
  </p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-v18_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Architecture-HyperMode_v3.5-8A2BE2?style=for-the-badge&logo=dependabot&logoColor=white" />
    <img src="https://img.shields.io/badge/Status-OPERATIONAL-success?style=for-the-badge&logo=githubactions&logoColor=white" />
  </p>

  <br>

  <div style="background: #050a10; border: 1px solid rgba(0, 234, 255, 0.15); border-radius: 8px; padding: 25px; width: 85%; max-width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <strong style="font-size: 1.3rem; color: #00eaff; display: block; margin-bottom: 10px;">
      🇮🇹 Engineered for Italian Content Precision
    </strong>
    <span style="color: #cbd5e1; line-height: 1.6; font-size: 1rem;">
      Leviathan ridefinisce lo standard dei metamotori torrent attraverso un'architettura <b>Italy-First</b>.
      Integra un sistema di validazione semantica dei titoli, gestione automatizzata delle challenge WAF e un algoritmo di routing a bassa latenza per garantire risultati pertinenti e immediati.
    </span>
  </div>

  <br>

  <p>
    <img src="https://img.shields.io/badge/⚡_Adaptive-Latency_Scaling-000?style=for-the-badge&labelColor=00eaff" />
    <img src="https://img.shields.io/badge/🔍_Smart-Query_Morphing-000?style=for-the-badge&labelColor=00eaff" />
    <img src="https://img.shields.io/badge/🛡️_WAF-Bypass_Protocol-000?style=for-the-badge&labelColor=00eaff" />
    <img src="https://img.shields.io/badge/🔗_Magnet-Fusion_Engine-000?style=for-the-badge&labelColor=00eaff" />
  </p>

<div align="center">
  <a href="https://leaviathan-leviathan.hf.space" target="_blank">
    <img src="public/button.svg" width="350" alt="Installa Leviathan">
  </a>

  <br>

  <hr style="width: 40%; border: 0; height: 1px; background: linear-gradient(90deg, transparent, #00eaff, transparent); margin-top: 15px; opacity: 0.4;">
</div>

## ⚡ Architettura del Sistema

> **Leviathan trascende il concetto di scraper tradizionale.** È un motore di aggregazione predittivo progettato per navigare ecosistemi torrent complessi, restituendo dataset puliti, validati e ordinati per rilevanza.

Il core, sviluppato in **Node.js**, orchestra scansioni parallele sui principali index mondiali e italiani. Utilizza una logica proprietaria per distinguere le sorgenti in base alla latenza di risposta, applicando timeout dinamici e tecniche di evasione anti-bot.

### 🔥 Release 2.0 Highlights

* 🚀 **Core Refactoring:** Motore riscritto per massimizzare stabilità e concorrenza.
* 🏎️ **Fast Lane Mode:** Gestione intelligente dei timeout per API ad alta velocità.
* 🇮🇹 **Strict ITA Validation:** Filtri regex chirurgici per l'eliminazione dei falsi positivi.
* 🛡️ **Cloudscraper Integration:** Ottimizzazione avanzata per il superamento dei controlli Cloudflare.
* 💉 **Magnet Injection:** Arricchimento automatico dei metadati con tracker UDP Tier-1.

---

## 🔱 Core Capabilities

> Il sistema si distingue per un approccio algoritmico proprietario che privilegia la **precisione semantica** sulla forza bruta.

### 1. 🇮🇹 ITA-Strict Validation Protocol
L'algoritmo `isItalianResult()` non esegue una semplice ricerca di stringhe. Applica un filtro **semantico** che analizza il payload per garantire la pertinenza.
* **Positive Matching:** Targetizza tag specifici come `AC3`, `DTS`, `MULTI`, `SUB-ITA`.
* **False Positive Kill-Switch:** Elimina automaticamente release `CAM`, `TS`, e fake files o re-encode di bassa qualità.
* **Risultato:** Dataset pulito al 99.9%. Se non è italiano, non passa.

### 2. ⚡ Adaptive Latency Architecture
Leviathan non tratta tutte le sorgenti allo stesso modo. Utilizza un'euristica predittiva per modulare i timeout:
* 🟢 **Fast Lane (3000ms):** Canale prioritario per API JSON e indici ottimizzati *(Knaben, TPB, Corsaro)*.
* 🔵 **Deep Scan (5000ms):** Scansione profonda per portali HTML complessi o protetti *(1337x, Galaxy)*.
* *Il sistema bilancia automaticamente velocità e completezza.*

### 3. 🛡️ Advanced WAF Evasion
Un layer di sicurezza integrato gestisce l'interazione con i sistemi di protezione perimetrale (Web Application Firewalls).
* **Cloudflare Bypass:** Risoluzione automatica delle challenge JS tramite `cloudscraper`.
* **Identity Rotation:** Rotazione dinamica degli `User-Agent` per simulare traffico organico.
* **Resilience:** Fallback intelligenti che scartano i nodi morti senza interrompere il ciclo di ricerca.

### 4. 🧬 Metadata Fusion & Tracker Injection
Non si limita a trovare il link. Lo potenzia.
* **Smart Parsing:** Normalizzazione regex per Stagioni/Episodi (`S01E01`, `1x01`) indipendentemente dal formato sorgente.
* **Magnet Boosting:** Inietta nel payload una lista curata di **Tracker UDP Tier-1** *(OpenTrackr, Quad, Lubitor)* per massimizzare la velocità di aggancio dei peer e ridurre il tempo di pre-buffering.

---

<div align="center">

<br>

<div align="center">
  <div style="background: rgba(245, 166, 35, 0.1); border: 1px solid rgba(245, 166, 35, 0.3); border-radius: 6px; padding: 15px; width: 90%; max-width: 800px;">
    <strong style="color: #F5A623; font-size: 0.9rem; display: block; margin-bottom: 5px;">
      ⚠️ RESTRIZIONE ISTANZA PUBBLICA
    </strong>
    <span style="color: #cbd5e1; font-size: 0.85rem;">
      Per motivi di carico e gestione dei CAPTCHA, alcuni provider (es. <b>1337x, TorrentGalaxy</b>) sono disabilitati sull'istanza pubblica.
      <br>
      Esegui il <b>Self-Hosting</b> (Docker) per sbloccare il pieno potenziale del Network e bypassare le restrizioni WAF.
    </span>
  </div>
</div>

## 🌐 LEVIATHAN NETWORK NODES

<br>

| **TARGET ENGINE** | **REGION** | **LATENCY** | **MODE** | **STATUS** |
| :--- | :---: | :---: | :---: | :---: |
| **Il Corsaro Nero** | 🇮🇹 ITA | ![](https://img.shields.io/badge/⏱️_3000ms-HQ-00eaff?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/⚡_Fast-Lane-00eaff?style=flat-square&labelColor=black) | 🟢 |
| **Knaben** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_3000ms-HQ-00eaff?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🔌_API-JSON-blueviolet?style=flat-square&labelColor=black) | 🟢 |
| **The Pirate Bay** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_3000ms-HQ-00eaff?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🔌_API-JSON-blueviolet?style=flat-square&labelColor=black) | 🟢 |
| **UIndex** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_4000ms-MED-yellow?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🔹_Aggregator-Hybrid-blue?style=flat-square&labelColor=black) | 🟢 |
| **Nyaa** | 🇯🇵 JPN | ![](https://img.shields.io/badge/⏱️_5000ms-DEEP-orange?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🐢_Deep-Scan-lightgrey?style=flat-square&labelColor=black) | 🟢 |
| **TorrentGalaxy** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_5000ms-DEEP-orange?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🐢_Deep-Scan-lightgrey?style=flat-square&labelColor=black) | 🟢 |
| **BitSearch** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_5000ms-DEEP-orange?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🐢_Deep-Scan-lightgrey?style=flat-square&labelColor=black) | 🟢 |
| **LimeTorrents** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_5000ms-DEEP-orange?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🐢_Deep-Scan-lightgrey?style=flat-square&labelColor=black) | 🟢 |
| **GloTorrents** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_5000ms-DEEP-orange?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🐢_Deep-Scan-lightgrey?style=flat-square&labelColor=black) | 🟢 |
| **1337x** | 🌍 GLB | ![](https://img.shields.io/badge/⏱️_5000ms-DEEP-orange?style=flat-square&labelColor=black) | ![](https://img.shields.io/badge/🛡️_Cloudflare-Protected-f38020?style=flat-square&labelColor=black) | 🟡 |

<br>
</div>



---
# 🐳 PROTOCOLLO DI DISTRIBUZIONE

<div align="center">

Il modo più veloce e pulito per eseguire Leviatano in locale o in produzione.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker&logoColor=white)](https://www.docker.com/)
[![Stremio Addon](https://img.shields.io/badge/Stremio-Addon-green?logo=stremio&logoColor=white)](https://www.stremio.com/)

### 💠 Sequenza di Avvio Rapido

Copia l'intera sequenza e incollala nel terminale per l'inizializzazione immediata:
</div>

```bash
                         git clone https://github.com/LUC4N3X/stremio-leviathan-addon
                  cd stremio-leviathan-addon
                  docker compose up -d --build 
```
✅ Fatto! Leviathan sarà raggiungibile su:
http://localhost:7000


> [!TIP]
> **Status Operativo:**
> * ✔️ **Full Auto:** Avvio completamente automatizzato senza intervento umano.
> * ✔️ **Zero Config:** Nessuna configurazione manuale complessa richiesta.
> * ✔️ **High Performance:** Ideale per Server VPS, NAS e ambienti Home Lab 24/7.

---

# ⚔️  L E V I A T H A N   //  A C C C E S S   P R O T O C O L
> [ ! ]  WARNING: HIGH VOLTAGE NEURAL INTERFACE DETECTED

────────────────────────────────────────────────────────────
░█▀█░█░█░█▀▀░█▄█░█▀█░█▀█░█▀▀░█░█▀▀░█▀▄░█▀█░█░░░█▀▀░█▀▀░█▀█
░█▀▀░█▀█░█▀▀░█░█░█▀█░█░█░█░█░█▀▀░█▀▄░█░█░█░░░█▀▀░█░█░█░█
░▀░░░▀░▀░▀▀▀░▀░▀░▀░▀░▀░▀░▀▀▀░▀▀▀░▀░▀░▀░░░▀▀▀░▀▀▀░▀▀▀░▀░▀
────────────────────────────────────────────────────────────

### 1. 🔴 SYSTEM ARCHITECTURE
**LEVIATHAN** è un hunter-killer autonomo di metadati e magnet link.
- `NO HOSTING` → Zero storage. Zero upload. Zero file transfer.
- `METADATA ONLY` → Legge solo HTML pubblico HTML + hash (come un browser su steroidi).
Funziona esattamente come Google, ma senza ipocrisie aziendali.

### 2. 🎓 PURPOSE & ORIGIN
Progetto rilasciato **esclusivamente** per:
- Ricerca accademica
- Reverse engineering di architetture web
- Stress-test di sistemi di scraping distribuiti
- Cyber-security training & red teaming

Codice fornito **AS-IS**. Nessuna garanzia. Nessun supporto ufficiale.

### 3. 🛡️ USER LIABILITY // FULL DISCLOSURE
Tu premi il tasto. Tu paghi il conto.

- L’autore (LUC4N3X) e tutti i contributori **declinano OGNI responsabilità**.
- L’utente finale si assume **100% responsabilità civile e penale**.
- Verifica TU la conformità con DMCA, Direttiva UE Copyright, leggi nazionali e trattati internazionali.

Noi ti diamo il bisturi. Come lo usi è solo affar tuo.

### 4. ☠️ COPYRIGHT & PIRACY STATEMENT
**LA PIRATERIA È UN REATO. PUNTO.**

LEVIATHAN **non supporta, non facilita e non incoraggia** il download illegale di contenuti protetti da copyright.
Chi lo usa per scopi illeciti verrà tracciato, esposto e abbandonato al suo destino digitale.

────────────────────────────────────────────────────────────
[ ! ]  SE NON ACCETTI QUESTI TERMINI:
> Ferma il container.  
> Elimina l'immagine.  
> Brucia il disco.  
> E vattene dal mio server.

Altrimenti… benvenuto nell’abisso.

<div align="center">
  <b>╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮</b><br>
    Engineered in the dark with ❤️ & 300mg caffeine<br>
         by <b>LUC4N3X</b><br>
  <b>╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯</b><br>
  <i>Leviathan Core © 2024-2025 — All Rights Reserved</i><br>
  <br>
  <b>» Stay sharp. Stay illegal. Stay alive. «</b>
</div>
