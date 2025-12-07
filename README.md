<div style="margin-top: 60px;">

  <!-- BLOCCO SUPERIORE -->
  <div style="
      text-align: center;
      margin-bottom: 40px;
  ">
      <img src="https://api.iconify.design/material-symbols:cloud-sync-rounded.svg?color=%2300eaff&width=110"
           style="filter: drop-shadow(0 0 12px #00eaffaa);" />

      <h2 style="
          font-size: 3rem;
          color: #00eaff;
          text-shadow: 0 0 15px #00eaff99;
          margin-top: 10px;
          margin-bottom: 5px;
          letter-spacing: 2px;
          font-weight: 800;
      ">
        LEVIATHAN CLOUD GATEWAY
      </h2>

      <p style="
          font-size: 1.1rem;
          color: #93a4b4;
          max-width: 780px;
          margin: auto;
          line-height: 1.7;
      ">
        Accesso diretto all’istanza cloud di Leviathan: ottimizzata, scalabile,
        protetta da sandbox avanzata e aggiornata automaticamente al motore
        HyperMode <b>v3.5</b>.  
        Protocolli di stabilizzazione e routing dinamico garantiscono
        tempi di risposta <b>ultra-bassi</b>.
      </p>
  </div>


  <!-- CARD CENTRALE -->
  <div style="
      background: linear-gradient(145deg, #02070d 0%, #03101c 100%);
      border: 1px solid rgba(0, 234, 255, 0.18);
      border-radius: 20px;
      padding: 40px 35px;
      width: 90%;
      max-width: 880px;
      margin: auto;
      box-shadow:
        0 0 18px rgba(0, 234, 255, 0.12),
        inset 0 0 25px rgba(0, 234, 255, 0.05);
  ">
```
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="https://api.iconify.design/mdi:shield-lock.svg?color=%2300eaff&width=70"
             style="filter: drop-shadow(0 0 8px #00eaff77);" />
      </div>
```
      <h3 style="
          text-align: center;
          color: #00eaff;
          font-size: 2rem;
          letter-spacing: 1px;
          margin: 0;
          font-weight: 700;
          text-shadow: 0 0 10px #00eaff77;
      ">
        Hosted on Hugging Face • Secure Node
      </h3>
```
      <p style="
          text-align: center;
          color: #b4c4d6;
          margin-top: 15px;
          font-size: 1rem;
          line-height: 1.6;
      ">
        Nodo ufficiale Leviathan deployato su infrastruttura HF cloud
        con <b>auto-healing</b>, <b>caching distribuita</b> e <b>scansione semantica</b>
        real-time per garantire qualità dei risultati e uptime costante.
      </p>
```
      <!-- PULSANTE GIGANTE -->
      <div style="text-align: center; margin-top: 35px;">
          <a href="https://leaviathan-leviathan.hf.space" target="_blank" style="
              display: inline-block;
              padding: 20px 55px;
              background: linear-gradient(90deg, #00eaff, #00c6ff);
              color: #000;
              font-size: 1.4rem;
              font-weight: 900;
              letter-spacing: 2px;
              text-decoration: none;
              border-radius: 80px;
              border: 2px solid #0ff;
              text-transform: uppercase;
              box-shadow:
                0 0 25px rgba(0, 234, 255, 0.7),
                inset 0 0 10px rgba(255,255,255,0.3);
          ">
            🚀 Launch Leviathan Node
          </a>
```
          <div style="margin-top: 15px; color: #6b7b8e; font-size: 0.9rem;">
            Public Gateway • Auto-Scaling • Instant Deployment
          </div>
      </div>

  </div>

</div>

<br><br>

<hr style="
    border: 0;
    height: 1px;
    width: 75%;
    margin: 50px auto;
    background: linear-gradient(to right, transparent, #00eaff, transparent);
    opacity: 0.35;
">


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

# 📦 Installazione

🔥 Metodo 1 — Clone & Docker Compose (Full Auto-Deploy)

Il modo più semplice, pulito e professionale per avviare Leviathan Core.

```bash

📂  Clona il repository:
git clone https://github.com/LUC4N3X/stremio-leviathan-addon

➡️  Entra nella cartella:
cd stremio-leviathan-addon

```
# 🐳 Avvia Leviathan tramite Docker Compose

```bash
docker compose up -d --build

```

> [!TIP]
> **Status Operativo:**
> * ✔️ **Full Auto:** Avvio completamente automatizzato senza intervento umano.
> * ✔️ **Zero Config:** Nessuna configurazione manuale complessa richiesta.
> * ✔️ **High Performance:** Ideale per Server VPS, NAS e ambienti Home Lab 24/7.


---

## ⚖️ Legal Disclaimer & Liability Warning

> [!WARNING]
> **LEGGERE ATTENTAMENTE PRIMA DELL'USO**
>
> **1. Natura del Software**
> **Leviathan** è un motore di ricerca e *web scraper* automatizzato. Funziona esclusivamente come aggregatore di metadati già disponibili pubblicamente sul World Wide Web.
> * **Nessun File Ospitato:** Leviathan **NON** ospita, carica o gestisce alcun file video, torrent o contenuto protetto sui propri server.
> * **Solo Indicizzazione:** Il software si limita a processare testo HTML e restituire Magnet Link (hash) trovati su siti di terze parti, agendo come un comune browser o motore di ricerca (es. Google).
>
> **2. Scopo Educativo**
> Questo progetto è stato sviluppato esclusivamente per fini di **ricerca, studio dell'architettura web, parsing HTML e test di automazione**. Il codice sorgente è fornito "così com'è" per dimostrare capacità tecniche.
>
> **3. Responsabilità dell'Utente**
> L'autore del repository e i contributori non hanno alcun controllo su come l'utente finale utilizzerà questo software.
> * L'utente si assume la **piena ed esclusiva responsabilità** legale per l'utilizzo di Leviathan.
> * È responsabilità dell'utente verificare la conformità con le leggi locali sul copyright e sulla proprietà intellettuale (es. DMCA, EU Copyright Directive).
>
> **4. Divieto di Pirateria**
> **Scaricare e condividere opere protette da diritto d'autore senza autorizzazione è un reato.** L'autore condanna fermamente la pirateria informatica e non incoraggia, supporta o facilita in alcun modo la violazione del copyright.
>
> **Se non accetti queste condizioni, disinstalla e cancella immediatamente questo software.**

---

<div align="center"> <sub>Engineered with ❤️ & ☕ by the LUC4N3X</sub> </div>
