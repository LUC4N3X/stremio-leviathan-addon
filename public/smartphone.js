const mobileCSS = `
:root {
    --m-bg: #000000;
    --m-primary: #00f2ff;     /* Ciano Leviathan */
    --m-secondary: #5e17eb;   /* Deep Viola */
    --m-accent: #b026ff;      
    --m-amber: #ff9900;       
    --m-surface: rgba(10, 15, 25, 0.8);
    --m-surface-border: rgba(0, 242, 255, 0.2);
    --m-text: #e0f7fa;
    --m-dim: #6c8a9e;
    --m-error: #ff2a6d;       
    --m-success: #00ff9d;
    --safe-bottom: env(safe-area-inset-bottom);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; outline: none; user-select: none; }
body { 
    margin: 0; background-color: var(--m-bg); 
    font-family: 'Outfit', sans-serif; overflow: hidden; height: 100vh; color: var(--m-text); 
    position: relative; width: 100%;
}

/* --- LEVIATHAN OCEAN FX (GPU OPTIMIZED) --- */

/* 1. Base Abissale - Statico */
.m-bg-layer { 
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -5; 
    background: radial-gradient(circle at 50% 10%, #0f1c30 0%, #020408 60%, #000000 100%);
    transform: translateZ(0); /* Force GPU */
}

/* 2. Correnti Marine - Optimized Transform */
.m-ocean-flow {
    position: fixed; top: -50%; left: -50%; width: 200%; height: 200%; z-index: -4;
    background: radial-gradient(ellipse at center, rgba(0, 242, 255, 0.03) 0%, transparent 60%);
    opacity: 0.6;
    animation: oceanSwell 15s infinite alternate ease-in-out;
    pointer-events: none;
    will-change: transform, opacity;
    transform: translateZ(0);
}
@keyframes oceanSwell {
    0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.4; }
    100% { transform: translate3d(0, -20px, 0) scale(1.1); opacity: 0.7; }
}

/* 3. Caustiche (Luce) - HEAVILY OPTIMIZED */
/* Prima usava background-position (CPU), ora usa translate3d (GPU) */
.m-caustics {
    position: fixed; top: -50%; left: -50%; width: 200%; height: 200%; z-index: -4;
    background-image: 
        repeating-linear-gradient(45deg, transparent 0, transparent 20px, rgba(0, 242, 255, 0.02) 20px, rgba(0, 242, 255, 0.02) 40px),
        repeating-linear-gradient(-45deg, transparent 0, transparent 20px, rgba(112, 0, 255, 0.02) 20px, rgba(112, 0, 255, 0.02) 40px);
    background-size: 100% 100%;
    animation: glimmer 25s linear infinite; /* Rallentato leggermente per fluidità */
    pointer-events: none;
    will-change: transform;
    transform: translateZ(0);
}
@keyframes glimmer {
    0% { transform: translate3d(0, 0, 0) rotate(0deg); }
    100% { transform: translate3d(-20px, -20px, 0) rotate(2deg); }
}

/* 4. Bolle - Optimized */
.m-bubbles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -3; pointer-events: none; }
.bubble {
    position: absolute; bottom: -20px; background: rgba(0, 242, 255, 0.15); border-radius: 50%;
    box-shadow: 0 0 10px rgba(0, 242, 255, 0.1);
    animation: riseUp linear infinite;
    will-change: transform, opacity;
    transform: translateZ(0); /* GPU */
}
@keyframes riseUp {
    0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0; } 
    20% { opacity: 0.6; }
    80% { opacity: 0.4; } 
    100% { transform: translate3d(0, -110vh, 0) scale(1.5); opacity: 0; }
}

/* --- LAYOUT --- */
#app-container { display: flex; flex-direction: column; height: 100%; position: relative; z-index: 1; width: 100%; max-width: 100%; }

/* HEADER & PTR */
.m-ptr {
    position: absolute; top: -60px; left: 0; width: 100%; height: 60px;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 15px; color: var(--m-primary); z-index: 10;
    pointer-events: none; opacity: 0; transition: opacity 0.2s;
    will-change: transform;
}
.m-ptr-icon {
    font-size: 1.5rem; transition: transform 0.2s;
    background: rgba(0,0,0,0.8); padding: 8px; border-radius: 50%; border: 1px solid var(--m-primary);
    box-shadow: 0 0 15px var(--m-primary);
}
.m-ptr.loading .m-ptr-icon { animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* CONTENT WRAPPER */
.m-content-wrapper { flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; }
.m-content {
    flex: 1; overflow-y: scroll; overflow-x: hidden;
    padding: 0 15px 180px 15px;
    width: 100%; 
    -webkit-overflow-scrolling: touch; 
}

.m-page { display: none; width: 100%; }
.m-page.active { display: block; animation: fadeFast 0.3s ease-out; }
@keyframes fadeFast { from { opacity: 0; transform: translate3d(0, 10px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }

/* HERO */
.m-hero { text-align: center; padding: 25px 10px 15px 10px; display: flex; flex-direction: column; align-items: center; width: 100%; }
.m-logo-container {
    width: 120px; height: 120px; margin-bottom: 15px; border-radius: 50%; border: 2px solid rgba(0,242,255,0.4);
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.5); box-shadow: 0 0 30px rgba(0,242,255,0.2);
    backdrop-filter: blur(5px);
    will-change: transform;
}
.m-logo-img { width: 90%; height: 90%; object-fit: contain; border-radius: 50%; animation: rotateLogo 60s linear infinite; filter: drop-shadow(0 0 10px var(--m-primary)); }
@keyframes rotateLogo { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.m-brand-title {
    font-family: 'Rajdhani', sans-serif; font-size: 3rem; font-weight: 800; line-height: 1;
    background: linear-gradient(180deg, #fff 20%, var(--m-primary) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;
    filter: drop-shadow(0 0 10px rgba(0, 242, 255, 0.4));
}

/* SOTTOTITOLO CON LINEE RIPRISTINATE */
.m-brand-sub {
    font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; letter-spacing: 3px;
    color: var(--m-primary); text-transform: uppercase; margin-top: 8px; font-weight: 700; opacity: 0.9;
    display: flex; align-items: center; justify-content: center; width: 100%;
}
.m-brand-sub::before, .m-brand-sub::after { 
    content: ''; display: block; width: 30px; height: 2px; 
    background: linear-gradient(90deg, transparent, var(--m-primary)); 
    margin: 0 15px; opacity: 0.8; flex-shrink: 0; 
    box-shadow: 0 0 5px var(--m-primary);
}
.m-brand-sub::after {
    background: linear-gradient(90deg, var(--m-primary), transparent);
}


/* CARDS */
.m-card {
    background: rgba(10, 20, 30, 0.7);
    border: 1px solid var(--m-surface-border); border-radius: 16px;
    padding: 20px; margin-bottom: 16px; position: relative;
    box-shadow: 0 5px 20px rgba(0,0,0,0.5);
    /* No backdrop-filter on cards to save GPU on scroll */
}
.m-card.active-border { border-color: var(--m-primary); box-shadow: 0 0 20px rgba(0,242,255,0.15); background: rgba(10, 25, 35, 0.8); }
.m-card-accent { border-color: rgba(176, 38, 255, 0.4); background: rgba(20, 10, 35, 0.8); }

.m-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
.m-card-icon { color: var(--m-primary); font-size: 1.2rem; filter: drop-shadow(0 0 5px var(--m-primary)); }

/* INPUTS */
.m-input-group { position: relative; margin-bottom: 15px; }
.m-input {
    width: 100%; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
    padding: 16px; padding-right: 90px; color: var(--m-primary);
    font-family: 'Rajdhani', monospace; font-size: 1.05rem; font-weight: 700;
}
.m-input:focus { border-color: var(--m-primary); background: rgba(0,0,0,0.8); box-shadow: 0 0 15px rgba(0,242,255,0.1); }
#m-mfPass { padding-right: 20px !important; }

.m-tmdb-input { border-color: rgba(176, 38, 255, 0.3); color: var(--m-accent); }
.m-paste-btn {
    position: absolute; right: 6px; top: 6px; bottom: 6px;
    background: rgba(255,255,255,0.08); color: var(--m-primary);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
    padding: 0 14px; display: flex; align-items: center; justify-content: center; gap: 5px;
    font-size: 0.8rem; font-weight: 700; font-family: 'Rajdhani', sans-serif;
}

/* TABS */
.m-tabs-row { display: flex; gap: 8px; margin-bottom: 20px; background: rgba(0,0,0,0.5); padding: 4px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); }
.m-tab-btn { flex: 1; text-align: center; padding: 12px; font-size: 0.85rem; color: var(--m-dim); font-weight: 700; border-radius: 10px; transition: 0.2s; font-family: 'Rajdhani', sans-serif; text-transform: uppercase; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.m-tab-icon { font-size: 1.2rem; filter: grayscale(1); }
.m-tab-btn.active { background: linear-gradient(135deg, rgba(0, 242, 255, 0.2), rgba(112, 0, 255, 0.1)); color: #fff; border: 1px solid var(--m-primary); }
.m-tab-btn.active .m-tab-icon { filter: grayscale(0) drop-shadow(0 0 5px #fff); }

/* ANIMAZIONE ROTAZIONE 3D PER LE ICONE */
@keyframes spin3D {
    0% { transform: perspective(400px) rotateY(0deg); }
    40% { transform: perspective(400px) rotateY(180deg); }
    100% { transform: perspective(400px) rotateY(360deg); }
}
.m-spin-effect { animation: spin3D 0.6s ease-in-out; }

/* WARNING BOX */
.m-ad-warning { display: none; background: rgba(255, 42, 109, 0.1); border: 1px solid var(--m-error); border-radius: 10px; padding: 10px; margin-bottom: 20px; text-align: center; color: var(--m-error); font-size: 0.8rem; font-weight: 700; }

/* ROWS & SWITCHES */
.m-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 10px; }
.m-row:last-child { border-bottom: none; }
.m-label { flex: 1; min-width: 0; padding-right: 5px; }
.m-label h4 { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 1rem; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 700; }
.m-label p { margin: 4px 0 0; font-size: 0.8rem; color: var(--m-dim); font-weight: 400; line-height: 1.2; }

.m-status-text { font-size: 0.65rem; padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #777; white-space: nowrap; }
.m-status-text.on { background: rgba(0, 255, 157, 0.15); color: var(--m-success); border: 1px solid rgba(0, 255, 157, 0.3); box-shadow: 0 0 5px rgba(0,255,157,0.2); }

.m-switch { position: relative; width: 48px; height: 26px; flex-shrink: 0; }
.m-switch input { opacity: 0; width: 0; height: 0; }
.m-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: #1a1a1a; border-radius: 34px; transition: .3s; border: 1px solid #444; }
.m-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: #888; border-radius: 50%; transition: .3s; }
input:checked + .m-slider { background-color: rgba(0,242,255,0.25); border-color: var(--m-primary); }
input:checked + .m-slider:before { transform: translateX(22px); background-color: var(--m-primary); box-shadow: 0 0 8px var(--m-primary); }

.m-slider-purple { background-color: #1a1a1a; }
input:checked + .m-slider-purple { background-color: rgba(176, 38, 255, 0.25); border-color: var(--m-accent); }
input:checked + .m-slider-purple:before { background-color: var(--m-accent); box-shadow: 0 0 8px var(--m-accent); }

.m-slider-amber { background-color: #1a1a1a; }
input:checked + .m-slider-amber { background-color: rgba(255, 153, 0, 0.25); border-color: var(--m-amber); }
input:checked + .m-slider-amber:before { background-color: var(--m-amber); box-shadow: 0 0 8px var(--m-amber); }

/* PRIORITY PANEL */
.m-priority-wrapper { max-height: 0; opacity: 0; overflow: hidden; transition: all 0.3s ease; margin: 0 -10px; }
.m-priority-wrapper.show { max-height: 120px; opacity: 1; margin-top: 15px; padding: 0 10px; }
.m-priority-box { background: rgba(112, 0, 255, 0.1); border: 1px solid rgba(112, 0, 255, 0.3); border-left: 3px solid var(--m-secondary); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; }
.m-priority-info { display: flex; align-items: center; gap: 10px; }
.m-priority-text h5 { margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: #fff; text-transform: uppercase; }

/* GATE & SLIDERS */
.m-gate-wrapper { width: 100%; overflow: hidden; max-height: 0; opacity: 0; transition: all 0.3s ease; }
.m-gate-wrapper.show { max-height: 60px; opacity: 1; margin-top: 10px; }
.m-gate-control { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
.m-range { -webkit-appearance: none; width: 100%; height: 4px; background: #333; border-radius: 2px; }
.m-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5); }

.m-q-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 15px; }
.m-q-item { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--m-dim); padding: 10px 0; text-align: center; border-radius: 8px; font-size: 0.8rem; font-weight: 700; font-family: 'Rajdhani', sans-serif; }
.m-q-item.excluded { border-color: var(--m-error); color: var(--m-error); opacity: 0.5; text-decoration: line-through; background: rgba(255, 42, 109, 0.1); }

/* FOOTER */
.m-credits-section { margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; align-items: center; gap: 15px; }
.m-faq-btn { width: 100%; padding: 12px; background: transparent; border: 1px dashed rgba(255,255,255,0.3); color: var(--m-text); border-radius: 10px; font-family: 'Rajdhani', sans-serif; font-weight: 700; display: flex; justify-content: center; align-items: center; gap: 8px; }
.m-commander-link { text-decoration: none; display: inline-flex; align-items: center; gap: 10px; background: rgba(0, 5, 10, 0.8); border: 1px solid rgba(112,0,255,0.3); padding: 6px 20px 6px 6px; border-radius: 50px; box-shadow: 0 0 15px rgba(0,0,0,0.5); }
.m-cmd-avatar { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--m-primary); object-fit: cover; }
.m-cmd-info { display: flex; flex-direction: column; justify-content: center; line-height: 1; }
.m-cmd-name { font-size: 1rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif; }
.m-donate-btn { text-decoration: none; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); padding: 10px 25px; border-radius: 30px; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; }

/* DOCK */
.m-dock-container { position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(2, 5, 10, 0.95); border-top: 1px solid rgba(0,242,255,0.1); z-index: 100; display: flex; flex-direction: column; padding-bottom: var(--safe-bottom); box-shadow: 0 -10px 30px rgba(0,0,0,0.8); }
.m-dock-actions { display: flex; gap: 10px; padding: 10px 15px 5px 15px; }
.m-btn-install { flex: 3; background: linear-gradient(90deg, var(--m-primary), var(--m-secondary)); color: #000; border: none; border-radius: 10px; height: 46px; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 0 15px rgba(0,242,255,0.2); }
.m-btn-copy { flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 10px; height: 46px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; font-size: 0.65rem; font-weight: 700; }
.m-dock-nav { display: flex; justify-content: space-around; align-items: center; padding: 6px 0 8px 0; }
.m-nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--m-dim); width: 80px; transition: 0.2s; }
.m-nav-item i { font-size: 1.2rem; }
.m-nav-item span { font-size: 0.6rem; font-weight: 700; font-family: 'Rajdhani', sans-serif; }
.m-nav-item.active { color: var(--m-primary); text-shadow: 0 0 5px var(--m-primary); }

/* MODAL */
.m-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 200; display: none; padding: 20px; flex-direction: column; backdrop-filter: blur(5px); }
.m-modal.show { display: flex; }
.m-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.m-modal-title { font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: var(--m-primary); font-weight: 800; }
.m-faq-content { overflow-y: auto; flex: 1; }
.m-faq-item { border-bottom: 1px solid rgba(255,255,255,0.05); padding: 12px 0; }
.m-faq-q { font-weight: 700; color: #fff; font-size: 0.95rem; margin-bottom: 5px; }
.m-faq-a { font-size: 0.85rem; color: var(--m-dim); line-height: 1.4; display: none; margin-top: 8px; }
.m-faq-item.open .m-faq-a { display: block; }
`;

const mobileHTML = `
<div class="m-bg-layer"></div>
<div class="m-ocean-flow"></div>
<div class="m-caustics"></div>
<div class="m-bubbles" id="m-bubbles"></div>

<div id="app-container">
    <div class="m-content-wrapper">
        <div class="m-ptr" id="m-ptr-indicator"><i class="fas fa-arrow-down m-ptr-icon"></i></div>

        <div class="m-content">
            <div class="m-hero">
                <div class="m-logo-container"><img src="https://i.ibb.co/jvTQLbjb/Gemini-Generated-Image-51j2ce51j2ce51j2-1.png" class="m-logo-img"></div>
                <h1 class="m-brand-title">LEVIATHAN</h1>
                <div class="m-brand-sub">SOVRANO DEGLI ABISSI</div>
            </div>

            <div id="page-setup" class="m-page active">
                <div class="m-tabs-row">
                    <div class="m-tab-btn active" onclick="setMService('rd', this)"><span class="m-tab-icon">🚀</span> RD</div>
                    <div class="m-tab-btn" onclick="setMService('ad', this)"><span class="m-tab-icon">🦅</span> AD</div>
                    <div class="m-tab-btn" onclick="setMService('tb', this)"><span class="m-tab-icon">📦</span> TB</div>
                </div>

                <div id="m-ad-warn" class="m-ad-warning"><i class="fas fa-exclamation-triangle"></i> ATTENZIONE: AllDebrid funziona SOLO se hostato in LOCALE.</div>

                <div class="m-card active-border">
                    <div class="m-card-header"><i class="fas fa-key m-card-icon"></i> Debrid API Key</div>
                    <div class="m-input-group">
                        <input type="text" id="m-apiKey" class="m-input" placeholder="Incolla la tua chiave...">
                        <div class="m-paste-btn" onclick="pasteTo('m-apiKey')"><i class="fas fa-paste"></i> PASTE</div>
                    </div>
                    <div class="m-row" style="padding: 5px 0 0;">
                        <div class="m-label"><h4 style="color:var(--m-primary)">Non hai la chiave?</h4><p>Vai al sito ufficiale</p></div>
                        <button class="m-paste-btn" style="position:static; width:auto; border-color:rgba(255,255,255,0.2)" onclick="openApiPage()"><i class="fas fa-external-link-alt"></i> OTTIENI</button>
                    </div>
                </div>

                <div class="m-card m-card-accent">
                     <div class="m-card-header"><i class="fas fa-database m-card-icon" style="color:var(--m-accent)"></i> TMDB API (Opzionale)</div>
                     <div class="m-input-group">
                        <input type="text" id="m-tmdb" class="m-input m-tmdb-input" placeholder="Chiave TMDB Personale">
                        <div class="m-paste-btn" style="color:var(--m-accent); border-color:rgba(176, 38, 255, 0.3)" onclick="pasteTo('m-tmdb')"><i class="fas fa-paste"></i> PASTE</div>
                    </div>
                    <p style="font-size:0.75rem; color:var(--m-dim); margin-top:5px;">Migliora i metadati. Se vuoto usa default.</p>
                </div>

                <div class="m-card">
                    <div class="m-card-header"><i class="fas fa-globe m-card-icon"></i> Sorgenti Web</div>
                    
                    <div class="m-row">
                        <div class="m-label">
                            <h4>
                                <i class="fas fa-play-circle" style="color:var(--m-secondary);"></i> 
                                SC 
                                <span class="m-status-text" id="st-vix">OFF</span>
                            </h4>
                            <p>(StreamingCommunity) • Scraper Veloce</p>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-enableVix" onchange="updateStatus('m-enableVix','st-vix')">
                            <span class="m-slider"></span>
                        </label>
                    </div>

                    <div id="m-sc-options" style="display:none; margin-top:15px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:15px;">
                        <p style="font-size:0.7rem; color:var(--m-dim); margin-bottom:10px; text-transform:uppercase; font-weight:700; letter-spacing:1px; text-align:center;">QUALITÀ STREAMINGCOMMUNITY</p>
                        <div class="m-tabs-row" style="margin-bottom:0; background:rgba(0,0,0,0.3);">
                            <div class="m-tab-btn active" id="mq-sc-all" onclick="setScQuality('all')">Hybrid</div>
                            <div class="m-tab-btn" id="mq-sc-1080" onclick="setScQuality('1080')">1080p</div>
                            <div class="m-tab-btn" id="mq-sc-720" onclick="setScQuality('720')">720p</div>
                        </div>
                    </div>

                    <div class="m-row" style="margin-top:10px;">
                        <div class="m-label">
                            <h4>
                                <i class="fas fa-film" style="color:var(--m-primary);"></i> 
                                GuardaHD 
                                <span class="m-status-text" id="st-ghd">OFF</span>
                            </h4>
                            <p style="color:var(--m-primary);">Richiede <u>MediaFlow Proxy</u></p>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-enableGhd" onchange="updateStatus('m-enableGhd','st-ghd')">
                            <span class="m-slider"></span>
                        </label>
                    </div>

                    <div class="m-row">
                        <div class="m-label">
                            <h4>
                                <i class="fas fa-tv" style="color:var(--m-accent);"></i> 
                                GuardaSerie 
                                <span class="m-status-text" id="st-gs">OFF</span>
                            </h4>
                            <p style="color:var(--m-accent);">Richiede <u>MediaFlow Proxy</u></p>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-enableGs" onchange="updateStatus('m-enableGs','st-gs')">
                            <span class="m-slider m-slider-purple"></span>
                        </label>
                    </div>

                    <div id="m-priority-panel" class="m-priority-wrapper">
                        <div class="m-priority-box">
                            <div class="m-priority-info">
                                <i class="fas fa-sort-amount-down m-priority-icon"></i>
                                <div class="m-priority-text">
                                    <h5>Gerarchia Sorgenti</h5>
                                    <p id="priority-desc">Priorità Alta: Risultati in cima</p>
                                </div>
                            </div>
                            <label class="m-switch">
                                <input type="checkbox" id="m-vixLast" onchange="updatePriorityLabel()">
                                <span class="m-slider" style="border-color:var(--m-secondary)"></span>
                            </label>
                        </div>
                    </div>

                </div>

                <div class="m-credits-section">
                    <button class="m-faq-btn" onclick="openFaq()"><i class="fas fa-question-circle"></i> FAQ DATABASE</button>
                    <a href="https://github.com/LUC4N3X/stremio-leviathan-addon" target="_blank" class="m-commander-link">
                        <img src="https://i.ibb.co/gLkrjxXT/Whats-App-Image-2026-01-12-at-20-15-37.jpg" alt="LUC4N3X" class="m-cmd-avatar">
                        <div class="m-cmd-info"><span class="m-cmd-label">SYSTEM COMMANDER</span><span class="m-cmd-name">LUC4N3X</span></div>
                    </a>
                    <a href="https://www.paypal.me/luc4nex" target="_blank" class="m-donate-btn"><i class="fas fa-mug-hot" style="color:var(--m-error)"></i> OFFRIMI UN CAFFÈ</a>
                    <div style="height:30px;"></div> 
                </div>
            </div>

            <div id="page-filters" class="m-page">
            
                <div class="m-card m-card-accent" style="border-color: rgba(0, 242, 255, 0.5);">
                    <div class="m-card-header">
                        <i class="fas fa-sort-amount-up m-card-icon" style="color:#fff"></i> Flux Priority
                    </div>
                    <p style="font-size:0.85rem; color:#ccc; margin-bottom:15px;">Scegli il criterio principale per ordinare la lista dei risultati.</p>
                    <div class="m-tabs-row" style="background:rgba(0,0,0,0.6);">
                        <div class="m-tab-btn active" id="sort-balanced" onclick="setSortMode('balanced')"><span class="m-tab-icon">🦑</span> LEVIATHAN</div>
                        <div class="m-tab-btn" id="sort-resolution" onclick="setSortMode('resolution')"><span class="m-tab-icon">💎</span> QUALITY</div>
                        <div class="m-tab-btn" id="sort-size" onclick="setSortMode('size')"><span class="m-tab-icon">💾</span> SIZE</div>
                    </div>
                </div>

                <div class="m-card">
                    <div class="m-card-header"><i class="fas fa-filter m-card-icon" style="color:var(--m-error)"></i> Filtro Qualità</div>
                    <p style="font-size:0.85rem; color:#fff; margin-bottom:10px; font-weight:300;">Tocca per <b>ESCLUDERE</b> le risoluzioni:</p>
                    <div class="m-q-grid">
                        <div class="m-q-item" id="mq-4k" onclick="toggleFilter('mq-4k')">4K UHD</div>
                        <div class="m-q-item" id="mq-1080" onclick="toggleFilter('mq-1080')">1080p</div>
                        <div class="m-q-item" id="mq-720" onclick="toggleFilter('mq-720')">720p</div>
                        <div class="m-q-item" id="mq-sd" onclick="toggleFilter('mq-sd')">SD/CAM</div>
                    </div>
                </div>

                <div class="m-card">
                    <div class="m-card-header"><i class="fas fa-microchip m-card-icon"></i> Sistema</div>
                    
                    <div class="m-row">
                        <div class="m-label">
                            <h4>
                                <i class="fas fa-globe-americas" style="color:var(--m-primary)"></i>
                                Lingua Inglese 
                                <span class="m-status-text" id="st-eng">OFF</span>
                            </h4>
                            <p>Cerca anche audio ENG</p>
                        </div>
                        <label class="m-switch"><input type="checkbox" id="m-allowEng" onchange="updateStatus('m-allowEng','st-eng')"><span class="m-slider"></span></label>
                    </div>

                    <div class="m-row">
                        <div class="m-label">
                            <h4>
                                <i class="fas fa-layer-group" style="color:var(--m-accent)"></i>
                                AIO Mode 
                                <span class="m-status-text" id="st-aio">OFF</span>
                            </h4>
                            <p style="color:var(--m-secondary)">Formatta per AIOStreams</p>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-aioMode" onchange="updateStatus('m-aioMode','st-aio')">
                            <span class="m-slider m-slider-purple"></span>
                        </label>
                    </div>

                     <div class="m-row">
                        <div class="m-label">
                            <h4>
                                <i class="fas fa-compress-arrows-alt" style="color:var(--m-error)"></i>
                                Signal Gate 
                                <span class="m-status-text" id="st-gate">OFF</span>
                            </h4>
                            <p>Limita risultati per qualità</p>
                        </div>
                        <label class="m-switch"><input type="checkbox" id="m-gateActive" onchange="toggleGate()"><span class="m-slider"></span></label>
                    </div>
                    
                    <div id="m-gate-wrapper" class="m-gate-wrapper">
                        <div class="m-gate-control">
                            <span style="font-size:0.8rem; color:#666;">1</span>
                            <input type="range" min="1" max="20" value="3" class="m-range" id="m-gateVal" oninput="updateGateDisplay(this.value)">
                            <span style="font-size:0.8rem; color:#666;">20</span>
                            <span style="font-family:'Rajdhani'; font-weight:800; font-size:1.2rem; color:var(--m-primary); width:30px; text-align:center;" id="m-gate-display">3</span>
                        </div>
                    </div>

                    <div class="m-row">
                        <div class="m-label">
                            <h4>
                                <i class="fas fa-weight-hanging" style="color:var(--m-amber)"></i>
                                Limite Peso
                                <span class="m-status-text" id="st-size">OFF</span>
                            </h4>
                            <p style="color:var(--m-amber)">Escludi file enormi (GB)</p>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-sizeActive" onchange="toggleSize()">
                            <span class="m-slider m-slider-amber"></span>
                        </label>
                    </div>
                    
                    <div id="m-size-wrapper" class="m-gate-wrapper">
                        <div class="m-gate-control">
                            <span style="font-size:0.8rem; color:#666;">1GB</span>
                            <input type="range" min="1" max="100" step="1" value="0" class="m-range" id="m-sizeVal" oninput="updateSizeDisplay(this.value)" style="background:linear-gradient(90deg, #ff9900, #333)">
                            <span style="font-family:'Rajdhani'; font-weight:800; font-size:1.1rem; color:var(--m-amber); width:45px; text-align:center;" id="m-size-display">∞</span>
                        </div>
                    </div>

                </div>
            </div>

            <div id="page-network" class="m-page">
                <div class="m-card" style="border-color: rgba(112,0,255,0.4)">
                    <div class="m-card-header"><i class="fas fa-network-wired m-card-icon" style="color:var(--m-secondary)"></i> MEDIAFLOW PROXY</div>
                    <p style="font-size:0.8rem; color:var(--m-dim); margin-bottom:15px; line-height:1.4;">Bridge essenziale per <b>GuardaHD/GuardaSerie</b> e per la protezione IP <b>Debrid Ghost</b>.</p>
                    
                    <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
                        <div class="m-input-group" style="margin-bottom:10px;">
                            <input type="text" id="m-mfUrl" class="m-input" placeholder="URL Server Proxy">
                            <div class="m-paste-btn" onclick="pasteTo('m-mfUrl')"><i class="fas fa-paste"></i> PASTE</div>
                        </div>
                        <div class="m-input-group" style="margin-bottom:0;">
                            <input type="password" id="m-mfPass" class="m-input" placeholder="Password (Opzionale)">
                        </div>
                    </div>
                    
                    <div class="m-row" style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:15px; margin-top:15px;">
                        <div class="m-label"><h4>Debrid Ghost <span class="m-status-text" id="st-ghost">OFF</span></h4><p>Maschera IP tramite Proxy</p></div>
                        <label class="m-switch"><input type="checkbox" id="m-proxyDebrid" onchange="updateStatus('m-proxyDebrid','st-ghost')"><span class="m-slider" style="border-color:var(--m-secondary)"></span></label>
                    </div>
                </div>
            </div>
        </div> 
    </div>

    <div id="m-faq-modal" class="m-modal">
        <div class="m-modal-header"><div class="m-modal-title">DATABASE FAQ</div><div class="m-close-icon" onclick="closeFaq()"><i class="fas fa-times"></i></div></div>
        <div class="m-faq-content">
            <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">Come funziona? <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">Leviathan scansiona le profondità del web per trovare Torrent e flussi StreamingCommunity ad alta velocità.</div></div>
            <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">MediaFlow & GuardaHD/GS <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">GuardaHD e GuardaSerie richiedono un Proxy. Inserisci URL e Password del tuo MediaFlow Server nel modulo "Network".</div></div>
            <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">Cos'è il Cache Builder? <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">Mostra Torrent NON ancora scaricati su Debrid. Cliccandoli, avvierai il download.</div></div>
             <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">Ghost Shell Mode <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">Debrid Ghost instrada le richieste Debrid tramite il proxy MediaFlow, nascondendo il tuo IP.</div></div>
        </div>
    </div>

    <div class="m-dock-container">
        <div class="m-dock-actions">
            <button class="m-btn-install" onclick="mobileInstall()"><i class="fas fa-download"></i> INSTALLA ADDON</button>
            <button class="m-btn-copy" onclick="mobileCopyLink()"><i class="fas fa-link"></i><span>COPIA</span></button>
        </div>
        <div class="m-dock-nav">
            <div class="m-nav-item active" onclick="navTo('setup', this)"><i class="fas fa-sliders-h"></i><span>SETUP</span></div>
            <div class="m-nav-item" onclick="navTo('filters', this)"><i class="fas fa-filter"></i><span>FILTRI</span></div>
            <div class="m-nav-item" onclick="navTo('network', this)"><i class="fas fa-globe"></i><span>NET</span></div>
        </div>
    </div>
</div>
`;

// --- LOGIC ---

let mCurrentService = 'rd';
let mScQuality = 'all';
let mSortMode = 'balanced';

function createBubbles() {
    const container = document.getElementById('m-bubbles');
    if(!container) return;
    // 12 Bolle per bilanciare effetto e performance
    for(let i=0; i<12; i++) {
        const b = document.createElement('div');
        b.classList.add('bubble');
        const size = Math.random() * 8 + 3;
        b.style.width = `${size}px`; b.style.height = `${size}px`;
        b.style.left = `${Math.random() * 100}%`;
        b.style.animationDuration = `${Math.random() * 15 + 10}s`; // Più lente
        b.style.animationDelay = `-${Math.random() * 20}s`;
        container.appendChild(b);
    }
}

function initMobileInterface() {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = mobileCSS;
    document.head.appendChild(styleSheet);
    document.body.innerHTML = mobileHTML;
    createBubbles();
    initPullToRefresh();
    loadMobileConfig();
}

// --- OPTIMIZED PTR (REQUEST ANIMATION FRAME) ---
function initPullToRefresh() {
    const content = document.querySelector('.m-content');
    const ptr = document.getElementById('m-ptr-indicator');
    const icon = ptr.querySelector('i');
    let startY = 0;
    let pulling = false;
    let threshold = 80;
    let rAF = null;

    content.addEventListener('touchstart', (e) => {
        if (content.scrollTop === 0) { startY = e.touches[0].pageY; pulling = true; }
    }, {passive: true});

    content.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const currentY = e.touches[0].pageY;
        const diff = currentY - startY;

        if (diff > 0 && content.scrollTop <= 0) {
            // Usa requestAnimationFrame per non bloccare il thread principale
            if (rAF) return;
            rAF = requestAnimationFrame(() => {
                ptr.style.opacity = Math.min(diff / 100, 1);
                const move = Math.min(diff * 0.4, 80); 
                ptr.style.transform = `translate3d(0, ${move}px, 0)`;
                icon.style.transform = `rotate(${move * 3}deg)`;
                
                if (diff > threshold) { 
                    icon.classList.remove('fa-arrow-down'); 
                    icon.classList.add('fa-sync-alt'); 
                } else { 
                    icon.classList.remove('fa-sync-alt'); 
                    icon.classList.add('fa-arrow-down'); 
                }
                rAF = null;
            });
        }
    }, {passive: true});

    content.addEventListener('touchend', (e) => {
        if (!pulling) return;
        pulling = false;
        const currentY = e.changedTouches[0].pageY;
        const diff = currentY - startY;
        
        if (diff > threshold && content.scrollTop <= 0) {
            ptr.classList.add('loading');
            ptr.style.transform = `translate3d(0, 50px, 0)`;
            if (navigator.vibrate) navigator.vibrate(50);
            setTimeout(() => { location.reload(); }, 500);
        } else {
            ptr.style.transform = ''; ptr.style.opacity = 0;
        }
        if(rAF) { cancelAnimationFrame(rAF); rAF = null; }
    });
}

function navTo(pageId, btn) {
    document.querySelectorAll('.m-page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    document.querySelectorAll('.m-nav-item').forEach(i => i.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

function setMService(srv, btn, keepInput = false) {
    if(mCurrentService === srv && !keepInput) return;
    mCurrentService = srv;
    
    // RESET API KEY: SOLO se NON stiamo forzando il caricamento configurazione
    if (!keepInput) {
        document.getElementById('m-apiKey').value = '';
    }

    document.querySelectorAll('.m-tab-btn').forEach(t => t.parentElement.classList.contains('m-tabs-row') && !t.id ? t.classList.remove('active') : null);
    if(btn) {
        btn.classList.add('active');
        // --- ANIMAZIONE ROTAZIONE ---
        const icon = btn.querySelector('.m-tab-icon');
        if(icon) {
            icon.classList.remove('m-spin-effect');
            void icon.offsetWidth; // Force Reflow
            icon.classList.add('m-spin-effect');
        }
    }
    const input = document.getElementById('m-apiKey');
    const placeholders = { 'rd': "RD API Key...", 'ad': "AD API Key...", 'tb': "TB API Key..." };
    input.placeholder = placeholders[srv];
    const warn = document.getElementById('m-ad-warn');
    if(warn) warn.style.display = (srv === 'ad') ? 'block' : 'none';
}

function updateStatus(inputId, statusId) {
    const chk = document.getElementById(inputId).checked;
    const lbl = document.getElementById(statusId);
    if(!lbl) return;
    lbl.innerText = chk ? "ON" : "OFF";
    if(chk) lbl.classList.add('on'); else lbl.classList.remove('on');
    
    if(inputId === 'm-enableVix') toggleScOptions();
    checkWebPriorityVisibility();
    if(navigator.vibrate) navigator.vibrate(10);
}

function checkWebPriorityVisibility() {
    const vix = document.getElementById('m-enableVix').checked;
    const ghd = document.getElementById('m-enableGhd').checked;
    const gs = document.getElementById('m-enableGs').checked;
    const panel = document.getElementById('m-priority-panel');
    if (vix || ghd || gs) panel.classList.add('show');
    else panel.classList.remove('show');
}

function updatePriorityLabel() {
    const isLast = document.getElementById('m-vixLast').checked;
    const desc = document.getElementById('priority-desc');
    desc.innerText = isLast ? "Priorità Bassa: Risultati dopo i Torrent" : "Priorità Alta: Risultati in cima";
    desc.style.color = isLast ? "var(--m-secondary)" : "var(--m-primary)";
    if(navigator.vibrate) navigator.vibrate([15, 10, 15]);
}

function toggleScOptions() {
    const chk = document.getElementById('m-enableVix').checked;
    document.getElementById('m-sc-options').style.display = chk ? 'block' : 'none';
    const lbl = document.getElementById('st-vix');
    if(lbl) {
        lbl.innerText = chk ? "ON" : "OFF";
        if(chk) lbl.classList.add('on'); else lbl.classList.remove('on');
    }
    checkWebPriorityVisibility(); 
}

function toggleGate() {
    const active = document.getElementById('m-gateActive').checked;
    const wrapper = document.getElementById('m-gate-wrapper');
    const lbl = document.getElementById('st-gate');
    if(active) { wrapper.classList.add('show'); lbl.innerText = "ON"; lbl.classList.add('on'); } 
    else { wrapper.classList.remove('show'); lbl.innerText = "OFF"; lbl.classList.remove('on'); }
}

function updateGateDisplay(val) { document.getElementById('m-gate-display').innerText = val; }

function toggleSize() {
    const active = document.getElementById('m-sizeActive').checked;
    const wrapper = document.getElementById('m-size-wrapper');
    const lbl = document.getElementById('st-size');
    const slider = document.getElementById('m-sizeVal');
    
    if(active) { 
        wrapper.classList.add('show'); 
        lbl.innerText = "ON"; 
        lbl.classList.add('on');
        updateSizeDisplay(slider.value);
    } else { 
        wrapper.classList.remove('show'); 
        lbl.innerText = "OFF"; 
        lbl.classList.remove('on');
        document.getElementById('m-size-display').innerText = "∞";
    }
}

function updateSizeDisplay(val) {
    const display = document.getElementById('m-size-display');
    if (val == 0) {
        display.innerText = "∞";
    } else {
        display.innerText = val;
    }
}

function openApiPage() {
    const links = { 'rd': 'https://real-debrid.com/apitoken', 'ad': 'https://alldebrid.com/apikeys', 'tb': 'https://torbox.app/settings' };
    window.open(links[mCurrentService], '_blank');
}
function setScQuality(val) {
    mScQuality = val;
    ['all','1080','720'].forEach(q => document.getElementById('mq-sc-'+q).classList.remove('active'));
    document.getElementById('mq-sc-' + val).classList.add('active');
}
// --- FLUX PRIORITY LOGIC ---
function setSortMode(mode) {
    mSortMode = mode;
    ['balanced', 'resolution', 'size'].forEach(m => {
        const btn = document.getElementById('sort-' + m);
        if(m === mode) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

function toggleFilter(id) { document.getElementById(id).classList.toggle('excluded'); }

function openFaq() { const m = document.getElementById('m-faq-modal'); m.classList.add('show'); }
function closeFaq() { document.getElementById('m-faq-modal').classList.remove('show'); }
function toggleFaqItem(item) { item.classList.toggle('open'); }

async function pasteTo(id) {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById(id).value = text;
        const btn = document.querySelector(`#${id}`).parentElement.querySelector('.m-paste-btn');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-paste"></i> PASTE', 1500);
    } catch (err) { alert("Impossibile accedere agli appunti. Incolla manualmente."); }
}

function loadMobileConfig() {
    try {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length >= 2 && pathParts[1].length > 10) {
            const config = JSON.parse(atob(pathParts[1]));
            if(config.service) {
                const tabs = document.querySelectorAll('.m-tab-btn');
                const srvMap = {'rd':0, 'ad':1, 'tb':2};
                
                // Chiama setMService con true per NON cancellare l'input
                if(srvMap[config.service] !== undefined) {
                    setMService(config.service, tabs[srvMap[config.service]], true);
                }
                const warn = document.getElementById('m-ad-warn');
                if(warn) warn.style.display = (config.service === 'ad') ? 'block' : 'none';
            }
            if(config.key) document.getElementById('m-apiKey').value = config.key;

            if(config.tmdb) document.getElementById('m-tmdb').value = config.tmdb;
            if(config.aiostreams_mode) document.getElementById('m-aioMode').checked = true;
            
            // LOAD SORT MODE
            if(config.sort) setSortMode(config.sort);
            else setSortMode('balanced');

            if(config.mediaflow) {
                document.getElementById('m-mfUrl').value = config.mediaflow.url || "";
                document.getElementById('m-mfPass').value = config.mediaflow.pass || "";
                document.getElementById('m-proxyDebrid').checked = config.mediaflow.proxyDebrid || false;
            }
            if(config.filters) {
                document.getElementById('m-enableVix').checked = config.filters.enableVix || false;
                document.getElementById('m-enableGhd').checked = config.filters.enableGhd || false;
                document.getElementById('m-enableGs').checked = config.filters.enableGs || false;
                document.getElementById('m-allowEng').checked = config.filters.allowEng || false;
                
                
                if(config.filters.vixLast) {
                    document.getElementById('m-vixLast').checked = true;
                    updatePriorityLabel();
                }

                const qMap = {'no4k':'mq-4k', 'no1080':'mq-1080', 'no720':'mq-720', 'noScr':'mq-sd'};
                for(let k in qMap) if(config.filters[k]) document.getElementById(qMap[k]).classList.add('excluded');
                if(config.filters.scQuality) setScQuality(config.filters.scQuality);
                
                if(config.filters.maxPerQuality && config.filters.maxPerQuality > 0) {
                    const val = config.filters.maxPerQuality;
                    document.getElementById('m-gateActive').checked = true;
                    document.getElementById('m-gateVal').value = val;
                    updateGateDisplay(val);
                    toggleGate();
                } else {
                    document.getElementById('m-gateActive').checked = false;
                    toggleGate();
                }

                if(config.filters.maxSizeGB && config.filters.maxSizeGB > 0) {
                    const valGB = config.filters.maxSizeGB;
                    document.getElementById('m-sizeActive').checked = true;
                    document.getElementById('m-sizeVal').value = valGB;
                    updateSizeDisplay(valGB);
                    toggleSize();
                } else {
                    document.getElementById('m-sizeActive').checked = false;
                    toggleSize();
                }
            }
            
            updateStatus('m-enableVix', 'st-vix');
            updateStatus('m-enableGhd', 'st-ghd');
            updateStatus('m-enableGs', 'st-gs');
            updateStatus('m-allowEng', 'st-eng');
            updateStatus('m-proxyDebrid', 'st-ghost');
            updateStatus('m-aioMode', 'st-aio');
            toggleScOptions();
            checkWebPriorityVisibility(); 
        }
    } catch(e) { console.log("No config loaded"); }
}

function getMobileConfig() {
    const gateActive = document.getElementById('m-gateActive').checked;
    const gateVal = parseInt(document.getElementById('m-gateVal').value);
    const sizeActive = document.getElementById('m-sizeActive').checked;
    const sizeVal = parseInt(document.getElementById('m-sizeVal').value);
    const finalMaxSizeGB = sizeActive ? sizeVal : 0;
    
    return {
        service: mCurrentService,
        key: document.getElementById('m-apiKey').value.trim(),
        tmdb: document.getElementById('m-tmdb').value.trim(),
        sort: mSortMode, 
        aiostreams_mode: document.getElementById('m-aioMode').checked,
        mediaflow: {
            url: document.getElementById('m-mfUrl').value.trim().replace(/\/$/, ""),
            pass: document.getElementById('m-mfPass').value.trim(),
            proxyDebrid: document.getElementById('m-proxyDebrid').checked
        },
        filters: {
            allowEng: document.getElementById('m-allowEng').checked,
            no4k: document.getElementById('mq-4k').classList.contains('excluded'),
            no1080: document.getElementById('mq-1080').classList.contains('excluded'),
            no720: document.getElementById('mq-720').classList.contains('excluded'),
            noScr: document.getElementById('mq-sd').classList.contains('excluded'),
            noCam: document.getElementById('mq-sd').classList.contains('excluded'),
            enableVix: document.getElementById('m-enableVix').checked,
            enableGhd: document.getElementById('m-enableGhd').checked,
            enableGs: document.getElementById('m-enableGs').checked,
            vixLast: document.getElementById('m-vixLast').checked,
            scQuality: mScQuality,
            maxPerQuality: gateActive ? gateVal : 0,
            maxSizeGB: finalMaxSizeGB > 0 ? finalMaxSizeGB : null
        }
    };
}

function mobileInstall() {
    const config = getMobileConfig();
    if(!config.key && !config.filters.enableVix && !config.filters.enableGhd && !config.filters.enableGs) {
        alert("⚠️ ERRORE: Inserisci una API Key o attiva una sorgente Web."); return;
    }
    const manifestUrl = `${window.location.host}/${btoa(JSON.stringify(config))}/manifest.json`;
    window.location.href = `stremio://${manifestUrl}`;
}

function mobileCopyLink() {
    const config = getMobileConfig();
    const manifestUrl = `${window.location.protocol}//${window.location.host}/${btoa(JSON.stringify(config))}/manifest.json`;
    const dummy = document.createElement("textarea");
    document.body.appendChild(dummy); dummy.value = manifestUrl; dummy.select(); document.execCommand("copy"); document.body.removeChild(dummy);
    
    const btn = document.querySelector('.m-btn-copy span');
    const icon = document.querySelector('.m-btn-copy i');
    const originalText = btn.innerText;
    
    btn.innerText = "FATTO!";
    icon.className = "fas fa-check";
    icon.style.color = "#00f2ff";
    
    setTimeout(() => { 
        btn.innerText = originalText;
        icon.className = "fas fa-link";
        icon.style.color = "";
    }, 2000);
}

initMobileInterface();
