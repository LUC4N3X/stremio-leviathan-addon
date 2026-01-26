const mobileCSS = `
:root {
    --m-bg: #000000;
    --m-primary: #00f2ff;     /* Ciano Leviathan */
    --m-secondary: #aa00ff;   /* Viola Elettrico */
    --m-accent: #b026ff;      
    --m-amber: #ff9900;       /* Arancio Tecnico */
    --m-cine: #ff0055;        /* Magenta Cinema (TRAILER COLOR) */
    --m-surface: rgba(10, 15, 25, 0.85); 
    --m-surface-border: rgba(0, 242, 255, 0.25);
    --m-text: #e0f7fa;
    --m-dim: #7a9ab5; 
    --m-error: #ff3366;
    --m-success: #00ff9d;       
    --safe-bottom: env(safe-area-inset-bottom);
    --m-glow: 0 0 12px rgba(0, 242, 255, 0.4); 
    --m-shadow-deep: 0 8px 32px rgba(0,0,0,0.6); 
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; outline: none; user-select: none; }

/* --- STATIC PRO BACKGROUND (EX ECO MODE) --- */
body { 
    margin: 0; 
    /* Gradiente profondo "Abisso Tecnico" */
    background: radial-gradient(circle at 50% 35%, #131b29 0%, #05080d 60%, #000000 100%);
    font-family: 'Outfit', sans-serif; 
    overflow: hidden; 
    height: 100vh; 
    color: var(--m-text); 
    position: relative; 
    width: 100%;
    overscroll-behavior-y: contain;
}

/* Griglia Cibernetica Statica */
body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    z-index: -10;
    /* Griglia Ciano tecnica */
    background-image: 
        linear-gradient(rgba(0, 242, 255, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 242, 255, 0.08) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    /* Maschera radiale per sfumare ai bordi */
    mask-image: radial-gradient(circle at center, black 30%, rgba(0,0,0,0.5) 80%, transparent 100%);
    -webkit-mask-image: radial-gradient(circle at center, black 30%, rgba(0,0,0,0.5) 80%, transparent 100%);
}

/* Bagliore dal basso */
body::after {
    content: '';
    position: fixed;
    bottom: 0; left: 0; width: 100%; height: 50%;
    z-index: -9;
    background: linear-gradient(to top, rgba(0, 242, 255, 0.08), transparent);
    pointer-events: none;
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

/* --- HERO SECTION REDESIGNED --- */
.m-hero { text-align: center; padding: 40px 10px 30px 10px; display: flex; flex-direction: column; align-items: center; width: 100%; position: relative; overflow:hidden; } 

/* --- NEW LOGO REACTOR CORE --- */
.m-hero-portal {
    position: relative;
    width: 180px; height: 180px;
    display: flex; justify-content: center; align-items: center;
    perspective: 1000px;
    margin-bottom: 25px;
    z-index: 10;
}

.m-portal-img {
    width: 120px; height: 120px;
    object-fit: contain;
    z-index: 10;
    animation: portalLevitate 6s ease-in-out infinite;
    filter: drop-shadow(0 0 20px rgba(0, 242, 255, 0.8));
}

.m-energy-core {
    position: absolute;
    top: 50%; left: 50%;
    width: 100px; height: 100px;
    margin-left: -50px; margin-top: -50px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--m-primary) 10%, var(--m-secondary) 60%, transparent 70%);
    opacity: 0.6;
    z-index: 5;
    filter: blur(15px);
    animation: corePulse 4s ease-in-out infinite;
}

.m-ring-plasma {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    border: 3px solid transparent;
    border-top-color: var(--m-primary);
    border-left-color: rgba(0, 242, 255, 0.4);
    border-radius: 50%;
    z-index: 8;
    animation: spinGyro 8s linear infinite;
    box-shadow: 0 0 25px rgba(0, 242, 255, 0.4), inset 0 0 10px rgba(0, 242, 255, 0.2);
}

.m-ring-flux {
    position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px;
    border: 2px dashed rgba(170, 0, 255, 0.7);
    border-radius: 50%;
    z-index: 7;
    animation: spinGyroRev 12s linear infinite;
    filter: drop-shadow(0 0 10px var(--m-secondary));
}

@keyframes portalLevitate {
    0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 20px rgba(0, 242, 255, 0.7)); }
    50% { transform: translateY(-12px) scale(1.05); filter: drop-shadow(0 0 40px rgba(0, 242, 255, 1)) brightness(1.2); }
}

@keyframes corePulse {
    0%, 100% { transform: scale(0.9); opacity: 0.4; }
    50% { transform: scale(1.6); opacity: 0.8; }
}

@keyframes spinGyro {
    0% { transform: rotateX(65deg) rotateY(0deg) rotateZ(0deg); }
    100% { transform: rotateX(65deg) rotateY(360deg) rotateZ(360deg); }
}
@keyframes spinGyroRev {
    0% { transform: rotateX(-65deg) rotateY(360deg) rotateZ(0deg); }
    100% { transform: rotateX(-65deg) rotateY(0deg) rotateZ(-360deg); }
}

.m-brand-title {
    font-family: 'Rajdhani', sans-serif; font-size: 3.2rem; font-weight: 900; line-height: 1;
    background: linear-gradient(180deg, #ffffff 10%, var(--m-primary) 90%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;
    filter: drop-shadow(0 0 12px rgba(0, 242, 255, 0.5));
    text-shadow: 0 0 8px rgba(0,242,255,0.3);
    position: relative; z-index: 10;
}

.m-brand-sub {
    font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; letter-spacing: 3px;
    color: var(--m-primary); text-transform: uppercase; margin-top: 10px; font-weight: 700; opacity: 0.95;
    display: flex; align-items: center; justify-content: center; width: 100%;
    text-shadow: 0 0 6px var(--m-primary); white-space: nowrap;
    position: relative; z-index: 10;
}
.m-brand-sub::before, .m-brand-sub::after { 
    content: ''; display: block; width: 25px; height: 2px; 
    background: linear-gradient(90deg, transparent, var(--m-primary)); 
    margin: 0 10px; opacity: 0.85; flex-shrink: 0; box-shadow: 0 0 8px var(--m-primary);
}
.m-brand-sub::after { background: linear-gradient(90deg, var(--m-primary), transparent); }

.m-version-tag {
    margin-top: 12px; font-family: 'Rajdhani', monospace; 
    font-size: 0.65rem; 
    color: #e0f7fa; opacity: 0.9; letter-spacing: 2px;
    background: rgba(0, 242, 255, 0.1);
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid rgba(0, 242, 255, 0.2);
    display: flex; align-items: center; gap: 6px;
    transition: all 0.3s ease; cursor: default;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    position: relative; z-index: 10;
}
.m-version-tag:hover { border-color: var(--m-primary); color: #fff; opacity: 1; box-shadow: 0 0 15px rgba(0,242,255,0.15); }
.m-v-dot { width: 5px; height: 5px; background: var(--m-success); border-radius: 50%; box-shadow: 0 0 5px var(--m-success); animation: blinkBase 2s infinite; }
@keyframes blinkBase { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }


/* --- PLASMA RAIL (Service Selector) --- */
.m-plasma-rail {
    display: flex; position: relative;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50px; padding: 4px; margin-bottom: 25px;
    box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
    backdrop-filter: blur(10px);
}
.m-rail-btn {
    flex: 1; text-align: center; padding: 12px 0;
    font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1rem;
    color: var(--m-dim); z-index: 2; cursor: pointer;
    transition: all 0.3s ease; border-radius: 40px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
}
.m-rail-btn .m-rail-icon { display: inline-block; transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); filter: drop-shadow(0 0 5px rgba(255,255,255,0.3)); font-style: normal; }
.m-rail-btn.active { color: #000; text-shadow: none; background: var(--m-primary); box-shadow: 0 0 15px var(--m-primary); }
@keyframes railSpin { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.3); } 100% { transform: rotate(360deg) scale(1); } }
.m-rail-btn.spin-anim .m-rail-icon { animation: railSpin 0.6s ease-out; }

.m-rail-btn[onclick*="'rd'"].active { background: #fff; box-shadow: 0 0 20px rgba(255,255,255,0.6); }
.m-rail-btn[onclick*="'ad'"].active { background: var(--m-primary); box-shadow: 0 0 20px var(--m-primary); }
.m-rail-btn[onclick*="'tb'"].active { background: var(--m-accent); color:#fff; box-shadow: 0 0 20px var(--m-accent); }

/* --- TERMINAL & MODULES --- */
.m-terminal-card {
    background: rgba(10, 15, 20, 0.6); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 20px; margin-bottom: 20px; position: relative;
    overflow: hidden; transition: border-color 0.3s;
}
.m-terminal-card:focus-within { border-color: var(--m-primary); background: rgba(10, 15, 25, 0.9); }
.m-terminal-label {
    font-size: 0.75rem; letter-spacing: 1.5px; color: var(--m-dim); text-transform: uppercase;
    margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;
}
.m-terminal-input {
    width: 100%; background: transparent; border: none; border-bottom: 2px solid rgba(255,255,255,0.15);
    color: #fff; font-family: 'Rajdhani', monospace; font-size: 1.1rem; padding: 10px 40px 10px 0;
    transition: all 0.3s; border-radius: 0;
}
.m-terminal-input:focus { border-bottom-color: var(--m-primary); box-shadow: 0 4px 10px -5px rgba(0,242,255,0.2); }
.m-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #333; box-shadow: inset 0 0 2px #000; transition: all 0.3s; }
.m-terminal-input:not(:placeholder-shown) ~ .m-terminal-label .m-status-dot { background: #00ff9d; box-shadow: 0 0 8px #00ff9d; }

.m-modules-title { font-size: 0.9rem; color: var(--m-dim); margin: 25px 0 15px 5px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; border-left: 3px solid var(--m-primary); padding-left: 10px; }
.m-module-grid { display: grid; grid-template-columns: 1fr; gap: 15px; }

.m-module {
    background: linear-gradient(145deg, rgba(20,25,35,0.8), rgba(5,10,15,0.9));
    border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px;
    display: flex; align-items: center; justify-content: space-between;
    transition: all 0.3s ease;
}
.m-module.active { border-color: rgba(0,242,255,0.3); background: linear-gradient(145deg, rgba(0,30,40,0.8), rgba(5,10,15,0.9)); box-shadow: 0 0 15px rgba(0,242,255,0.05); }
.m-module-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: var(--m-dim); transition: all 0.3s; }
.m-module.active .m-module-icon { background: rgba(0,242,255,0.15); color: var(--m-primary); box-shadow: 0 0 10px rgba(0,242,255,0.2); }
.m-module-info { flex: 1; padding: 0 15px; }
.m-module-name { display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 1.05rem; color: #fff; line-height: 1.2; }

/* NUOVO TAG PROXY QUADRATINO */
.m-proxy-tag {
    font-size: 0.6rem;
    padding: 2px 5px;
    border: 1px solid var(--m-amber);
    color: var(--m-amber);
    border-radius: 4px;
    background: rgba(255, 153, 0, 0.1);
    font-family: 'Rajdhani', monospace;
    font-weight: 800;
    letter-spacing: 0.5px;
    box-shadow: 0 0 5px rgba(255, 153, 0, 0.2);
}

.m-module-desc { 
    font-family: 'Outfit', sans-serif; 
    font-size: 0.8rem; 
    color: rgba(255,255,255,0.7); 
    margin-top: 3px; 
    font-weight: 400; 
    line-height: 1.4;
}

.m-sc-subpanel { grid-column: 1 / -1; background: rgba(0,0,0,0.4); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; display: none; animation: slideDown 0.3s ease; }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.m-mini-tabs { display: flex; gap: 8px; }
.m-mini-tab { flex: 1; padding: 8px; text-align: center; font-size: 0.8rem; font-weight: 700; border-radius: 8px; background: rgba(255,255,255,0.05); color: var(--m-dim); font-family: 'Rajdhani'; transition: all 0.2s; }
.m-mini-tab.active { background: var(--m-primary); color: #000; box-shadow: 0 0 10px rgba(0,242,255,0.3); }

/* --- CARDS & GENERAL --- */
.m-card { background: var(--m-surface); border: 1px solid var(--m-surface-border); border-radius: 18px; padding: 22px; margin-bottom: 18px; position: relative; box-shadow: var(--m-shadow-deep); backdrop-filter: blur(10px); }

/* VISUAL CORE CARD (SKIN) */
.m-card-visual {
    background: linear-gradient(145deg, rgba(5, 10, 15, 0.9), rgba(0, 5, 5, 0.95));
    border: 1px solid rgba(0, 242, 255, 0.25);
    border-radius: 20px; padding: 25px 20px; margin-bottom: 20px;
    position: relative; box-shadow: 0 0 25px rgba(0, 242, 255, 0.08);
    overflow: hidden; backdrop-filter: blur(15px);
}
.m-card-visual::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--m-primary); box-shadow: 0 0 15px var(--m-primary); }

.m-visual-header { 
    display: flex; justify-content: space-between; align-items: center; 
    margin-bottom: 15px; color: #fff; font-family: 'Rajdhani'; font-weight: 700; font-size: 1.1rem; 
}

/* PREVIEW TERMINAL MOBILE */
.m-preview-box {
    background: #050505; border: 1px solid #333; border-radius: 10px; padding: 12px; margin-bottom: 18px;
    font-family: 'Roboto', sans-serif; position: relative; box-shadow: inset 0 0 15px rgba(0,0,0,0.6);
}
.m-prev-row { display: flex; gap: 10px; }
.m-prev-poster { width: 35px; height: 52px; background: #252525; border-radius: 4px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; color:#444; }
.m-prev-content { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.m-prev-title { color: #ececec; font-size: 0.85rem; line-height: 1.2; white-space: pre-wrap; }
.m-prev-info { color: #888; font-size: 0.75rem; line-height: 1.3; white-space: pre-wrap; }

/* SKIN GRID */
.m-skin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.m-skin-btn {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
    color: var(--m-dim); padding: 10px 5px; border-radius: 8px; text-align: center;
    font-family: 'Rajdhani'; font-weight: 700; font-size: 0.8rem; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 5px; transition: all 0.2s;
}
.m-skin-btn.active {
    background: rgba(0, 242, 255, 0.1); border-color: var(--m-primary); color: #fff;
    box-shadow: 0 0 10px rgba(0, 242, 255, 0.15);
}
.m-skin-icon { font-size: 1.2rem; margin-bottom: 2px; }

/* AIO LOCK OVERLAY */
.m-aio-lock {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 2, 5, 0.9); z-index: 20; display: none;
    flex-direction: column; align-items: center; justify-content: center; text-align: center;
    backdrop-filter: blur(4px);
}
.m-aio-lock.active { display: flex; }
.m-lock-icon { font-size: 2rem; color: var(--m-secondary); margin-bottom: 10px; }
.m-lock-text { font-family: 'Rajdhani'; color: #fff; font-weight: 800; font-size: 1.1rem; }
.m-lock-sub { font-size: 0.75rem; color: #888; margin-top: 5px; max-width: 80%; }


/* Flux Card */
.m-card-flux { background: linear-gradient(145deg, rgba(15, 20, 30, 0.9), rgba(0, 0, 5, 0.95)); border: 1px solid rgba(0, 242, 255, 0.3); border-radius: 20px; padding: 25px 22px; margin-bottom: 20px; position: relative; box-shadow: 0 0 30px rgba(0, 242, 255, 0.1), inset 0 0 50px rgba(0, 242, 255, 0.05); overflow: hidden; backdrop-filter: blur(15px); }
.m-card-flux::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(to bottom, var(--m-secondary), var(--m-primary)); box-shadow: 0 0 15px var(--m-primary); }
.m-card-flux .m-card-header { font-size: 1.4rem; letter-spacing: 2px; color: #fff; text-shadow: 0 0 15px rgba(0, 242, 255, 0.5); margin-bottom: 10px; }

/* Quality Card REDESIGN */
.m-card-quality { background: linear-gradient(145deg, rgba(5, 10, 20, 0.9), rgba(0, 0, 0, 0.95)); border: 1px solid rgba(0, 242, 255, 0.2); border-radius: 20px; padding: 25px 22px; margin-bottom: 20px; position: relative; box-shadow: 0 0 20px rgba(0, 242, 255, 0.05); backdrop-filter: blur(15px); }
.m-card-quality::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--m-secondary); box-shadow: 0 0 15px var(--m-secondary); }
.m-card-quality .m-card-header { color: #fff; font-size: 1.2rem; }

/* QUALITY BUTTONS */
.m-q-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 18px; }
.m-q-item { 
    background: rgba(0, 242, 255, 0.08);
    border: 1px solid rgba(0, 242, 255, 0.3);
    color: #fff; 
    padding: 16px; 
    text-align: center; 
    border-radius: 14px; 
    font-size: 0.95rem; 
    font-weight: 800; 
    font-family: 'Rajdhani', sans-serif; 
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
    display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 10px; 
    position: relative; overflow: hidden;
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.1);
}
.m-q-item:not(.excluded):hover { transform: translateY(-2px); box-shadow: 0 0 20px rgba(0, 242, 255, 0.3); border-color: var(--m-primary); background: rgba(0, 242, 255, 0.15); }
.m-q-item:not(.excluded) i { color: var(--m-primary); filter: drop-shadow(0 0 5px var(--m-primary)); font-size: 1.1rem; }

.m-q-item.excluded { 
    border-color: rgba(255, 51, 102, 0.3); 
    color: rgba(255, 255, 255, 0.3); 
    background: rgba(10, 0, 5, 0.8); 
    box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
    transform: scale(0.98);
}
.m-q-item.excluded i { color: var(--m-error); filter: none; opacity: 0.5; }
.m-q-item.excluded::after {
    content: ''; position: absolute; top: 50%; left: 10%; right: 10%; height: 2px; background: var(--m-error); opacity: 0.4; transform: rotate(-5deg); pointer-events: none;
}

/* System Card */
.m-card-system { background: linear-gradient(145deg, rgba(0, 15, 25, 0.9), rgba(0, 2, 5, 0.95)); border: 1px solid rgba(0, 242, 255, 0.3); border-radius: 20px; padding: 25px 22px; margin-bottom: 20px; position: relative; box-shadow: 0 0 30px rgba(0, 242, 255, 0.1); overflow: hidden; backdrop-filter: blur(15px); }
.m-card-system::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(to bottom, #00f2ff, #00457C); box-shadow: 0 0 20px rgba(0, 242, 255, 0.5); }
.m-card-system .m-card-header { font-size: 1.4rem; letter-spacing: 2px; color: #fff; text-shadow: 0 0 15px rgba(0, 242, 255, 0.6); margin-bottom: 15px; }
.m-card-system .m-card-icon { color: var(--m-primary); filter: drop-shadow(0 0 10px var(--m-primary)); }

/* Network Card */
.m-card-network { background: linear-gradient(165deg, #0a0510 0%, #050208 100%); border: 1px solid rgba(170, 0, 255, 0.25); border-radius: 20px; padding: 25px 22px; margin-bottom: 20px; position: relative; box-shadow: 0 0 25px rgba(0,0,0,0.8); overflow: hidden; backdrop-filter: blur(15px); }
.m-card-network::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, var(--m-secondary), transparent); opacity: 0.7; box-shadow: 0 0 10px var(--m-secondary); }
.m-card-network .m-card-header { font-size: 1.2rem; letter-spacing: 1px; color: #fff; margin-bottom: 18px; display: flex; align-items: center; text-shadow: 0 0 10px rgba(170, 0, 255, 0.4); }

.m-ghost-zone { margin-top: 18px; padding: 15px; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; background: rgba(255,255,255,0.02); transition: all 0.35s ease; display: flex; align-items: center; justify-content: space-between; }
.m-ghost-zone.active { border-color: rgba(170, 0, 255, 0.5); background: linear-gradient(90deg, rgba(170, 0, 255, 0.08), transparent); box-shadow: 0 0 20px rgba(170, 0, 255, 0.1); }
.m-ghost-icon-box { width: 36px; height: 36px; border-radius: 10px; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; margin-right: 12px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s; }
.m-ghost-zone.active .m-ghost-icon-box { background: var(--m-secondary); border-color: var(--m-secondary); color: #000; box-shadow: 0 0 12px var(--m-secondary); }


/* UTILS & WIDGETS */
.m-input-group { position: relative; margin-bottom: 18px; }

.m-input { 
    width: 100%; background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; 
    padding: 18px; padding-right: 100px;
    color: var(--m-primary); font-family: 'Rajdhani', monospace; font-size: 1.1rem; font-weight: 700; transition: all 0.3s ease; 
}
.m-input:focus { border-color: var(--m-primary); background: rgba(0,0,0,0.85); box-shadow: var(--m-glow), 0 0 18px rgba(0,242,255,0.15); }

.m-paste-btn { 
    position: absolute; right: 6px; top: 6px; bottom: 6px; 
    background: rgba(255,255,255,0.1); color: var(--m-primary); border: 1px solid rgba(255,255,255,0.15); 
    border-radius: 10px; 
    padding: 0 10px; 
    display: flex; align-items: center; justify-content: center; gap: 6px; 
    font-size: 0.65rem; 
    font-weight: 700; font-family: 'Rajdhani', sans-serif; transition: all 0.2s ease; box-shadow: var(--m-glow); 
}
.m-paste-btn:hover { background: rgba(255,255,255,0.15); }

/* TAB STYLE FOR FLUX */
.m-tabs-row { display: flex; gap: 5px; margin-bottom: 22px; background: rgba(0,0,0,0.55); padding: 5px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); box-shadow: inset 0 0 10px rgba(0,0,0,0.5); }
.m-tab-btn { flex: 1; text-align: center; padding: 12px 4px; font-size: 0.9rem; color: var(--m-dim); font-weight: 700; border-radius: 12px; transition: all 0.25s ease; font-family: 'Rajdhani', sans-serif; text-transform: uppercase; display: flex; flex-direction: column; align-items: center; gap: 5px; }
.m-tab-icon { font-size: 1.3rem; filter: grayscale(1) brightness(0.8); transition: all 0.25s; }
.m-tab-btn.active { background: linear-gradient(135deg, rgba(0, 242, 255, 0.25), rgba(112, 0, 255, 0.15)); color: #fff; border: 1px solid var(--m-primary); box-shadow: var(--m-glow); text-shadow: 0 0 5px rgba(255,255,255,0.5); }
.m-tab-btn.active .m-tab-icon { filter: grayscale(0) drop-shadow(0 0 6px #fff) brightness(1.2); }

.m-card-flux .m-tab-btn { background: rgba(255,255,255,0.03); border: 1px solid transparent; }
.m-card-flux .m-tab-icon { font-size: 1.6rem; filter: none; margin-bottom: 4px; }
/* Flux Specific Colors */
#sort-balanced.active { border-color: var(--m-primary); background: linear-gradient(180deg, rgba(0, 242, 255, 0.15), rgba(0,0,0,0)); box-shadow: 0 0 15px rgba(0, 242, 255, 0.3), inset 0 0 10px rgba(0, 242, 255, 0.1); color: #fff; }
#sort-balanced.active .m-tab-icon { filter: drop-shadow(0 0 10px var(--m-primary)); transform: scale(1.1); }
#sort-resolution.active { border-color: var(--m-secondary); background: linear-gradient(180deg, rgba(170, 0, 255, 0.15), rgba(0,0,0,0)); box-shadow: 0 0 15px rgba(170, 0, 255, 0.3), inset 0 0 10px rgba(170, 0, 255, 0.1); color: #fff; }
#sort-resolution.active .m-tab-icon { filter: drop-shadow(0 0 10px var(--m-secondary)); transform: scale(1.1); }
#sort-size.active { border-color: var(--m-amber); background: linear-gradient(180deg, rgba(255, 153, 0, 0.15), rgba(0,0,0,0)); box-shadow: 0 0 15px rgba(255, 153, 0, 0.3), inset 0 0 10px rgba(255, 153, 0, 0.1); color: #fff; }
#sort-size.active .m-tab-icon { filter: drop-shadow(0 0 10px var(--m-amber)); transform: scale(1.1); }

@keyframes spin3D { 0% { transform: perspective(400px) rotateY(0deg); } 40% { transform: perspective(400px) rotateY(180deg); } 100% { transform: perspective(400px) rotateY(360deg); } }
.m-spin-effect { animation: spin3D 0.7s ease-in-out; }
.m-ad-warning { display: none; background: rgba(255, 42, 109, 0.15); border: 1px solid var(--m-error); border-radius: 12px; padding: 12px; margin-bottom: 22px; text-align: center; color: var(--m-error); font-size: 0.85rem; font-weight: 700; box-shadow: 0 0 15px rgba(255,42,109,0.2); }
.m-ad-warning i { animation: pulseWarn 1.5s infinite; }
@keyframes pulseWarn { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

.m-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08); gap: 12px; transition: background 0.2s; }
.m-label { flex: 1; min-width: 0; padding-right: 5px; }
.m-label h4 { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 1.05rem; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 700; text-shadow: 0 0 4px rgba(255,255,255,0.2); }

.m-label p { 
    font-family: 'Outfit', sans-serif; 
    margin: 5px 0 0; 
    font-size: 0.85rem; 
    color: rgba(255,255,255,0.7); 
    font-weight: 400; 
    line-height: 1.5; 
}

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

/* --- NEW CINEMA SLIDER STYLE --- */
.m-slider-pink { background-color: #1c1c1c; }
input:checked + .m-slider-pink { background-color: rgba(255, 0, 85, 0.3); border-color: var(--m-cine); box-shadow: inset 0 0 10px rgba(255,0,85,0.4); }
input:checked + .m-slider-pink:before { background-color: var(--m-cine); box-shadow: 0 0 10px var(--m-cine); }

.m-priority-wrapper { max-height: 0; opacity: 0; overflow: hidden; transition: all 0.35s ease; margin: 0 -10px; }
.m-priority-wrapper.show { max-height: 130px; opacity: 1; margin-top: 18px; padding: 0 10px; }

/* Custom Range Slider (Energy Bar Style) */
.m-gate-wrapper { width: 100%; overflow: hidden; max-height: 0; opacity: 0; transition: all 0.35s ease; }
.m-gate-wrapper.show { max-height: 65px; opacity: 1; margin-top: 12px; }
.m-gate-control { display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.55); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); box-shadow: inset 0 0 8px rgba(0,0,0,0.5); }
.m-range { -webkit-appearance: none; width: 100%; height: 6px; background: #222; border-radius: 3px; outline: none; border: 1px solid #444; }
.m-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--m-primary); box-shadow: 0 0 10px var(--m-primary); cursor: pointer; border: 2px solid #fff; }
#m-sizeVal::-webkit-slider-thumb { background: var(--m-amber); box-shadow: 0 0 10px var(--m-amber); }

/* --- CREDITS & DEV HUB --- */
.m-credits-section { 
    margin-top: 30px; 
    padding-top: 20px; 
    border-top: 1px solid rgba(255,255,255,0.08); 
    display: flex; 
    flex-direction: column; 
    gap: 15px; 
}

.m-faq-btn { 
    width: 100%; 
    padding: 12px; 
    background: rgba(255,255,255,0.03); 
    border: 1px dashed rgba(255,255,255,0.2); 
    color: var(--m-dim); 
    border-radius: 10px; 
    font-family: 'Rajdhani', sans-serif; 
    font-weight: 700; 
    font-size: 0.85rem;
    letter-spacing: 1px;
    display: flex; 
    justify-content: center; 
    align-items: center; 
    gap: 10px; 
    transition: all 0.3s ease; 
}
.m-faq-btn:hover { 
    background: rgba(255,255,255,0.08); 
    border-color: var(--m-primary); 
    color: #fff; 
    box-shadow: 0 0 15px rgba(0,242,255,0.1);
}

.m-dev-hub { display: flex; gap: 12px; height: 55px; }

.m-cmd-tag {
    flex: 1; text-decoration: none;
    background: linear-gradient(90deg, rgba(0, 242, 255, 0.05), rgba(0,0,0,0.4));
    border: 1px solid rgba(0, 242, 255, 0.25);
    border-radius: 12px;
    display: flex; align-items: center; padding: 0 12px; gap: 12px;
    transition: all 0.3s ease; position: relative; overflow: hidden;
}
.m-cmd-tag:hover {
    background: linear-gradient(90deg, rgba(0, 242, 255, 0.15), rgba(0,0,0,0.6));
    border-color: var(--m-primary);
    box-shadow: 0 0 20px rgba(0, 242, 255, 0.15);
}
.m-cmd-tag::before {
    content: ''; position: absolute; top:0; left:0; width: 3px; height: 100%;
    background: var(--m-primary); box-shadow: 0 0 8px var(--m-primary);
}

.m-cmd-avatar-mini {
    width: 36px; height: 36px; border-radius: 50%;
    border: 1px solid var(--m-primary);
    object-fit: cover;
    box-shadow: 0 0 8px rgba(0, 242, 255, 0.4);
}
.m-cmd-details { display: flex; flex-direction: column; justify-content: center; }
.m-cmd-role { font-size: 0.65rem; color: var(--m-primary); letter-spacing: 2px; text-transform: uppercase; font-weight: 800; opacity: 0.8; }
.m-cmd-nick { 
    font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; color: #fff; font-weight: 800; line-height: 1; 
    display: flex; align-items: center; gap: 8px;
}
.m-git-icon { font-size: 1rem; color: #fff; transition: transform 0.3s; opacity: 0.7; }
.m-cmd-tag:hover .m-git-icon { color: var(--m-primary); transform: rotate(360deg); opacity: 1; filter: drop-shadow(0 0 5px var(--m-primary)); }

.m-coffee-btn {
    text-decoration: none; padding: 0 15px; display: flex; align-items: center; justify-content: center;
    gap: 8px; background: rgba(10, 15, 25, 0.6); border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px; font-size: 1rem; color: var(--m-dim); transition: all 0.3s;
    position: relative; font-family: 'Rajdhani', sans-serif; font-weight: 700;
}
.m-coffee-text { font-size: 0.8rem; letter-spacing: 1px; color: var(--m-dim); transition: color 0.3s; }
.m-coffee-btn:hover { border-color: var(--m-primary); background: rgba(0, 242, 255, 0.05); box-shadow: 0 0 15px rgba(0, 242, 255, 0.2); }
.m-coffee-btn:hover i { color: var(--m-primary); transform: scale(1.1) rotate(-10deg); filter: drop-shadow(0 0 8px var(--m-primary)); }
.m-coffee-btn:hover .m-coffee-text { color: #fff; }
@keyframes steam { 0% { opacity:0; transform: translateY(0); } 50% { opacity:1; } 100% { opacity:0; transform: translateY(-10px); } }
.m-coffee-btn:hover::after { content: '♥'; position: absolute; top: 6px; left: 50%; transform:translateX(-50%); font-size: 8px; color: var(--m-primary); animation: steam 1s infinite; }

.m-dock-container { position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(2, 5, 10, 0.97); border-top: 1px solid rgba(0,242,255,0.15); z-index: 100; display: flex; flex-direction: column; padding-bottom: var(--safe-bottom); box-shadow: 0 -12px 35px rgba(0,0,0,0.85); backdrop-filter: blur(12px); }
.m-dock-actions { display: flex; gap: 12px; padding: 12px 18px 6px 18px; }
.m-btn-install { flex: 3; background: linear-gradient(90deg, var(--m-primary), var(--m-secondary)); color: #000; border: none; border-radius: 12px; height: 48px; font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 0 18px rgba(0,242,255,0.25); transition: all 0.2s; position: relative; overflow: hidden; }
.m-btn-install:hover { transform: scale(1.02); box-shadow: 0 0 25px rgba(0,242,255,0.35); }

/* PERSONAL TOUCH: HEARTBEAT SCAN */
.m-btn-install::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
    transform: skewX(-20deg);
    animation: scannerBtn 3s infinite ease-in-out;
}
@keyframes scannerBtn {
    0% { left: -100%; opacity: 0; }
    20% { opacity: 0.5; }
    50% { left: 200%; opacity: 0; }
    100% { left: 200%; opacity: 0; }
}

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

.m-faq-a { 
    font-family: 'Outfit', sans-serif; 
    font-size: 0.9rem; 
    color: rgba(255,255,255,0.75); 
    line-height: 1.5; 
    display: none; 
    margin-top: 10px; 
}
.m-faq-item.open .m-faq-a { display: block; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* --- VISUAL CORE SPECIFICS --- */
.m-card-visual {
    background: linear-gradient(145deg, rgba(5, 10, 15, 0.9), rgba(0, 5, 5, 0.95));
    border: 1px solid rgba(0, 242, 255, 0.25);
    border-radius: 20px; padding: 25px 20px; margin-bottom: 20px;
    position: relative; box-shadow: 0 0 25px rgba(0, 242, 255, 0.08);
    overflow: hidden; backdrop-filter: blur(15px);
}
.m-card-visual::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--m-primary); box-shadow: 0 0 15px var(--m-primary); }

.m-visual-header { 
    display: flex; justify-content: space-between; align-items: center; 
    margin-bottom: 15px; color: #fff; font-family: 'Rajdhani'; font-weight: 700; font-size: 1.1rem; 
}

/* PREVIEW TERMINAL MOBILE */
.m-preview-box {
    background: #050505; border: 1px solid #333; border-radius: 10px; padding: 12px; margin-bottom: 18px;
    font-family: 'Roboto', sans-serif; position: relative; box-shadow: inset 0 0 15px rgba(0,0,0,0.6);
}
.m-prev-row { display: flex; gap: 10px; }
.m-prev-poster { width: 35px; height: 52px; background: #252525; border-radius: 4px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; color:#444; }
.m-prev-content { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.m-prev-title { color: #ececec; font-size: 0.85rem; line-height: 1.2; white-space: pre-wrap; }
.m-prev-info { color: #888; font-size: 0.75rem; line-height: 1.3; white-space: pre-wrap; }

/* SKIN GRID */
.m-skin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.m-skin-btn {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
    color: var(--m-dim); padding: 10px 5px; border-radius: 8px; text-align: center;
    font-family: 'Rajdhani'; font-weight: 700; font-size: 0.8rem; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 5px; transition: all 0.2s;
}
.m-skin-btn.active {
    background: rgba(0, 242, 255, 0.1); border-color: var(--m-primary); color: #fff;
    box-shadow: 0 0 10px rgba(0, 242, 255, 0.15);
}
.m-skin-icon { font-size: 1.2rem; margin-bottom: 2px; }

/* AIO LOCK OVERLAY */
.m-aio-lock {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 2, 5, 0.9); z-index: 20; display: none;
    flex-direction: column; align-items: center; justify-content: center; text-align: center;
    backdrop-filter: blur(4px);
}
.m-aio-lock.active { display: flex; }
.m-lock-icon { font-size: 2rem; color: var(--m-secondary); margin-bottom: 10px; }
.m-lock-text { font-family: 'Rajdhani'; color: #fff; font-weight: 800; font-size: 1.1rem; }
.m-lock-sub { font-size: 0.75rem; color: #888; margin-top: 5px; max-width: 80%; }
`;

const mobileHTML = `
<div id="app-container">
    <div class="m-content-wrapper">
        <div class="m-ptr" id="m-ptr-indicator"><i class="fas fa-arrow-down m-ptr-icon"></i></div>

        <div class="m-content">
            <div class="m-hero">
                
                <div class="m-hero-portal">
                    <div class="m-energy-core"></div>
                    <div class="m-ring-plasma"></div>
                    <div class="m-ring-flux"></div>
                    <img src="https://i.ibb.co/0j2gLPzY/file-000000008ac871f4ba9b75ed76470d4b-2.png" class="m-portal-img">
                </div>
                
                <h1 class="m-brand-title">LEVIATHAN</h1>
                <div class="m-brand-sub">SOVRANO DEGLI ABISSI</div>
                <div class="m-version-tag"><div class="m-v-dot"></div>v2.2.0 STABLE</div>
            </div>

            <div id="page-setup" class="m-page active">
                
                <div class="m-plasma-rail">
                    <div class="m-rail-btn active" onclick="setMService('rd', this)"><span class="m-rail-icon">🚀</span> RD</div>
                    <div class="m-rail-btn" onclick="setMService('ad', this)"><span class="m-rail-icon">🦅</span> AD</div>
                    <div class="m-rail-btn" onclick="setMService('tb', this)"><span class="m-rail-icon">📦</span> TB</div>
                </div>

                <div id="m-ad-warn" class="m-ad-warning"><i class="fas fa-exclamation-triangle"></i> ATTENZIONE: AllDebrid funziona SOLO se hostato in LOCALE.</div>

                <div class="m-terminal-card">
                    <div class="m-terminal-label" style="justify-content:flex-start; gap:10px;">
                        <div style="width:28px; height:28px; border-radius:6px; background:rgba(0,242,255,0.1); display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-key" style="color:var(--m-primary); font-size:0.8rem;"></i>
                        </div>
                        <span>Debrid API Key</span>
                        <div class="m-status-dot" style="margin-left:auto;"></div>
                    </div>
                    <div style="position:relative;">
                        <input type="text" id="m-apiKey" class="m-terminal-input" placeholder="Inserisci la chiave API...">
                        <div class="m-paste-btn" onclick="pasteTo('m-apiKey')" style="top:-5px; right:0; bottom:auto; background:transparent; border:none; color:var(--m-primary); box-shadow:none;"><i class="fas fa-paste"></i></div>
                    </div>
                    <div class="m-row" style="padding: 10px 0 0; border:none; margin-top:5px;">
                        <span style="font-size:0.75rem; color:var(--m-dim);">Non hai la chiave?</span>
                        <button class="m-paste-btn" style="position:static; width:auto; border:1px solid rgba(255,255,255,0.15); padding:4px 12px;" onclick="openApiPage()"><i class="fas fa-external-link-alt"></i> OTTIENI</button>
                    </div>
                </div>

                <div class="m-terminal-card" style="padding: 15px 20px;">
                    <div class="m-terminal-label" style="justify-content:flex-start; gap:10px;">
                        <div style="width:28px; height:28px; border-radius:6px; background:rgba(176, 38, 255, 0.1); display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-film" style="color:var(--m-accent); font-size:0.8rem;"></i>
                        </div>
                        <span style="color:var(--m-accent)">TMDB API (Opzionale)</span>
                        <div class="m-status-dot" style="background:#444; margin-left:auto;"></div>
                    </div>
                    <div style="position:relative;">
                        <input type="text" id="m-tmdb" class="m-terminal-input" placeholder="Chiave TMDB Personale" style="border-bottom-color: rgba(176, 38, 255, 0.3);">
                         <div class="m-paste-btn" onclick="pasteTo('m-tmdb')" style="top:-5px; right:0; bottom:auto; background:transparent; border:none; color:var(--m-accent); box-shadow:none;"><i class="fas fa-paste"></i></div>
                    </div>
                     <div class="m-row" style="padding: 10px 0 0; border:none; margin-top:5px;">
                        <span style="font-size:0.75rem; color:var(--m-dim);">Non hai la chiave?</span>
                        <button class="m-paste-btn" style="position:static; width:auto; border:1px solid rgba(255,255,255,0.15); padding:4px 12px;" onclick="openApiPage('tmdb')"><i class="fas fa-external-link-alt"></i> OTTIENI</button>
                    </div>
                </div>

                <div class="m-modules-title">WEB SOURCES</div>
                <div class="m-module-grid">
                    
                    <div class="m-module-wrapper">
                        <div class="m-module" id="mod-vix">
                            <div class="m-module-icon"><i class="fas fa-play-circle" style="color:var(--m-secondary);"></i></div>
                            <div class="m-module-info">
                                <div class="m-module-name">StreamingCommunity</div>
                                <div class="m-module-desc">Scraper Veloce</div>
                            </div>
                            <label class="m-switch">
                                <input type="checkbox" id="m-enableVix" onchange="updateStatus('m-enableVix','st-vix'); toggleModuleStyle('m-enableVix', 'mod-vix');">
                                <span class="m-slider"></span>
                            </label>
                        </div>
                        <div id="m-sc-options" class="m-sc-subpanel">
                            <div class="m-mini-tabs">
                                <div class="m-mini-tab active" id="mq-sc-all" onclick="setScQuality('all')">HYBRID</div>
                                <div class="m-mini-tab" id="mq-sc-1080" onclick="setScQuality('1080')">1080p</div>
                                <div class="m-mini-tab" id="mq-sc-720" onclick="setScQuality('720')">720p</div>
                            </div>
                        </div>
                    </div>

                    <div class="m-module" id="mod-ghd">
                        <div class="m-module-icon" style="color:var(--m-primary)"><i class="fas fa-film"></i></div>
                        <div class="m-module-info">
                            <div class="m-module-name">
                                GuardaHD <span class="m-proxy-tag">PROXY</span>
                            </div>
                            <div class="m-module-desc">Streaming ITA HD</div>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-enableGhd" onchange="updateStatus('m-enableGhd','st-ghd'); toggleModuleStyle('m-enableGhd', 'mod-ghd');">
                            <span class="m-slider"></span>
                        </label>
                    </div>

                    <div class="m-module" id="mod-gs">
                        <div class="m-module-icon" style="color:var(--m-accent)"><i class="fas fa-tv"></i></div>
                        <div class="m-module-info">
                            <div class="m-module-name">
                                GuardaSerie <span class="m-proxy-tag">PROXY</span>
                            </div>
                            <div class="m-module-desc">Serie TV ITA</div>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-enableGs" onchange="updateStatus('m-enableGs','st-gs'); toggleModuleStyle('m-enableGs', 'mod-gs');">
                            <span class="m-slider m-slider-purple"></span>
                        </label>
                    </div>
                    
                    <div class="m-module" id="mod-webstr" style="border-color: rgba(255, 255, 255, 0.2);">
                        <div class="m-module-icon" style="color:#fff"><i class="fas fa-spider"></i></div>
                        <div class="m-module-info">
                            <div class="m-module-name">WebStreamr Fallback</div>
                            <div class="m-module-desc" style="font-size:0.75rem; line-height:1.3; margin-top:4px;">
                                <strong>Protocollo di Emergenza.</strong> Si attiva in automatico quando non si trovano risultati Debrid e gli altri servizi Web (come SC o GuardaHD) sono disabilitati o vuoti. Recupera stream di backup da database esterni.
                            </div>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-enableWebStreamr" checked onchange="toggleModuleStyle('m-enableWebStreamr', 'mod-webstr');">
                            <span class="m-slider" style="background-color:#333;"></span>
                        </label>
                    </div>

                </div>

                <div id="m-priority-panel" class="m-priority-wrapper">
                    <div style="margin-top:20px; padding:15px; border-radius:16px; background:linear-gradient(90deg, rgba(112,0,255,0.1), transparent); border-left:4px solid var(--m-secondary);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h5 style="margin:0; font-family:'Rajdhani'; color:#fff;">PRIORITÀ WEB</h5>
                                <p id="priority-desc" style="margin:5px 0 0; font-size:0.8rem; color:var(--m-dim);">Mostra Web in cima</p>
                            </div>
                            <label class="m-switch">
                                <input type="checkbox" id="m-vixLast" onchange="updatePriorityLabel()">
                                <span class="m-slider" style="border-color:var(--m-secondary)"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="m-credits-section">
                    <button class="m-faq-btn" onclick="openFaq()">
                        <i class="fas fa-terminal"></i> SYSTEM FAQ & MANUAL
                    </button>

                    <div class="m-dev-hub">
                        <a href="https://github.com/LUC4N3X/stremio-leviathan-addon" target="_blank" class="m-cmd-tag">
                            <img src="https://i.ibb.co/gLkrjxXT/Whats-App-Image-2026-01-12-at-20-15-37.jpg" alt="Dev" class="m-cmd-avatar-mini">
                            <div class="m-cmd-details">
                                <span class="m-cmd-role">LEAD DEVELOPER</span>
                                <span class="m-cmd-nick">
                                    LUC4N3X <i class="fab fa-github m-git-icon"></i>
                                </span>
                            </div>
                        </a>

                        <a href="https://www.paypal.me/luc4nex" target="_blank" class="m-coffee-btn" title="Offri un Caffè">
                            <i class="fas fa-mug-hot"></i>
                            <span class="m-coffee-text">DONATE</span>
                        </a>
                    </div>

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

                <div class="m-card-visual" id="m-visual-core">
                    <div class="m-aio-lock" id="m-aio-lock-overlay">
                        <i class="fas fa-lock m-lock-icon"></i>
                        <div class="m-lock-text">OVERRIDDEN BY AIO CORE</div>
                        <div class="m-lock-sub">Disabilita "Compatibilità AIO" per sbloccare le skin.</div>
                    </div>

                    <div class="m-visual-header">
                        <span><i class="fas fa-palette" style="color:var(--m-primary)"></i> VISUAL CORE</span>
                        <span style="font-size:0.8rem; opacity:0.7">SKIN SELECTOR</span>
                    </div>

                    <div class="m-preview-box">
                        <div style="font-size:0.7rem; color:var(--m-primary); border-bottom:1px solid #222; margin-bottom:8px; padding-bottom:4px;">LIVE PREVIEW</div>
                        <div class="m-prev-row">
                            <div class="m-prev-poster"><i class="fas fa-image"></i></div>
                            <div class="m-prev-content">
                                <div class="m-prev-title" id="m-prev-title">🦑 𝗟 𝗘 𝗩 𝗜 𝗔 𝗧 𝗛 𝗔 𝗡</div>
                                <div class="m-prev-info" id="m-prev-info">...</div>
                            </div>
                        </div>
                    </div>

                    <div class="m-skin-grid">
                        <div class="m-skin-btn active" id="msk_leviathan" onclick="selectMobileSkin('leviathan')"><span class="m-skin-icon">🦑</span>Lev</div>
                        <div class="m-skin-btn" id="msk_lev2" onclick="selectMobileSkin('lev2')"><span class="m-skin-icon">🧬</span>Arch</div>
                        <div class="m-skin-btn" id="msk_fra" onclick="selectMobileSkin('fra')"><span class="m-skin-icon">⚡️</span>Hor</div>
                        <div class="m-skin-btn" id="msk_dav" onclick="selectMobileSkin('dav')"><span class="m-skin-icon">📼</span>Data</div>
                        <div class="m-skin-btn" id="msk_pri" onclick="selectMobileSkin('pri')"><span class="m-skin-icon">👑</span>Ecl</div>
                        <div class="m-skin-btn" id="msk_and" onclick="selectMobileSkin('and')"><span class="m-skin-icon">🎬</span>Mtx</div>
                        <div class="m-skin-btn" id="msk_lad" onclick="selectMobileSkin('lad')"><span class="m-skin-icon">🎟️</span>Cmp</div>
                        <div class="m-skin-btn" id="msk_custom" onclick="selectMobileSkin('custom')"><span class="m-skin-icon">🛠️</span>Cust</div>
                    </div>
                    
                    <div id="m-custom-skin-area" style="display:none; margin-top:10px;">
                        <input type="text" class="m-input" id="m-customTemplate" placeholder="Lev {quality} ||| {title}" style="padding:10px; font-size:0.9rem;" oninput="updateMobilePreview()">
                    </div>
                </div>

                <div class="m-card-quality">
                    <div class="m-card-header"><i class="fas fa-filter m-card-icon" style="color:var(--m-error)"></i> FILTRO QUALITÀ</div>
                    <p style="font-size:0.85rem; color:#fff; margin-bottom:10px; font-weight:300;">Tocca per <b>ESCLUDERE</b> le risoluzioni:</p>
                    <div class="m-q-grid">
                        <div class="m-q-item" id="mq-4k" onclick="toggleFilter('mq-4k')">
                            <i class="fas fa-star"></i> 4K UHD
                        </div>
                        <div class="m-q-item" id="mq-1080" onclick="toggleFilter('mq-1080')">
                            <i class="fas fa-check-circle"></i> 1080p
                        </div>
                        <div class="m-q-item" id="mq-720" onclick="toggleFilter('mq-720')">
                            <i class="fas fa-compress"></i> 720p
                        </div>
                        <div class="m-q-item" id="mq-sd" onclick="toggleFilter('mq-sd')">
                            <i class="fas fa-video-slash"></i> SD/CAM
                        </div>
                    </div>
                </div>

                <div class="m-card-system">
                    <div class="m-card-header">
                        <i class="fas fa-microchip m-card-icon"></i> SISTEMA
                    </div>
                    
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
                                <i class="fas fa-film" style="color:var(--m-cine)"></i>
                                TRAILER MODE
                                <span class="m-status-text" id="st-trailer">OFF</span>
                            </h4>
                            <p>Cinema Experience (Auto-Play)</p>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-enableTrailers" onchange="updateStatus('m-enableTrailers','st-trailer')">
                            <span class="m-slider m-slider-pink"></span>
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
                <div class="m-card-network">
                    <div class="m-card-header"><i class="fas fa-network-wired" style="color:var(--m-secondary); margin-right:12px; font-size:1.3rem;"></i> MEDIAFLOW PROXY</div>
                    
                    <p style="font-size:0.85rem; color:var(--m-dim); margin-bottom:20px; line-height:1.4; font-weight:300;">
                        Proxy Server necessario per i moduli Italiani. Se attivo, il <b>Debrid Ghost</b> userà questo server per nascondere il tuo IP reale a Real-Debrid/AllDebrid.
                    </p>
                    
                    <div class="m-input-group">
                        <input type="text" id="m-mfUrl" class="m-input" placeholder="https://tuo-proxy.com" style="border-color:rgba(170,0,255,0.3); padding-left:45px;">
                        <i class="fas fa-server" style="position:absolute; left:16px; top:20px; color:rgba(170,0,255,0.6);"></i>
                        <div class="m-paste-btn" onclick="pasteTo('m-mfUrl')" style="border-color:rgba(170,0,255,0.3); color:var(--m-secondary);"><i class="fas fa-paste"></i> PASTE</div>
                    </div>
                    <div class="m-input-group" style="margin-bottom:0;">
                         <input type="password" id="m-mfPass" class="m-input" placeholder="Password" style="border-color:rgba(170,0,255,0.3); padding-left:45px;">
                         <i class="fas fa-lock" style="position:absolute; left:16px; top:20px; color:rgba(170,0,255,0.6);"></i>
                    </div>
                    
                    <div class="m-ghost-zone" id="ghost-zone-box">
                        <div style="display:flex; align-items:center;">
                            <div class="m-ghost-icon-box"><i class="fas fa-user-shield"></i></div>
                            <div>
                                <h4 style="margin:0; font-family:'Rajdhani'; font-size:1rem; color:#fff;">DEBRID GHOST</h4>
                                <p style="margin:3px 0 0; font-size:0.75rem; color:var(--m-dim);">Maschera l'IP di Debrid usando il tunnel MediaFlow</p>
                            </div>
                        </div>
                        <label class="m-switch">
                            <input type="checkbox" id="m-proxyDebrid" onchange="updateGhostVisuals()">
                            <span class="m-slider m-slider-purple"></span>
                        </label>
                    </div>

                </div>
            </div>
        </div> 
    </div>

    <div id="m-faq-modal" class="m-modal">
        <div class="m-modal-header"><div class="m-modal-title">DATABASE FAQ</div><div class="m-close-icon" onclick="closeFaq()"><i class="fas fa-times"></i></div></div>
        <div class="m-faq-content">
            <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">Come funziona? <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">Leviathan scansiona le profondità del web per trovare Torrent e flussi StreamingCommunity ad alta velocità.</div></div>
            <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">WebStreamr Fallback <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">È un sistema di emergenza. Se Leviathan non trova alcun risultato Torrent o Web normale, attiva WebStreamr per cercare flussi HTTP diretti gratuiti (non Debrid) da database di riserva.</div></div>
            <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">MediaFlow & GuardaHD/GS <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">GuardaHD e GuardaSerie richiedono un Proxy. Inserisci URL e Password del tuo MediaFlow Server nel modulo "Network".</div></div>
            <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">Cos'è il Cache Builder? <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">Mostra Torrent NON ancora scaricati su Debrid. Cliccandoli, avvierai il download.</div></div>
             <div class="m-faq-item" onclick="toggleFaqItem(this)"><div class="m-faq-q">Debrid Ghost Mode <i class="fas fa-chevron-down"></i></div><div class="m-faq-a">Debrid Ghost instrada tutte le richieste Debrid tramite il proxy MediaFlow configurato, nascondendo il tuo IP domestico al provider Debrid.</div></div>
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
let mSkin = 'leviathan';

// TEXT DICTIONARY FOR FLUX PRIORITY
const fluxDescriptions = {
    'balanced': "L'algoritmo standard di Leviathan. Cerca il bilanciamento perfetto tra qualità, popolarità del file e velocità. Ideale per l'uso quotidiano.",
    'resolution': "Gerarchia visiva rigida. I risultati 4K appariranno sempre per primi, seguiti dai 1080p e infine 720p.",
    'size': "Ordina per grandezza del file (dal più grande al più piccolo). Ideale per chi vuole il massimo bitrate possibile."
};

// --- VISUAL CORE HELPER FUNCTIONS ---
const skinMaps = {
    'bold': {
        nums: {'0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'},
        chars: {'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝','K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧','U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭','a':'𝗮','b':'𝗯','c':'𝗰','d':'𝗱','e':'𝗲','f':'𝗳','g':'𝗴','h':'𝗵','i':'𝗶','j':'j','k':'𝗸','l':'𝗹','m':'𝗺','n':'𝗻','o':'𝗼','p':'𝗽','q':'𝗾','r':'𝗿','s':'𝘀','t':'𝘁','u':'𝘂','v':'𝘃','w':'𝘄','x':'𝘅','y':'𝘆','z':'𝘇'}
    },
    'spaced': {
        nums: {'0':'𝟎','1':'𝟏','2':'𝟐','3':'𝟑','4':'𝟒','5':'𝟓','6':'𝟔','7':'𝟕','8':'𝟖','9':'𝟗'},
        chars: {'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝','K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧','U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭'}
    },
    'small': {
        nums: {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'},
        chars: {'A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ꜰ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'ꜱ','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ','a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ'}
    }
};

function toStylized(text, type = 'std') {
    if (type === 'spaced') {
        return text.split('').map(c => {
            const map = skinMaps['bold'];
            const char = (/[0-9]/.test(c) ? map.nums[c] : map.chars[c]) || c;
            return char + ' ';
        }).join('').trim();
    }
    const map = skinMaps[type] || skinMaps['bold'];
    return text.split('').map(c => {
        if (/[0-9]/.test(c)) return map.nums[c] || c;
        return map.chars[c] || c;
    }).join('');
}

function selectMobileSkin(skinId) {
    mSkin = skinId;
    document.querySelectorAll('.m-skin-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('msk_' + skinId).classList.add('active');
    
    const customArea = document.getElementById('m-custom-skin-area');
    if(skinId === 'custom') customArea.style.display = 'block';
    else customArea.style.display = 'none';
    
    updateMobilePreview();
}

function updateMobilePreview() {
    const p = {
        title: "Dune Part Two",
        cleanName: "Dune Part Two (2024)",
        quality: "4K",
        sizeString: "64.20 GB",
        source: "P2P",
        displaySource: "P2P",
        serviceTag: mCurrentService.toUpperCase(),
        serviceIcon: mCurrentService === 'rd' ? "☄️" : (mCurrentService === 'tb' ? "📦" : "🦅"),
        lang: "🇮🇹 ITA",
        audioInfo: "🔊⚡ TrueHD ┃ 7.1",
        info: "💎 ʀᴇᴍᴜx • 🔥 HDR • 👁️ DV",
        seedersStr: "👥 1337"
    };

    let name = "", desc = "";

    if (mSkin === 'leviathan') {
        const qBold = toStylized("4K", "bold");
        const lev = toStylized("LEVIATHAN", "spaced");
        name = `🦑 ${lev}\n${p.serviceIcon} ┃ ${qBold}`;
        desc = `🗂️ ${p.cleanName}\n🗣️ ${p.lang} • ${p.audioInfo}\n${p.info}\n🧲 ${p.sizeString} • ${p.seedersStr}\n${p.serviceIcon} [${p.serviceTag}] ${p.source}`;
    } else if (mSkin === 'lev2') {
        const levText = toStylized("LEVIATHAN", "small");
        const qText = toStylized("4K", "bold");
        const sizeSmall = toStylized("64.20", "bold") + " " + toStylized("GB", "small");
        name = `🦑 ${levText} ${p.serviceIcon} │ ${qText}`;
        const titleBold = toStylized(p.cleanName, "bold");
        const audioSmall = toStylized("TrueHD 7.1", "small");
        const langSmall = toStylized("ITA ENG", "small");
        const srcSmall = toStylized(p.displaySource, "small");
        let servSmall = "ᴘ𝟚ᴘ";
        if(p.serviceTag === "RD") servSmall = "ʀᴇᴀʟ-ᴅᴇʙʀɪᴅ";
        if(p.serviceTag === "AD") servSmall = "ᴀʟʟ-ᴅᴇʙʀɪᴅ";
        desc = `🎬 ${titleBold}\n📦 ${sizeSmall} │ ʀᴇᴍᴜx │ ᴅᴏʟʙʏ ᴠɪsɪᴏɴ\n🔊 ${audioSmall} • 🇮🇹 ${langSmall}\n🔗 ${servSmall} │ ${srcSmall}`;
    } else if (mSkin === 'fra') {
        name = `⚡️ Leviathan 4K`;
        desc = `📄 ❯ ${p.cleanName}\n🌎 ❯ 🇮🇹 ITA • TrueHD\n✨ ❯ ${p.serviceTag} • ${p.source}\n🔥 ❯ 4K • Remux • HDR\n💾 ❯ ${p.sizeString} / 👥 ❯ 1337`;
    } else if (mSkin === 'dav') {
        name = `🎥4K UHD HEVC`;
        desc = `📺 ${p.cleanName}\n🎧 TrueHD 7.1 | 🎞️ HEVC\n🗣️ ITA | 📦 ${p.sizeString}\n⏱️ 1337 Seeds | 🏷️ ${p.source}\n${p.serviceIcon} Leviathan 📡 ${p.serviceTag}\n📂 ${p.title}`;
    } else if (mSkin === 'and') {
        name = `🎬 ${p.cleanName}`;
        desc = `4K ⚡\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─\nLingue: 🇮🇹\nSpecifiche: 4K | 📺 Remux HDR | 🔊 TrueHD\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n📂 ${p.sizeString} | ☁️ ${p.serviceTag} | 🛰️ Leviathan`;
    } else if (mSkin === 'lad') {
        name = `🖥️ 4K ${p.serviceTag}`;
        desc = `🎟️ ${p.cleanName}\n📜 Movie\n🎥 4K 🎞️ HEVC 🎧 TrueHD\n📦 ${p.sizeString} • 🔗 Leviathan\n🌐 🇮🇹`;
    } else if (mSkin === 'pri') {
        name = `[${p.serviceTag}]⚡️☁️\n4K🔥UHD\n[Leviathan]`;
        desc = `🎬 ${toStylized(p.cleanName, 'bold')}\n💎 ʀᴇᴍᴜx 🔆 HDR\n🎧 TrueHD | 🔊 7.1 | 🗣️ ITA\n📁 ${p.sizeString} | 🏷️ ${p.source}\n📄 ▶️ ${p.title} ◀️`;
    } else if (mSkin === 'custom') {
        let tpl = document.getElementById('m-customTemplate').value || "Lev {quality} ||| {title} - {size}";
        tpl = tpl.replace("{title}", p.cleanName).replace("{quality}", p.quality)
                 .replace("{size}", p.sizeString).replace("{source}", p.source)
                 .replace("{service}", p.serviceTag).replace("{lang}", "ITA")
                 .replace("{audio}", p.audioInfo).replace(/\\n/g, "\n");
        if (tpl.includes("|||")) {
            const parts = tpl.split("|||");
            name = parts[0].trim();
            desc = parts[1].trim();
        } else {
            name = `Leviathan ${p.serviceTag}\n${p.quality}`;
            desc = tpl;
        }
    }

    document.getElementById('m-prev-title').innerText = name;
    document.getElementById('m-prev-info').innerText = desc;
}

function toggleMobileAIOLock() {
    const isAIO = document.getElementById('m-aioMode').checked;
    const lock = document.getElementById('m-aio-lock-overlay');
    if(isAIO) lock.classList.add('active');
    else lock.classList.remove('active');
}

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
    // createBubbles removed since they belong to high-perf mode
    initPullToRefresh();
    loadMobileConfig();
    updateMobilePreview(); // Init preview
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
    // FIX SCROLL: Reset scroll position to top
    document.querySelector('.m-content').scrollTop = 0;
}

function setMService(srv, btn, keepInput = false) {
    if(mCurrentService === srv && !keepInput) return;
    mCurrentService = srv;
    if (!keepInput) { document.getElementById('m-apiKey').value = ''; }

    // Update Plasma Rail
    document.querySelectorAll('.m-rail-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.remove('spin-anim'); // Reset animation class
    });
    if(btn) {
        btn.classList.add('active');
        // Trigger Spin Animation
        requestAnimationFrame(() => {
            btn.classList.add('spin-anim');
        });
    }
    
    // Fallback for old style if present
    document.querySelectorAll('.m-tab-btn').forEach(t => t.parentElement.classList.contains('m-tabs-row') && !t.id ? t.classList.remove('active') : null);

    const input = document.getElementById('m-apiKey');
    const placeholders = { 'rd': "RD API Key...", 'ad': "AD API Key...", 'tb': "TB API Key..." };
    input.placeholder = placeholders[srv];
    const warn = document.getElementById('m-ad-warn');
    if(warn) warn.style.display = (srv === 'ad') ? 'block' : 'none';
    
    updateMobilePreview(); // Update skin preview with new service
}

function updateStatus(inputId, statusId) {
    const chk = document.getElementById(inputId).checked;
    // Old status text update logic (kept for fallback)
    const lbl = document.getElementById(statusId);
    if(lbl) {
        lbl.innerText = chk ? "ON" : "OFF";
        if(chk) lbl.classList.add('on'); else lbl.classList.remove('on');
    }
    
    if(inputId === 'm-enableVix') toggleScOptions();
    if(inputId === 'm-aioMode') toggleMobileAIOLock();
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
    // Support both new styling (subpanel) and old
    const opts = document.getElementById('m-sc-options');
    opts.style.display = chk ? 'block' : 'none';
    
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
    if(active) { wrapper.classList.add('show'); if(lbl) {lbl.innerText = "ON"; lbl.classList.add('on');} } 
    else { wrapper.classList.remove('show'); if(lbl) {lbl.innerText = "OFF"; lbl.classList.remove('on');} }
}

function updateGateDisplay(val) { document.getElementById('m-gate-display').innerText = val; }

function toggleSize() {
    const active = document.getElementById('m-sizeActive').checked;
    const wrapper = document.getElementById('m-size-wrapper');
    const lbl = document.getElementById('st-size');
    const slider = document.getElementById('m-sizeVal');
    
    if(active) { 
        wrapper.classList.add('show'); 
        if(lbl) {lbl.innerText = "ON"; lbl.classList.add('on');}
        updateSizeDisplay(slider.value);
    } else { 
        wrapper.classList.remove('show'); 
        if(lbl) {lbl.innerText = "OFF"; lbl.classList.remove('on');}
        document.getElementById('m-size-display').innerText = "∞";
    }
}

function updateSizeDisplay(val) {
    const display = document.getElementById('m-size-display');
    if (val == 0) { display.innerText = "∞"; } else { display.innerText = val; }
}

function openApiPage(type) {
    if(type === 'tmdb') {
         window.open('https://www.themoviedb.org/settings/api', '_blank');
         return;
    }
    const links = { 'rd': 'https://real-debrid.com/apitoken', 'ad': 'https://alldebrid.com/apikeys', 'tb': 'https://torbox.app/settings' };
    window.open(links[mCurrentService], '_blank');
}
function setScQuality(val) {
    mScQuality = val;
    // Update both new and old tabs if present
    ['all','1080','720'].forEach(q => {
        const el = document.getElementById('mq-sc-'+q);
        if(el) el.classList.remove('active');
    });
    const activeEl = document.getElementById('mq-sc-' + val);
    if(activeEl) activeEl.classList.add('active');
}

// --- FLUX PRIORITY LOGIC ---
function setSortMode(mode) {
    mSortMode = mode;
    // Update Buttons (Both Plasma Rail and old buttons if any)
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

function updateGhostVisuals() {
    const chk = document.getElementById('m-proxyDebrid').checked;
    const box = document.getElementById('ghost-zone-box');
    if(box) {
        if(chk) box.classList.add('active');
        else box.classList.remove('active');
    }
    const lbl = document.getElementById('st-ghost');
    if(lbl) {
         lbl.innerText = chk ? "ON" : "OFF";
         if(chk) lbl.classList.add('on'); else lbl.classList.remove('on');
    }
    if(navigator.vibrate) navigator.vibrate(15);
}

function toggleModuleStyle(inputId, boxId) {
    const chk = document.getElementById(inputId).checked;
    const box = document.getElementById(boxId);
    if(box) {
        if(chk) box.classList.add('active');
        else box.classList.remove('active');
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
        if(btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = originalHTML, 1500);
        }
    } catch (err) { alert("Impossibile accedere agli appunti. Incolla manualmente."); }
}

function loadMobileConfig() {
    try {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length >= 2 && pathParts[1].length > 10) {
            const config = JSON.parse(atob(pathParts[1]));
            if(config.service) {
                // Update Plasma Rail
                const srvMap = {'rd':0, 'ad':1, 'tb':2};
                const railBtns = document.querySelectorAll('#page-setup .m-rail-btn');
                if(railBtns.length > 0 && srvMap[config.service] !== undefined) {
                     setMService(config.service, railBtns[srvMap[config.service]], true);
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
            
            // LOAD SKIN
            if(config.formatter) selectMobileSkin(config.formatter);
            if(config.customTemplate) document.getElementById('m-customTemplate').value = config.customTemplate;

            if(config.mediaflow) {
                document.getElementById('m-mfUrl').value = config.mediaflow.url || "";
                document.getElementById('m-mfPass').value = config.mediaflow.pass || "";
                document.getElementById('m-proxyDebrid').checked = config.mediaflow.proxyDebrid || false;
            }
            if(config.filters) {
                document.getElementById('m-enableVix').checked = config.filters.enableVix || false;
                toggleModuleStyle('m-enableVix', 'mod-vix');

                document.getElementById('m-enableGhd').checked = config.filters.enableGhd || false;
                toggleModuleStyle('m-enableGhd', 'mod-ghd');

                document.getElementById('m-enableGs').checked = config.filters.enableGs || false;
                toggleModuleStyle('m-enableGs', 'mod-gs');
                
                // [NEW] WebStreamr Config Load
                document.getElementById('m-enableWebStreamr').checked = config.filters.enableWebStreamr !== false;
                toggleModuleStyle('m-enableWebStreamr', 'mod-webstr');

                document.getElementById('m-allowEng').checked = config.filters.allowEng || false;
                // [NEW] TRAILER CONFIG LOAD
                document.getElementById('m-enableTrailers').checked = config.filters.enableTrailers || false;
                
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
            updateStatus('m-aioMode', 'st-aio');
            updateStatus('m-enableTrailers', 'st-trailer'); // Update visual
            
            // MediaFlow logic separate
            updateGhostVisuals();

            toggleScOptions();
            checkWebPriorityVisibility(); 
            toggleMobileAIOLock(); // Init lock state
            updateMobilePreview(); // Init preview
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
        formatter: mSkin, // SAVE SKIN
        customTemplate: document.getElementById('m-customTemplate').value, // SAVE CUSTOM
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
            // [NEW] WebStreamr Config Save
            enableWebStreamr: document.getElementById('m-enableWebStreamr').checked,
            // [NEW] Trailer Config Save
            enableTrailers: document.getElementById('m-enableTrailers').checked,
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
