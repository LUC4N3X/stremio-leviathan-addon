const mobileCSS = `
:root {
    --m-bg: #000000;
    --m-primary: #00f2ff;     /* Ciano Leviathan */
    --m-secondary: #aa00ff;   /* Viola Elettrico */
    --m-accent: #b026ff;      
    --m-amber: #ff9900;       /* Arancio/Oro per Size */
    --m-surface: rgba(10, 15, 25, 0.85); 
    --m-surface-border: rgba(0, 242, 255, 0.25);
    --m-text: #e0f7fa;
    --m-dim: #7a9ab5; 
    --m-error: #ff2a6d;       
    --m-success: #00ff9d;
    --safe-bottom: env(safe-area-inset-bottom);
    --m-glow: 0 0 12px rgba(0, 242, 255, 0.4); 
    --m-shadow-deep: 0 8px 32px rgba(0,0,0,0.6); 
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; outline: none; user-select: none; }
body { 
    margin: 0; background-color: var(--m-bg); 
    font-family: 'Outfit', sans-serif; overflow: hidden; height: 100vh; color: var(--m-text); 
    position: relative; width: 100%;
}

/* --- LEVIATHAN OCEAN FX --- */
.m-bg-layer { 
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -5; 
    background: radial-gradient(circle at 50% 20%, rgba(15, 28, 48, 0.8) 0%, #020408 50%, #000000 100%);
    transform: translateZ(0); box-shadow: inset 0 0 100px rgba(0,0,0,1);
}

.m-ocean-flow {
    position: fixed; top: -60%; left: -60%; width: 220%; height: 220%; z-index: -4;
    background: radial-gradient(ellipse at center, rgba(0, 242, 255, 0.05) 0%, transparent 70%);
    opacity: 0.65; animation: oceanSwell 18s infinite alternate ease-in-out;
    pointer-events: none; transform: translateZ(0); filter: blur(10px);
}
@keyframes oceanSwell {
    0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.45; }
    100% { transform: translate3d(0, -30px, 0) scale(1.15); opacity: 0.75; }
}

.m-caustics {
    position: fixed; top: -60%; left: -60%; width: 220%; height: 220%; z-index: -4;
    background-image: 
        repeating-linear-gradient(45deg, transparent 0, transparent 25px, rgba(0, 242, 255, 0.03) 25px, rgba(0, 242, 255, 0.03) 50px),
        repeating-linear-gradient(-45deg, transparent 0, transparent 25px, rgba(112, 0, 255, 0.03) 25px, rgba(112, 0, 255, 0.03) 50px),
        radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 50%);
    background-size: 200% 200%, 200% 200%, 100% 100%;
    animation: glimmer 30s linear infinite; pointer-events: none;
    transform: translateZ(0); mix-blend-mode: screen; opacity: 0.8;
}
@keyframes glimmer {
    0% { transform: translate3d(0, 0, 0) rotate(0deg); }
    100% { transform: translate3d(-30px, -30px, 0) rotate(3deg); }
}

.m-bubbles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -3; pointer-events: none; overflow: hidden; }
.bubble {
    position: absolute; bottom: -30px; background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(0, 242, 255, 0.1) 100%);
    border-radius: 50%; box-shadow: var(--m-glow), inset 0 0 5px rgba(255,255,255,0.3);
    animation: riseUp linear infinite; transform: translateZ(0); filter: blur(1px);
}
@keyframes riseUp {
    0% { transform: translate3d(0, 0, 0) scale(0.8); opacity: 0; } 
    15% { opacity: 0.7; }
    85% { opacity: 0.5; } 
    100% { transform: translate3d(0, -120vh, 0) scale(1.8); opacity: 0; }
}

/* --- LAYOUT --- */
#app-container { display: flex; flex-direction: column; height: 100%; position: relative; z-index: 1; width: 100%; max-width: 100%; }

.m-ptr {
    position: absolute; top: -60px; left: 0; width: 100%; height: 60px;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 15px; color: var(--m-primary); z-index: 10;
    pointer-events: none; opacity: 0; transition: opacity 0.25s ease-out;
}
.m-ptr-icon {
    font-size: 1.5rem; transition: transform 0.25s ease-in-out;
    background: rgba(0,0,0,0.85); padding: 10px; border-radius: 50%; border: 1px solid var(--m-primary);
    box-shadow: var(--m-glow), 0 0 20px rgba(0,242,255,0.3);
}
.m-ptr.loading .m-ptr-icon { animation: spin 1.2s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.m-content-wrapper { flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; }
.m-content {
    flex: 1; overflow-y: scroll; overflow-x: hidden;
    padding: 0 15px 180px 15px;
    width: 100%; -webkit-overflow-scrolling: touch; 
}

.m-page { display: none; width: 100%; }
.m-page.active { display: block; animation: fadeFast 0.35s ease-out; }
@keyframes fadeFast { from { opacity: 0; transform: translate3d(0, 15px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }

.m-hero { text-align: center; padding: 30px 10px 20px 10px; display: flex; flex-direction: column; align-items: center; width: 100%; }
.m-logo-container {
    width: 130px; height: 130px; margin-bottom: 20px; border-radius: 50%; border: 2px solid rgba(0,242,255,0.5);
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6); box-shadow: var(--m-shadow-deep), var(--m-glow);
    backdrop-filter: blur(8px); animation: pulseLogo 2s infinite alternate ease-in-out;
}
@keyframes pulseLogo { 0% { transform: scale(1); box-shadow: var(--m-glow); } 100% { transform: scale(1.05); box-shadow: 0 0 25px rgba(0,242,255,0.5); } }
.m-logo-img { width: 95%; height: 95%; object-fit: contain; border-radius: 50%; animation: rotateLogo 50s linear infinite; filter: drop-shadow(0 0 12px var(--m-primary)); }
@keyframes rotateLogo { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.m-brand-title {
    font-family: 'Rajdhani', sans-serif; font-size: 3.2rem; font-weight: 900; line-height: 1;
    background: linear-gradient(180deg, #ffffff 10%, var(--m-primary) 90%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;
    filter: drop-shadow(0 0 12px rgba(0, 242, 255, 0.5));
    text-shadow: 0 0 8px rgba(0,242,255,0.3);
}

.m-brand-sub {
    font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; letter-spacing: 3px;
    color: var(--m-primary); text-transform: uppercase; margin-top: 10px; font-weight: 700; opacity: 0.95;
    display: flex; align-items: center; justify-content: center; width: 100%;
    text-shadow: 0 0 6px var(--m-primary); white-space: nowrap;
}
.m-brand-sub::before, .m-brand-sub::after { 
    content: ''; display: block; width: 25px; height: 2px; 
    background: linear-gradient(90deg, transparent, var(--m-primary)); 
    margin: 0 10px; opacity: 0.85; flex-shrink: 0; box-shadow: 0 0 8px var(--m-primary);
}
.m-brand-sub::after { background: linear-gradient(90deg, var(--m-primary), transparent); }


/* CARDS STANDARD */
.m-card {
    background: var(--m-surface); border: 1px solid var(--m-surface-border); border-radius: 18px;
    padding: 22px; margin-bottom: 18px; position: relative;
    box-shadow: var(--m-shadow-deep); backdrop-filter: blur(10px);
}
.m-card.active-border { border-color: var(--m-primary); box-shadow: var(--m-shadow-deep), 0 0 25px rgba(0,242,255,0.2); background: rgba(10, 25, 35, 0.85); }
.m-card-accent { border-color: rgba(176, 38, 255, 0.5); background: rgba(20, 10, 35, 0.85); box-shadow: var(--m-shadow-deep), 0 0 25px rgba(176,38,255,0.2); }

/* --- CARD FLUX PRIORITY (FIGHISSIMA) --- */
.m-card-flux {
    background: linear-gradient(145deg, rgba(15, 20, 30, 0.9), rgba(0, 0, 5, 0.95));
    border: 1px solid rgba(0, 242, 255, 0.3);
    border-radius: 20px;
    padding: 25px 22px;
    margin-bottom: 20px;
    position: relative;
    box-shadow: 0 0 30px rgba(0, 242, 255, 0.1), inset 0 0 50px rgba(0, 242, 255, 0.05);
    overflow: hidden;
    backdrop-filter: blur(15px);
}
/* Bordo laterale neon */
.m-card-flux::before {
    content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
    background: linear-gradient(to bottom, var(--m-secondary), var(--m-primary));
    box-shadow: 0 0 15px var(--m-primary);
}
.m-card-flux .m-card-header {
    font-size: 1.4rem;
    letter-spacing: 2px;
    color: #fff;
    text-shadow: 0 0 15px rgba(0, 242, 255, 0.5);
    margin-bottom: 10px;
}

/* INPUTS */
.m-input-group { position: relative; margin-bottom: 18px; }
.m-input {
    width: 100%; background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px;
    padding: 18px; padding-right: 95px; color: var(--m-primary);
    font-family: 'Rajdhani', monospace; font-size: 1.1rem; font-weight: 700; transition: all 0.3s ease;
}
.m-input:focus { border-color: var(--m-primary); background: rgba(0,0,0,0.85); box-shadow: var(--m-glow), 0 0 18px rgba(0,242,255,0.15); }
#m-mfPass { padding-right: 20px !important; }
.m-tmdb-input { border-color: rgba(176, 38, 255, 0.35); color: var(--m-accent); }
.m-paste-btn {
    position: absolute; right: 8px; top: 8px; bottom: 8px;
    background: rgba(255,255,255,0.1); color: var(--m-primary);
    border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
    padding: 0 16px; display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 0.85rem; font-weight: 700; font-family: 'Rajdhani', sans-serif;
    transition: all 0.2s ease; box-shadow: var(--m-glow);
}
.m-paste-btn:hover { background: rgba(255,255,255,0.15); }

/* TABS STANDARD */
.m-tabs-row { 
    display: flex; gap: 5px; 
    margin-bottom: 22px; background: rgba(0,0,0,0.55); 
    padding: 5px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); 
    box-shadow: inset 0 0 10px rgba(0,0,0,0.5); 
}
.m-tab-btn { 
    flex: 1; text-align: center; 
    padding: 12px 4px;
    font-size: 0.9rem; color: var(--m-dim); font-weight: 700; 
    border-radius: 12px; transition: all 0.25s ease; 
    font-family: 'Rajdhani', sans-serif; text-transform: uppercase; 
    display: flex; flex-direction: column; align-items: center; gap: 5px; 
}
.m-tab-icon { font-size: 1.3rem; filter: grayscale(1) brightness(0.8); transition: all 0.25s; }
.m-tab-btn.active { background: linear-gradient(135deg, rgba(0, 242, 255, 0.25), rgba(112, 0, 255, 0.15)); color: #fff; border: 1px solid var(--m-primary); box-shadow: var(--m-glow); text-shadow: 0 0 5px rgba(255,255,255,0.5); }
.m-tab-btn.active .m-tab-icon { filter: grayscale(0) drop-shadow(0 0 6px #fff) brightness(1.2); }

/* --- FLUX CARD BUTTONS - PERSONALIZZATI E COLORATI --- */
.m-card-flux .m-tab-btn {
    background: rgba(255,255,255,0.03);
    border: 1px solid transparent;
}
.m-card-flux .m-tab-icon {
    font-size: 1.6rem; /* Icone più grandi */
    filter: none; /* Rimuove grayscale */
    margin-bottom: 4px;
}

/* LEVIATHAN ACTIVE */
#sort-balanced.active {
    border-color: var(--m-primary);
    background: linear-gradient(180deg, rgba(0, 242, 255, 0.15), rgba(0,0,0,0));
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.3), inset 0 0 10px rgba(0, 242, 255, 0.1);
    color: #fff;
}
#sort-balanced.active .m-tab-icon {
    filter: drop-shadow(0 0 10px var(--m-primary));
    transform: scale(1.1);
}

/* QUALITY ACTIVE */
#sort-resolution.active {
    border-color: var(--m-secondary);
    background: linear-gradient(180deg, rgba(170, 0, 255, 0.15), rgba(0,0,0,0));
    box-shadow: 0 0 15px rgba(170, 0, 255, 0.3), inset 0 0 10px rgba(170, 0, 255, 0.1);
    color: #fff;
}
#sort-resolution.active .m-tab-icon {
    filter: drop-shadow(0 0 10px var(--m-secondary));
    transform: scale(1.1);
}

/* SIZE ACTIVE */
#sort-size.active {
    border-color: var(--m-amber);
    background: linear-gradient(180deg, rgba(255, 153, 0, 0.15), rgba(0,0,0,0));
    box-shadow: 0 0 15px rgba(255, 153, 0, 0.3), inset 0 0 10px rgba(255, 153, 0, 0.1);
    color: #fff;
}
#sort-size.active .m-tab-icon {
    filter: drop-shadow(0 0 10px var(--m-amber));
    transform: scale(1.1);
}


@keyframes spin3D {
    0% { transform: perspective(400px) rotateY(0deg); }
    40% { transform: perspective(400px) rotateY(180deg); }
    100% { transform: perspective(400px) rotateY(360deg); }
}
.m-spin-effect { animation: spin3D 0.7s ease-in-out; }

.m-ad-warning { display: none; background: rgba(255, 42, 109, 0.15); border: 1px solid var(--m-error); border-radius: 12px; padding: 12px; margin-bottom: 22px; text-align: center; color: var(--m-error); font-size: 0.85rem; font-weight: 700; box-shadow: 0 0 15px rgba(255,42,109,0.2); }
.m-ad-warning i { animation: pulseWarn 1.5s infinite; }
@keyframes pulseWarn { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

.m-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08); gap: 12px; transition: background 0.2s; }
.m-row:last-child { border-bottom: none; }
.m-row:hover { background: rgba(255,255,255,0.03); }
.m-label { flex: 1; min-width: 0; padding-right: 5px; }
.m-label h4 { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 1.05rem; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 700; text-shadow: 0 0 4px rgba(255,255,255,0.2); }
.m-label p { margin: 5px 0 0; font-size: 0.85rem; color: var(--m-dim); font-weight: 400; line-height: 1.3; }

.m-status-text { font-size: 0.7rem; padding: 3px 6px; border-radius: 5px; background: rgba(255,255,255,0.12); color: #888; white-space: nowrap; transition: all 0.2s; }
.m-status-text.on { background: rgba(0, 255, 157, 0.2); color: var(--m-success); border: 1px solid rgba(0, 255, 157, 0.35); box-shadow: 0 0 6px rgba(0,255,157,0.25); }

.m-switch { position: relative; width: 50px; height: 28px; flex-shrink: 0; }
.m-switch input { opacity: 0; width: 0; height: 0; }
.m-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: #1c1c1c; border-radius: 34px; transition: .35s; border: 1px solid #555; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); }
.m-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: #999; border-radius: 50%; transition: .35s; box-shadow: 0 0 4px rgba(0,0,0,0.3); }
input:checked + .m-slider { background-color: rgba(0,242,255,0.3); border-color: var(--m-primary); box-shadow: inset 0 0 10px rgba(0,242,255,0.4); }
input:checked + .m-slider:before { transform: translateX(22px); background-color: var(--m-primary); box-shadow: 0 0 10px var(--m-primary); }

.m-slider-purple { background-color: #1c1c1c; }
input:checked + .m-slider-purple { background-color: rgba(176, 38, 255, 0.3); border-color: var(--m-accent); box-shadow: inset 0 0 10px rgba(176,38,255,0.4); }
input:checked + .m-slider-purple:before { background-color: var(--m-accent); box-shadow: 0 0 10px var(--m-accent); }

.m-slider-amber { background-color: #1c1c1c; }
input:checked + .m-slider-amber { background-color: rgba(255, 153, 0, 0.3); border-color: var(--m-amber); box-shadow: inset 0 0 10px rgba(255,153,0,0.4); }
input:checked + .m-slider-amber:before { background-color: var(--m-amber); box-shadow: 0 0 10px var(--m-amber); }

.m-priority-wrapper { max-height: 0; opacity: 0; overflow: hidden; transition: all 0.35s ease; margin: 0 -10px; }
.m-priority-wrapper.show { max-height: 130px; opacity: 1; margin-top: 18px; padding: 0 10px; }
.m-priority-box { background: rgba(112, 0, 255, 0.15); border: 1px solid rgba(112, 0, 255, 0.35); border-left: 4px solid var(--m-secondary); border-radius: 12px; padding: 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 0 15px rgba(112,0,255,0.2); }
.m-priority-info { display: flex; align-items: center; gap: 12px; }
.m-priority-text h5 { margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: #fff; text-transform: uppercase; text-shadow: 0 0 4px rgba(255,255,255,0.3); }

.m-gate-wrapper { width: 100%; overflow: hidden; max-height: 0; opacity: 0; transition: all 0.35s ease; }
.m-gate-wrapper.show { max-height: 65px; opacity: 1; margin-top: 12px; }
.m-gate-control { display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.55); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); box-shadow: inset 0 0 8px rgba(0,0,0,0.5); }
.m-range { -webkit-appearance: none; width: 100%; height: 5px; background: linear-gradient(90deg, #333, #666); border-radius: 3px; transition: background 0.2s; }
.m-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 0 12px rgba(0,0,0,0.6), var(--m-glow); }

.m-q-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 18px; }
.m-q-item { 
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: var(--m-dim); 
    padding: 12px 2px; text-align: center; border-radius: 10px; 
    font-size: 0.75rem; font-weight: 700; font-family: 'Rajdhani', sans-serif; 
    transition: all 0.2s ease; box-shadow: inset 0 0 5px rgba(0,0,0,0.3); white-space: nowrap; 
}
.m-q-item.excluded { border-color: var(--m-error); color: var(--m-error); opacity: 0.6; text-decoration: line-through; background: rgba(255, 42, 109, 0.15); box-shadow: 0 0 10px rgba(255,42,109,0.2); }

.m-credits-section { margin-top: 35px; padding-top: 25px; border-top: 1px solid rgba(255,255,255,0.15); display: flex; flex-direction: column; align-items: center; gap: 18px; }
.m-faq-btn { width: 100%; padding: 14px; background: transparent; border: 1px dashed rgba(255,255,255,0.35); color: var(--m-text); border-radius: 12px; font-family: 'Rajdhani', sans-serif; font-weight: 700; display: flex; justify-content: center; align-items: center; gap: 10px; transition: all 0.2s; box-shadow: var(--m-glow); }
.m-faq-btn:hover { background: rgba(255,255,255,0.05); }
.m-commander-link { text-decoration: none; display: inline-flex; align-items: center; gap: 12px; background: rgba(0, 5, 10, 0.85); border: 1px solid rgba(112,0,255,0.35); padding: 8px 22px 8px 8px; border-radius: 50px; box-shadow: var(--m-shadow-deep), 0 0 18px rgba(112,0,255,0.2); }
.m-cmd-avatar { width: 42px; height: 42px; border-radius: 50%; border: 2px solid var(--m-primary); object-fit: cover; box-shadow: var(--m-glow); }
.m-cmd-info { display: flex; flex-direction: column; justify-content: center; line-height: 1.1; }
.m-cmd-name { font-size: 1.05rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif; text-shadow: 0 0 4px rgba(255,255,255,0.3); }
.m-donate-btn { text-decoration: none; color: #fff; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); padding: 12px 28px; border-radius: 32px; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 10px; box-shadow: 0 0 15px rgba(255,255,255,0.1); transition: all 0.2s; }
.m-donate-btn:hover { box-shadow: 0 0 20px rgba(255,42,109,0.3); }

.m-dock-container { position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(2, 5, 10, 0.97); border-top: 1px solid rgba(0,242,255,0.15); z-index: 100; display: flex; flex-direction: column; padding-bottom: var(--safe-bottom); box-shadow: 0 -12px 35px rgba(0,0,0,0.85); backdrop-filter: blur(12px); }
.m-dock-actions { display: flex; gap: 12px; padding: 12px 18px 6px 18px; }
.m-btn-install { flex: 3; background: linear-gradient(90deg, var(--m-primary), var(--m-secondary)); color: #000; border: none; border-radius: 12px; height: 48px; font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 0 18px rgba(0,242,255,0.25); transition: all 0.2s; }
.m-btn-install:hover { transform: scale(1.02); box-shadow: 0 0 25px rgba(0,242,255,0.35); }
.m-btn-copy { flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 12px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; font-weight: 700; transition: all 0.2s; box-shadow: var(--m-glow); }
.m-btn-copy:hover { background: rgba(255,255,255,0.15); }
.m-dock-nav { display: flex; justify-content: space-around; align-items: center; padding: 8px 0 10px 0; }
.m-nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--m-dim); width: 80px; transition: all 0.25s ease; }
.m-nav-item i { font-size: 1.3rem; }
.m-nav-item span { font-size: 0.65rem; font-weight: 700; font-family: 'Rajdhani', sans-serif; }
.m-nav-item.active { color: var(--m-primary); text-shadow: 0 0 6px var(--m-primary); transform: scale(1.1); }

.m-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.97); z-index: 200; display: none; padding: 25px; flex-direction: column; backdrop-filter: blur(8px); }
.m-modal.show { display: flex; animation: fadeInModal 0.3s ease-out; }
@keyframes fadeInModal { from { opacity: 0; } to { opacity: 1; } }
.m-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.15); }
.m-modal-title { font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; color: var(--m-primary); font-weight: 900; text-shadow: 0 0 8px var(--m-primary); }
.m-faq-content { overflow-y: auto; flex: 1; }
.m-faq-item { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 14px 0; transition: background 0.2s; }
.m-faq-item:hover { background: rgba(255,255,255,0.03); }
.m-faq-q { font-weight: 700; color: #fff; font-size: 1rem; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
.m-faq-a { font-size: 0.9rem; color: var(--m-dim); line-height: 1.5; display: none; margin-top: 10px; }
.m-faq-item.open .m-faq-a { display: block; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
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
            
                <div class="m-card-flux">
                    <div class="m-card-header">
                        <i class="fas fa-sort-amount-up m-card-icon" style="color:#fff; margin-right:8px;"></i> FLUX PRIORITY
                    </div>
                    <p style="font-size:0.85rem; color:var(--m-dim); margin-bottom:15px; font-weight:300;">Scegli come ordinare i risultati.</p>
                    <div class="m-tabs-row" style="background:rgba(0,0,0,0.4);">
                        <div class="m-tab-btn active" id="sort-balanced" onclick="setSortMode('balanced')">
                            <i class="fas fa-dragon m-tab-icon" style="color:var(--m-primary)"></i> LEVIATHAN
                        </div>
                        <div class="m-tab-btn" id="sort-resolution" onclick="setSortMode('resolution')">
                            <i class="fas fa-gem m-tab-icon" style="color:var(--m-secondary)"></i> QUALITY
                        </div>
                        <div class="m-tab-btn" id="sort-size" onclick="setSortMode('size')">
                            <i class="fas fa-hdd m-tab-icon" style="color:var(--m-amber)"></i> SIZE
                        </div>
                    </div>
                    <div id="flux-desc-container" style="min-height: 60px; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; margin-top: 10px; border: 1px dashed rgba(255,255,255,0.1);">
                        <p id="flux-description" style="margin:0; font-size: 0.85rem; color: var(--m-dim); line-height: 1.4; transition: opacity 0.2s ease;">
                            L'algoritmo standard di Leviathan. Cerca il bilanciamento perfetto tra qualità, popolarità del file e velocità. Ideale per l'uso quotidiano.
                        </p>
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

// TEXT DICTIONARY FOR FLUX PRIORITY
const fluxDescriptions = {
    'balanced': "L'algoritmo standard di Leviathan. Cerca il bilanciamento perfetto tra qualità, popolarità del file e velocità. Ideale per l'uso quotidiano.",
    'resolution': "Gerarchia visiva rigida. I risultati 4K appariranno sempre per primi, seguiti dai 1080p e infine 720p.",
    'size': "Ordina per grandezza del file (dal più grande al più piccolo). Ideale per chi vuole il massimo bitrate possibile."
};

function createBubbles() {
    const container = document.getElementById('m-bubbles');
    if(!container) return;
    for(let i=0; i<12; i++) {
        const b = document.createElement('div');
        b.classList.add('bubble');
        const size = Math.random() * 8 + 3;
        b.style.width = `${size}px`; b.style.height = `${size}px`;
        b.style.left = `${Math.random() * 100}%`;
        b.style.animationDuration = `${Math.random() * 15 + 10}s`; 
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
    if (!keepInput) { document.getElementById('m-apiKey').value = ''; }

    document.querySelectorAll('.m-tab-btn').forEach(t => t.parentElement.classList.contains('m-tabs-row') && !t.id ? t.classList.remove('active') : null);
    if(btn) {
        btn.classList.add('active');
        const icon = btn.querySelector('.m-tab-icon');
        if(icon) {
            icon.classList.remove('m-spin-effect');
            void icon.offsetWidth; 
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
    if (val == 0) { display.innerText = "∞"; } else { display.innerText = val; }
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

// --- FLUX PRIORITY LOGIC (UPDATED WITH TEXT) ---
function setSortMode(mode) {
    mSortMode = mode;
    // Update Buttons
    ['balanced', 'resolution', 'size'].forEach(m => {
        const btn = document.getElementById('sort-' + m);
        if(m === mode) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Update Description Text
    const descEl = document.getElementById('flux-description');
    if(descEl) {
        descEl.style.opacity = 0;
        setTimeout(() => {
            descEl.innerText = fluxDescriptions[mode];
            descEl.style.opacity = 1;
        }, 200);
    }
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
