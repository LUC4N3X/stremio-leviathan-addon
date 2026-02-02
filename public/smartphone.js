const mobileCSS = `
:root {
    --m-bg: #000000;
    --m-primary: #00f2ff;     /* Ciano Leviathan */
    --m-secondary: #7000ff;   /* Viola Abisso */
    --m-accent: #b026ff;      
    --m-amber: #ffcc00;       /* Gold P2P Warning */
    --m-cine: #ff0055;        
    --m-kofi: #FF5E5B;        
    --m-surface: rgba(10, 15, 25, 0.85); 
    --m-text: #e0f7fa;
    --m-dim: #7a9ab5; 
    --m-error: #ff3366;
    --m-success: #00ff9d;       
    --safe-bottom: env(safe-area-inset-bottom);
    --m-glow: 0 0 15px rgba(0, 242, 255, 0.3); 
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; outline: none; user-select: none; }

/* --- CUSTOM THIN SCROLLBAR --- */
* { scrollbar-width: thin; scrollbar-color: rgba(0, 242, 255, 0.4) transparent; }
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0, 242, 255, 0.4); border-radius: 10px; }
::-webkit-scrollbar-thumb:active { background: var(--m-primary); }

/* --- BACKGROUND & CRT EFFECT --- */
body { 
    margin: 0; 
    background: radial-gradient(circle at 50% 35%, #131b29 0%, #05080d 60%, #000000 100%);
    font-family: 'Outfit', sans-serif; 
    color: var(--m-text); 
    width: 100%;
    height: 100%;
    overscroll-behavior: none;
    overflow: hidden;
}

body::after {
    content: " "; display: block; position: absolute; top: 0; left: 0; bottom: 0; right: 0;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.02) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
    z-index: 0; background-size: 100% 2px, 3px 100%; pointer-events: none;
}

body::before {
    content: ''; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -10;
    background-image: linear-gradient(rgba(0, 242, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 255, 0.08) 1px, transparent 1px);
    background-size: 40px 40px; pointer-events: none;
    mask-image: radial-gradient(circle at center, black 30%, rgba(0,0,0,0.5) 80%, transparent 100%);
    -webkit-mask-image: radial-gradient(circle at center, black 30%, rgba(0,0,0,0.5) 80%, transparent 100%);
}

#app-container { 
    display: flex; flex-direction: column; height: 100dvh; width: 100%; max-width: 100%; position: relative; overflow: hidden; 
}

.m-content-wrapper { 
    flex: 1; display: flex; flex-direction: column; min-height: 0; position: relative; overflow: hidden; z-index: 5; 
}

.m-content {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding: 0 15px 140px 15px; width: 100%; 
    -webkit-overflow-scrolling: touch; 
}

/* --- FIX PTR Z-INDEX --- */
.m-ptr {
    position: absolute; top: -70px; left: 0; width: 100%; height: 70px;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 15px; color: var(--m-primary); 
    z-index: 100; /* FIXED: Sopra a tutto, anche al logo */
    pointer-events: none; opacity: 0; transition: opacity 0.2s ease-out;
}
.m-ptr-icon {
    font-size: 1.4rem; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    background: rgba(0, 5, 10, 0.9); padding: 12px; border-radius: 50%; border: 1px solid var(--m-primary);
    box-shadow: 0 0 20px rgba(0, 242, 255, 0.4);
}
.m-ptr.loading .m-ptr-icon { animation: spin 1s linear infinite; border-color: var(--m-accent); }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.m-page { display: none; width: 100%; }
.m-page.active { display: block; animation: fadeFast 0.35s ease-out; }
@keyframes fadeFast { from { opacity: 0; transform: translate3d(0, 15px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }

/* --- HERO SECTION --- */
.m-hero { 
    text-align: center; padding: 30px 10px 20px 10px; display: flex; flex-direction: column; align-items: center; width: 100%; position: relative; overflow:visible; 
    z-index: 10; 
} 

.logo-container {
    width: 160px; height: 160px; margin: 0 auto 15px; border-radius: 50%; 
    border: 4px solid rgba(0, 242, 255, 0.7);
    display: flex; align-items: center; justify-content: center; 
    box-shadow: 0 0 20px rgba(0, 242, 255, 0.4), inset 0 0 30px rgba(112, 0, 255, 0.2);
    position: relative; animation: breathe 4s infinite ease-in-out; 
    background: rgba(0, 5, 10, 0.4); 
    overflow: hidden; will-change: transform, box-shadow;
}
@keyframes breathe { 0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 242, 255, 0.4); } 50% { transform: scale(1.03); box-shadow: 0 0 30px rgba(0, 242, 255, 0.6); } }

.logo-image {
    width: 85%; height: 85%; object-fit: contain; border-radius: 50%; 
    filter: drop-shadow(0 0 15px var(--m-primary)) brightness(1.2);
    animation: pulseGlow 2s infinite alternate; will-change: filter;
    z-index: 20;
}
@keyframes pulseGlow { 0% { filter: drop-shadow(0 0 10px var(--m-primary)) brightness(1.1); } 100% { filter: drop-shadow(0 0 25px var(--m-primary)) brightness(1.4); } }

.logo-particles { position: absolute; top: -50px; left: -50px; width: 280px; height: 280px; pointer-events: none; z-index: -1; overflow: hidden; }
.logo-particle {
    position: absolute; background: radial-gradient(circle, var(--m-secondary) 20%, transparent); border-radius: 50%;
    box-shadow: 0 0 8px var(--m-primary); opacity: 0; animation: logoFloat 12s linear infinite;
}
@keyframes logoFloat {
    0% { transform: translateY(100%) scale(0.8) rotate(0deg); opacity: 0; }
    10% { opacity: 0.4; } 90% { opacity: 0.4; }
    100% { transform: translateY(-100%) scale(1.2) rotate(180deg); opacity: 0; }
}

.m-brand-title { font-family: 'Rajdhani', sans-serif; font-size: 2.8rem; font-weight: 900; line-height: 1; background: linear-gradient(180deg, #ffffff 10%, var(--m-primary) 90%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; filter: drop-shadow(0 0 12px rgba(0, 242, 255, 0.5)); text-shadow: 0 0 8px rgba(0,242,255,0.3); position: relative; z-index: 10; }
.m-brand-sub { font-family: 'Rajdhani', sans-serif; font-size: 0.75rem; letter-spacing: 3px; color: var(--m-primary); text-transform: uppercase; margin-top: 8px; font-weight: 700; opacity: 0.95; display: flex; align-items: center; justify-content: center; width: 100%; text-shadow: 0 0 6px var(--m-primary); white-space: nowrap; position: relative; z-index: 10; }
.m-brand-sub::before, .m-brand-sub::after { content: ''; display: block; width: 25px; height: 2px; background: linear-gradient(90deg, transparent, var(--m-primary)); margin: 0 10px; opacity: 0.85; flex-shrink: 0; box-shadow: 0 0 8px var(--m-primary); }
.m-brand-sub::after { background: linear-gradient(90deg, var(--m-primary), transparent); }

.m-version-tag { margin-top: 10px; font-family: 'Rajdhani', monospace; font-size: 0.6rem; color: #e0f7fa; opacity: 0.9; letter-spacing: 2px; background: rgba(0, 242, 255, 0.1); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(0, 242, 255, 0.2); display: flex; align-items: center; gap: 6px; transition: all 0.3s ease; cursor: default; box-shadow: 0 0 10px rgba(0,0,0,0.5); position: relative; z-index: 10; }
.m-v-dot { width: 5px; height: 5px; background: var(--m-success); border-radius: 50%; box-shadow: 0 0 5px var(--m-success); animation: blinkBase 2s infinite; }
@keyframes blinkBase { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }

/* --- COMPONENTS --- */
.m-srv-rail { display: flex; gap: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 6px; margin-bottom: 25px; backdrop-filter: blur(5px); }
.m-srv-btn { flex: 1; text-align: center; padding: 14px 0; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.1rem; color: var(--m-dim); border-radius: 12px; cursor: pointer; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255,255,255,0.03); border: 1px solid transparent; }
.m-srv-btn[onclick*="'rd'"].active { background: linear-gradient(135deg, rgba(0, 242, 255, 0.15), rgba(0,0,0,0)); border-color: var(--m-primary); color: #fff; box-shadow: 0 0 20px rgba(0, 242, 255, 0.2), inset 0 0 10px rgba(0, 242, 255, 0.05); text-shadow: 0 0 10px var(--m-primary); }
.m-srv-btn[onclick*="'p2p'"].active { background: linear-gradient(135deg, rgba(255, 204, 0, 0.15), rgba(0,0,0,0)); border-color: var(--m-amber); color: #fff; box-shadow: 0 0 20px rgba(255, 204, 0, 0.2), inset 0 0 10px rgba(255, 204, 0, 0.05); text-shadow: 0 0 10px var(--m-amber); }
.m-srv-btn[onclick*="'tb'"].active { background: linear-gradient(135deg, rgba(176, 38, 255, 0.15), rgba(0,0,0,0)); border-color: var(--m-accent); color: #fff; box-shadow: 0 0 20px rgba(176, 38, 255, 0.2), inset 0 0 10px rgba(176, 38, 255, 0.05); text-shadow: 0 0 10px var(--m-accent); }
.m-rail-icon { font-size: 1.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }

.m-sc-subpanel { grid-column: 1 / -1; background: rgba(0,0,0,0.4); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; display: none; animation: slideDown 0.3s ease; margin: 10px 15px 15px 15px; }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.m-mini-tabs { display: flex; gap: 8px; }
.m-mini-tab { flex: 1; padding: 8px; text-align: center; font-size: 0.8rem; font-weight: 700; border-radius: 8px; background: rgba(255,255,255,0.05); color: var(--m-dim); font-family: 'Rajdhani'; transition: all 0.2s; }
.m-mini-tab.active { background: var(--m-primary); color: #000; box-shadow: 0 0 10px rgba(0,242,255,0.3); }

.m-hypervisor {
    background: linear-gradient(165deg, rgba(15, 20, 30, 0.95), rgba(5, 5, 10, 0.98));
    border: 1px solid rgba(0, 242, 255, 0.15); border-radius: 20px; padding: 15px 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5); position: relative; overflow: hidden;
    backdrop-filter: blur(20px); margin-bottom: 20px;
    z-index: 2; 
}
.m-hypervisor::before {
    content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px;
    background: linear-gradient(90deg, var(--m-primary), var(--m-secondary));
    box-shadow: 0 0 15px var(--m-primary);
}
.m-hyp-header {
    font-family: 'Rajdhani', sans-serif; font-size: 1rem; color: #fff; font-weight: 800; letter-spacing: 2px;
    margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;
}
.m-hyp-icon { font-size: 1.1rem; color: var(--m-primary); filter: drop-shadow(0 0 8px var(--m-primary)); }

/* --- FLUX STYLES --- */
.m-flux-control {
    display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;
}
.m-flux-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
}
.m-flux-opt {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
    padding: 12px 5px; text-align: center; cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    position: relative; overflow: hidden;
}
.m-flux-opt i { font-size: 1.2rem; color: #666; transition: all 0.3s; }
.m-flux-opt span { font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.75rem; color: #666; transition: all 0.3s; }

/* Active States for Flux */
.m-flux-opt.active-bal {
    background: rgba(0, 242, 255, 0.05); border-color: var(--m-primary);
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.1), inset 0 0 5px rgba(0, 242, 255, 0.05);
}
.m-flux-opt.active-bal i, .m-flux-opt.active-bal span { color: var(--m-primary); text-shadow: 0 0 8px rgba(0,242,255,0.4); }

.m-flux-opt.active-res {
    background: rgba(112, 0, 255, 0.05); border-color: var(--m-secondary);
    box-shadow: 0 0 15px rgba(112, 0, 255, 0.1), inset 0 0 5px rgba(112, 0, 255, 0.05);
}
.m-flux-opt.active-res i, .m-flux-opt.active-res span { color: var(--m-secondary); text-shadow: 0 0 8px rgba(112,0,255,0.4); }

.m-flux-opt.active-sz {
    background: rgba(255, 153, 0, 0.05); border-color: var(--m-amber);
    box-shadow: 0 0 15px rgba(255, 153, 0, 0.1), inset 0 0 5px rgba(255, 153, 0, 0.05);
}
.m-flux-opt.active-sz i, .m-flux-opt.active-sz span { color: var(--m-amber); text-shadow: 0 0 8px rgba(255,153,0,0.4); }

.m-flux-readout {
    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);
    border-left: 2px solid #444; border-radius: 0 8px 8px 0;
    padding: 12px; display: flex; gap: 12px; align-items: flex-start;
    transition: all 0.3s; min-height: 60px;
}
.m-fr-icon { font-size: 1.4rem; color: #444; margin-top: 2px; transition: all 0.3s; }
.m-fr-text { display: flex; flex-direction: column; gap: 2px; }
.m-fr-title { font-family: 'Rajdhani'; font-weight: 800; font-size: 0.8rem; color: #fff; text-transform: uppercase; letter-spacing: 1px; }
.m-fr-desc { font-family: 'Outfit'; font-size: 0.7rem; color: #888; line-height: 1.3; }

/* Readout Colors */
.m-flux-readout.mode-bal { border-left-color: var(--m-primary); background: linear-gradient(90deg, rgba(0,242,255,0.05), transparent); }
.m-flux-readout.mode-bal .m-fr-icon { color: var(--m-primary); }
.m-flux-readout.mode-res { border-left-color: var(--m-secondary); background: linear-gradient(90deg, rgba(112,0,255,0.05), transparent); }
.m-flux-readout.mode-res .m-fr-icon { color: var(--m-secondary); }
.m-flux-readout.mode-sz { border-left-color: var(--m-amber); background: linear-gradient(90deg, rgba(255,153,0,0.05), transparent); }
.m-flux-readout.mode-sz .m-fr-icon { color: var(--m-amber); }

/* --- LANGUAGE STYLES --- */
.m-lang-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; }
.m-lang-opt {
    background: rgba(20, 20, 25, 0.6);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 15px 5px; text-align: center; cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    position: relative; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; gap: 5px;
}
.m-lang-opt i { font-size: 1.2rem; color: #555; transition: all 0.3s; margin-bottom: 2px; }
.m-lang-txt { font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.8rem; color: #777; transition: color 0.3s; }

/* Active Language States */
.m-lang-opt.active-ita {
    background: rgba(0, 242, 255, 0.08); border-color: var(--m-primary);
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.15);
}
.m-lang-opt.active-ita i, .m-lang-opt.active-ita .m-lang-txt { color: var(--m-primary); filter: drop-shadow(0 0 5px rgba(0,242,255,0.5)); }

.m-lang-opt.active-hyb {
    background: rgba(112, 0, 255, 0.08); border-color: var(--m-secondary);
    box-shadow: 0 0 15px rgba(112, 0, 255, 0.15);
}
.m-lang-opt.active-hyb i, .m-lang-opt.active-hyb .m-lang-txt { color: var(--m-secondary); filter: drop-shadow(0 0 5px rgba(112,0,255,0.5)); }

.m-lang-opt.active-eng {
    background: rgba(255, 0, 85, 0.08); border-color: var(--m-cine);
    box-shadow: 0 0 15px rgba(255, 0, 85, 0.15);
}
.m-lang-opt.active-eng i, .m-lang-opt.active-eng .m-lang-txt { color: var(--m-cine); filter: drop-shadow(0 0 5px rgba(255,0,85,0.5)); }

.m-hyp-label { font-size: 0.65rem; color: var(--m-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-family: 'Rajdhani'; font-weight: 700; }
.m-hyp-desc { font-size: 0.65rem; color: #666; margin-bottom: 12px; margin-top: -5px; line-height: 1.3; font-family: 'Outfit'; }

.m-chip-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 20px; }
.m-qual-chip { font-family: 'Rajdhani'; font-weight: 800; font-size: 0.75rem; text-align: center; padding: 8px 2px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); color: #fff; transition: all 0.2s; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.m-qual-chip.excluded { opacity: 0.4; background: rgba(255, 51, 102, 0.1); border-color: rgba(255, 51, 102, 0.3); color: var(--m-error); text-decoration: line-through; }
.m-qual-chip:not(.excluded):active { transform: scale(0.95); }
.mini-tag { font-size: 0.55rem; opacity: 0.7; margin-top: -2px; font-weight: 700; letter-spacing: 1px; color: var(--m-primary); }
.m-qual-chip.excluded .mini-tag { color: var(--m-error); }

.m-sys-grid { display: grid; grid-template-columns: 1fr; gap: 0; background: rgba(0,0,0,0.2); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 20px; }
.m-sys-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.m-sys-row:last-child { border-bottom: none; }
.m-sys-info h4 { margin: 0; font-size: 0.85rem; color: #fff; font-family: 'Rajdhani'; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.m-sys-info p { margin: 2px 0 0; font-size: 0.65rem; color: rgba(255,255,255,0.5); }

/* --- NEW MFP BADGE --- */
.m-proxy-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(0, 242, 255, 0.08); border: 1px solid rgba(0, 242, 255, 0.4);
    border-radius: 4px; padding: 2px 5px; margin-left: 6px;
    font-size: 0.6rem; color: var(--m-primary); font-family: 'Rajdhani', sans-serif; font-weight: 800;
    letter-spacing: 0.5px; box-shadow: 0 0 5px rgba(0, 242, 255, 0.1);
}

.m-noproxy-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px; padding: 2px 5px; margin-left: 6px;
    font-size: 0.6rem; color: #aaa; font-family: 'Rajdhani', sans-serif; font-weight: 800;
    letter-spacing: 0.5px;
}

.m-visual-core-v2 { margin-bottom: 20px; position: relative; }
.m-visual-preview { background: #080808; border: 1px solid rgba(0,242,255,0.15); border-radius: 16px; padding: 12px; margin-bottom: 15px; display: flex; gap: 12px; align-items: flex-start; box-shadow: 0 0 25px rgba(0,0,0,0.6); position: relative; overflow: hidden; min-height: 80px; transition: border-color 0.2s; }
.m-visual-preview::before { content: ''; position: absolute; top:0; left:0; width:3px; height:100%; background: var(--m-primary); box-shadow: 0 0 10px var(--m-primary); }
.m-visual-preview.glitching { animation: glitch-anim 0.3s cubic-bezier(.25, .46, .45, .94) both; border-color: var(--m-accent); }
.m-visual-preview.glitching .m-vp-icon { background: var(--m-accent); color: #000; }
@keyframes glitch-anim { 0% { transform: translate(0); filter: hue-rotate(0deg); } 20% { transform: translate(-2px, 2px); filter: hue-rotate(90deg); } 40% { transform: translate(2px, -2px); filter: hue-rotate(-90deg); } 60% { transform: translate(-2px, 2px); } 80% { transform: translate(2px, -2px); } 100% { transform: translate(0); filter: hue-rotate(0deg); } }
.m-vp-icon { width: 44px; height: 66px; border-radius: 4px; background: linear-gradient(135deg, #1f2a36, #000); border: 1px solid #333; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; color: #555; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: background 0.2s; }
.m-vp-text { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; padding-top: 2px; }
.m-vp-title { font-family: 'Rajdhani'; color: #fff; font-size: 0.95rem; margin-bottom: 4px; line-height: 1.2; word-wrap: break-word; font-weight: 800; }
.m-vp-sub { font-family: 'Outfit'; color: #888; font-size: 0.7rem; line-height: 1.4; white-space: pre-wrap; overflow: visible; display: block; }

.m-cortex-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px; padding: 0 2px; }
.m-cortex-chip { background: rgba(20, 25, 35, 0.85); border: 1px solid rgba(0, 242, 255, 0.25); border-radius: 8px; padding: 10px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; position: relative; overflow: hidden; transition: all 0.2s; clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%); box-shadow: 0 0 8px rgba(0, 242, 255, 0.1); }
.m-cortex-chip:active { transform: scale(0.95); }
.m-cortex-chip.active { background: rgba(0, 242, 255, 0.15); border-color: var(--m-primary); box-shadow: 0 0 15px rgba(0, 242, 255, 0.3), inset 0 0 10px rgba(0, 242, 255, 0.1); }
.m-cortex-chip.active::after { content: ''; position: absolute; bottom: 0; right: 0; width: 8px; height: 8px; background: var(--m-primary); box-shadow: 0 0 8px var(--m-primary); }
.m-chip-icon { font-size: 1.3rem; filter: none; opacity: 1; transition: 0.3s; text-shadow: 0 0 5px rgba(255,255,255,0.3); }
.m-cortex-chip.active .m-chip-icon { transform: scale(1.1); text-shadow: 0 0 10px var(--m-primary); }
.m-chip-label { font-family: 'Rajdhani', monospace; font-size: 0.65rem; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 2px var(--m-primary); }

.m-field-group { margin-bottom: 18px; }
.m-field-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding: 0 2px; }
.m-field-label { font-family: 'Rajdhani'; font-weight: 700; font-size: 0.7rem; color: var(--m-dim); letter-spacing: 1px; }
.m-field-link { font-family: 'Rajdhani'; font-weight: 700; font-size: 0.65rem; color: var(--m-primary); cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 5px; }
.m-input-box { position: relative; width: 100%; }
.m-input-ico { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #555; font-size: 0.9rem; transition: 0.3s; z-index: 2; pointer-events: none; }
.m-input-tech { width: 100%; background: #05080b; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 12px 40px 12px 38px; color: #fff; font-family: 'Roboto Mono', monospace; font-size: 0.9rem; transition: all 0.3s; }
.m-input-tech:focus { border-color: var(--m-primary); background: #080c12; box-shadow: 0 0 15px rgba(0,242,255,0.1); }
.m-input-tech:focus ~ .m-input-ico { color: var(--m-primary); }
.m-paste-action { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--m-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; }
.m-paste-action:hover { background: rgba(0,242,255,0.15); color: var(--m-primary); border-color: var(--m-primary); }

.m-ghost-panel { background: #05080b; border: 1px solid rgba(170,0,255,0.2); border-radius: 16px; padding: 15px; margin-top: 10px; position: relative; overflow: hidden; transition: all 0.3s; }
.m-ghost-panel.active { border-color: var(--m-secondary); box-shadow: 0 0 20px rgba(170,0,255,0.1); background: radial-gradient(circle at top right, rgba(170,0,255,0.08), transparent); }
.m-ghost-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.m-ghost-title { font-family: 'Rajdhani'; font-weight: 800; font-size: 1rem; color: #fff; display: flex; align-items: center; gap: 8px; }
.m-ghost-status { font-family: 'Rajdhani'; font-weight: 700; font-size: 0.65rem; padding: 3px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #666; transition: all 0.3s; }
.m-ghost-panel.active .m-ghost-status { background: var(--m-secondary); color: #000; box-shadow: 0 0 10px var(--m-secondary); }

/* --- P2P MODULE STYLE --- */
.m-p2p-module { background: rgba(255, 204, 0, 0.05); border: 1px solid rgba(255, 204, 0, 0.3); border-radius: 16px; padding: 15px; margin-top: 15px; position: relative; overflow: hidden; transition: all 0.3s; }
.m-p2p-module.active { border-color: var(--m-amber); box-shadow: 0 0 20px rgba(255, 204, 0, 0.2); background: radial-gradient(circle at top right, rgba(255, 204, 0, 0.08), transparent); }
.m-p2p-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.m-p2p-title { font-family: 'Rajdhani'; font-weight: 800; font-size: 1rem; color: var(--m-amber); display: flex; align-items: center; gap: 8px; text-shadow: 0 0 5px rgba(255,204,0,0.3); }
.m-p2p-status { font-family: 'Rajdhani'; font-weight: 700; font-size: 0.65rem; padding: 3px 6px; border-radius: 4px; background: rgba(255,204,0,0.1); color: var(--m-amber); transition: all 0.3s; border: 1px solid rgba(255,204,0,0.2); }
.m-p2p-module.active .m-p2p-status { background: var(--m-amber); color: #000; box-shadow: 0 0 10px var(--m-amber); }

.m-ad-warning { display: none; background: rgba(255, 42, 109, 0.15); border: 1px solid var(--m-error); border-radius: 12px; padding: 10px; margin-bottom: 20px; text-align: center; color: var(--m-error); font-size: 0.8rem; font-weight: 700; box-shadow: 0 0 15px rgba(255,42,109,0.2); }
.m-ad-warning i { animation: pulseWarn 1.5s infinite; }
@keyframes pulseWarn { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

.m-status-text { font-size: 0.65rem; padding: 3px 6px; border-radius: 5px; background: rgba(255,255,255,0.12); color: #888; white-space: nowrap; transition: all 0.2s; }
.m-status-text.on { background: rgba(0, 255, 157, 0.2); color: var(--m-success); border: 1px solid rgba(0, 255, 157, 0.35); box-shadow: 0 0 6px rgba(0,255,157,0.25); }

.m-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.m-switch input { opacity: 0; width: 0; height: 0; }
.m-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: #1c1c1c; border-radius: 34px; transition: .35s; border: 1px solid #555; box-shadow: inset 0 0 5px rgba(0,0,0,0.5); }
.m-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #999; border-radius: 50%; transition: .35s; box-shadow: 0 0 4px rgba(0,0,0,0.3); }
input:checked + .m-slider { background-color: rgba(0,242,255,0.3); border-color: var(--m-primary); box-shadow: inset 0 0 10px rgba(0,242,255,0.4); }
input:checked + .m-slider:before { transform: translateX(20px); background-color: var(--m-primary); box-shadow: 0 0 10px var(--m-primary); }
.m-slider-purple { background-color: #1c1c1c; }
input:checked + .m-slider-purple { background-color: rgba(176, 38, 255, 0.3); border-color: var(--m-accent); box-shadow: inset 0 0 10px rgba(176,38,255,0.4); }
input:checked + .m-slider-purple:before { background-color: var(--m-accent); box-shadow: 0 0 10px var(--m-accent); }
.m-slider-amber { background-color: #1c1c1c; }
input:checked + .m-slider-amber { background-color: rgba(255, 204, 0, 0.3); border-color: var(--m-amber); box-shadow: inset 0 0 10px rgba(255,204,0,0.4); }
input:checked + .m-slider-amber:before { background-color: var(--m-amber); box-shadow: 0 0 10px var(--m-amber); }
.m-slider-pink { background-color: #1c1c1c; }
input:checked + .m-slider-pink { background-color: rgba(255, 0, 85, 0.3); border-color: var(--m-cine); box-shadow: inset 0 0 10px rgba(255,0,85,0.4); }
input:checked + .m-slider-pink:before { background-color: var(--m-cine); box-shadow: 0 0 10px var(--m-cine); }

.m-priority-wrapper { max-height: 0; opacity: 0; overflow: hidden; transition: all 0.35s ease; margin: 0 -10px; }
.m-priority-wrapper.show { max-height: 130px; opacity: 1; margin-top: 15px; padding: 0 10px; }

.m-gate-wrapper { width: 100%; overflow: hidden; max-height: 0; opacity: 0; transition: all 0.35s ease; }
.m-gate-wrapper.show { max-height: 100px; opacity: 1; margin-top: 5px; margin-bottom: 10px; }
.m-gate-control { display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
.m-range { -webkit-appearance: none; width: 100%; height: 4px; background: #333; border-radius: 3px; outline: none; }
.m-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--m-primary); box-shadow: 0 0 10px var(--m-primary); cursor: pointer; border: 2px solid #fff; }
#m-sizeVal::-webkit-slider-thumb { background: var(--m-amber); box-shadow: 0 0 10px var(--m-amber); }
.m-range-desc { font-size: 0.7rem; color: var(--m-dim); margin: 8px 0 0 5px; line-height: 1.4; border-left: 2px solid var(--m-dim); padding-left: 8px; }

.m-row { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.m-label { flex: 1; padding-right: 15px; }
.m-label h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #fff; font-family: 'Rajdhani'; font-weight: 700; }

.m-action-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 5, 10, 0.95); z-index: 200; display: none; flex-direction: column; justify-content: center; align-items: center; backdrop-filter: blur(10px); padding: 20px; animation: fadeInModal 0.2s ease-out; }
.m-action-modal.show { display: flex; }
.m-am-card { width: 100%; max-width: 400px; background: linear-gradient(145deg, #0a0f18, #000); border: 1px solid var(--m-primary); border-radius: 20px; padding: 25px; box-shadow: 0 0 30px rgba(0, 242, 255, 0.15); display: flex; flex-direction: column; gap: 20px; }
.m-am-title { text-align: center; font-family: 'Rajdhani', sans-serif; font-weight: 800; color: #fff; font-size: 1.2rem; letter-spacing: 2px; margin-bottom: 5px; }
.m-am-subtitle { text-align: center; color: var(--m-dim); font-size: 0.8rem; margin-top: -15px; margin-bottom: 5px; }

.m-act-btn { padding: 15px; border-radius: 12px; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 1rem; cursor: pointer; text-align: center; transition: 0.2s; border: 1px solid transparent; display: flex; align-items: center; justify-content: center; gap: 10px; }
.m-act-copy { background: var(--m-primary); color: #000; box-shadow: 0 0 15px rgba(0, 242, 255, 0.3); }
.m-act-copy:active { transform: scale(0.98); }
.m-act-close { background: rgba(255,255,255,0.1); color: #aaa; margin-top: 5px; border: 1px solid rgba(255,255,255,0.1); }

.m-flux-terminal { background: #000; border: 1px solid rgba(0, 242, 255, 0.2); border-left: 3px solid var(--m-primary); border-radius: 12px; overflow: hidden; font-family: 'Consolas', monospace; box-shadow: inset 0 0 20px rgba(0,0,0,0.8); width: 100%; }
.m-flux-header { background: rgba(0, 242, 255, 0.05); padding: 8px 15px; font-size: 0.7rem; color: var(--m-primary); letter-spacing: 1px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 242, 255, 0.1); }
.m-flux-input { width: 100%; background: transparent; border: none; color: #fff; padding: 15px; font-size: 0.75rem; resize: none; min-height: 80px; line-height: 1.4; outline: none; font-family: 'Consolas', monospace; white-space: pre-wrap; word-break: break-all; }

.m-credits-section {
    margin: 20px 10px 10px 10px;
    padding: 0;
    background: transparent;
    border: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.m-neural-frame {
    background: rgba(5, 8, 12, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 15px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 5;
}

.m-neural-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.m-nh-title { font-family: 'Rajdhani', sans-serif; font-size: 0.7rem; letter-spacing: 2px; color: var(--m-dim); font-weight: 700; text-transform: uppercase; }
.m-nh-id { font-family: 'Courier New', monospace; font-size: 0.6rem; color: var(--m-primary); opacity: 0.7; }

.m-neural-grid { display: grid; grid-template-columns: 1.8fr 1fr; gap: 10px; }

.m-dev-module {
    background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2));
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}
.m-dev-module:active { transform: scale(0.98); border-color: var(--m-primary); background: rgba(0, 242, 255, 0.05); }

.m-dev-img { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); object-fit: cover; }
.m-dev-data { display: flex; flex-direction: column; }
.m-dev-role { font-size: 0.5rem; color: var(--m-primary); letter-spacing: 1px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
.m-dev-nick { font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: #fff; font-weight: 800; }

.m-support-module {
    background: linear-gradient(135deg, rgba(255, 94, 91, 0.1), rgba(0,0,0,0.2));
    border: 1px solid rgba(255, 94, 91, 0.3);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: all 0.3s ease;
    position: relative;
}
.m-support-module:active { transform: scale(0.98); background: rgba(255, 94, 91, 0.2); box-shadow: 0 0 15px rgba(255, 94, 91, 0.2); }
.m-kofi-ico { font-size: 1.1rem; color: var(--m-kofi); margin-bottom: 4px; animation: heartbeat 1.5s infinite; filter: drop-shadow(0 0 5px var(--m-kofi)); }
.m-support-txt { font-family: 'Rajdhani'; font-weight: 800; font-size: 0.75rem; color: #fff; letter-spacing: 1px; }

/* --- UPDATED STAR MODULE --- */
.m-star-btn {
    margin-top: 10px;
    background: linear-gradient(90deg, rgba(255, 153, 0, 0.1), rgba(255, 153, 0, 0.05), rgba(255, 153, 0, 0.1));
    border: 1px solid rgba(255, 153, 0, 0.3);
    border-radius: 12px;
    padding: 10px 15px; /* Compact padding */
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    color: var(--m-amber);
    font-family: 'Rajdhani', sans-serif;
    font-weight: 800;
    letter-spacing: 1px;
    font-size: 0.75rem; /* Smaller Font */
    box-shadow: 0 0 10px rgba(255, 153, 0, 0.1);
    transition: all 0.3s ease;
    text-transform: uppercase;
    position: relative;
    overflow: hidden;
}
.m-star-btn:active { transform: scale(0.98); box-shadow: 0 0 20px var(--m-amber); color: #fff; background: var(--m-amber); border-color: var(--m-amber); }
.m-star-btn::before {
    content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transform: skewX(-25deg);
    animation: shimmer 4s infinite;
}
@keyframes shimmer { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
.spin-star { animation: pulseStar 2s infinite ease-in-out; text-shadow: 0 0 5px var(--m-amber); font-size: 0.9rem; }
@keyframes pulseStar { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } }

.m-neural-footer { margin-top: 10px; text-align: center; font-size: 0.6rem; color: rgba(255,255,255,0.2); font-family: monospace; letter-spacing: 2px; }

/* --- COMMAND DOCK --- */
.m-dock-container { 
    position: fixed; 
    bottom: 0; 
    left: 0; 
    width: 100%; 
    background: rgba(3, 5, 8, 0.98); 
    border-top: 1px solid rgba(0, 242, 255, 0.2); 
    box-shadow: 0 -10px 40px rgba(0,0,0,0.9);
    z-index: 9999; 
    display: flex; flex-direction: column; 
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    backdrop-filter: blur(20px); 
    touch-action: none; 
}

.m-dock-container::before {
    content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 40%; height: 1px; background: linear-gradient(90deg, transparent, var(--m-primary), transparent);
    box-shadow: 0 0 10px var(--m-primary);
}

.m-dock-actions { 
    display: flex; gap: 8px; padding: 10px 15px 5px 15px; 
    border-bottom: 1px solid rgba(255,255,255,0.05); 
}

.m-btn-install { 
    flex: 2.5; 
    background: linear-gradient(90deg, var(--m-primary), #00a8ff); 
    color: #000; border: none; border-radius: 8px; height: 38px;
    font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; font-weight: 800; 
    text-transform: uppercase; letter-spacing: 1px; 
    display: flex; align-items: center; justify-content: center; gap: 8px; 
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.15); 
    transition: all 0.2s; position: relative; overflow: hidden; 
}

.m-btn-copy { 
    flex: 1; 
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
    color: var(--m-dim); border-radius: 8px; height: 38px; 
    display: flex; flex-direction: column; align-items: center; justify-content: center; 
    font-family: 'Rajdhani', sans-serif; font-size: 0.6rem; font-weight: 700; 
    transition: all 0.2s; 
}
.m-btn-copy i { font-size: 0.9rem; margin-bottom: 1px; color: #fff; }

.m-dock-nav { 
    display: flex; justify-content: space-around; align-items: center; 
    padding: 6px 0 2px 0; 
}

.m-nav-item { 
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; 
    color: #555; width: 60px; transition: all 0.25s cubic-bezier(0.25, 1.5, 0.5, 1); 
    position: relative;
    padding: 4px 0;
}
.m-nav-item i { font-size: 1rem; transition: color 0.2s; }
.m-nav-item span { font-size: 0.55rem; font-weight: 700; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px; }

.m-nav-item.active { color: #fff; transform: translateY(-2px); }
.m-nav-item.active i { color: var(--m-primary); filter: drop-shadow(0 0 8px var(--m-primary)); }
.m-nav-item.active::after {
    content: ''; position: absolute; bottom: -2px; width: 4px; height: 4px; 
    background: var(--m-primary); border-radius: 50%; box-shadow: 0 0 6px var(--m-primary);
}

.m-custom-dash { margin-top: 15px; background: rgba(0, 0, 0, 0.4); border: 1px dashed rgba(0, 242, 255, 0.3); border-radius: 12px; padding: 15px; animation: slideDown 0.3s ease; display: none; }
.m-custom-desc { font-size: 0.75rem; color: var(--m-dim); margin-bottom: 12px; font-family: 'Outfit', sans-serif; line-height: 1.4; border-left: 2px solid var(--m-primary); padding-left: 8px; }
.m-tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.m-tag-item { font-family: 'Rajdhani', monospace; font-size: 0.7rem; font-weight: 700; background: rgba(255, 255, 255, 0.08); padding: 3px 6px; border-radius: 4px; color: #fff; border: 1px solid rgba(255, 255, 255, 0.1); cursor: default; }

.m-aio-lock { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 2, 5, 0.9); z-index: 20; display: none; flex-direction: column; align-items: center; justify-content: center; text-align: center; backdrop-filter: blur(4px); }
.m-aio-lock.active { display: flex; }
.m-lock-icon { font-size: 2rem; color: var(--m-secondary); margin-bottom: 10px; }
.m-lock-text { font-family: 'Rajdhani'; color: #fff; font-weight: 800; font-size: 1.1rem; }
.m-lock-sub { font-size: 0.75rem; color: #888; margin-top: 5px; max-width: 80%; }

@keyframes shakeGlow {
    0%, 100% { transform: translateX(0); border-color: rgba(170,0,255,0.2); box-shadow: none; }
    20% { transform: translateX(-5px); border-color: var(--m-secondary); box-shadow: 0 0 20px var(--m-secondary), inset 0 0 10px var(--m-secondary); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
}
.m-denied-anim {
    animation: shakeGlow 0.4s cubic-bezier(.36,.07,.19,.97) both;
}

.m-recalc-overlay {
    position: absolute; top:0; left:0; width:100%; height:100%;
    background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 10; opacity: 0; pointer-events: none;
    transition: opacity 0.2s;
    backdrop-filter: blur(2px);
}
.m-recalc-overlay.visible { opacity: 1; }
.m-recalc-text {
    font-family: 'Rajdhani'; font-weight: 800; color: var(--m-primary);
    letter-spacing: 2px; text-transform: uppercase; font-size: 0.9rem;
    display: flex; align-items: center; gap: 10px;
    text-shadow: 0 0 10px var(--m-primary);
}

.m-toast-container {
    position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
    z-index: 999; pointer-events: none; width: 90%; max-width: 300px;
    display: flex; flex-direction: column; gap: 10px;
}
.m-toast {
    background: rgba(5, 10, 15, 0.95);
    border: 1px solid var(--m-primary);
    border-left: 4px solid var(--m-primary);
    box-shadow: 0 5px 20px rgba(0,0,0,0.8);
    color: #fff; padding: 12px 15px; border-radius: 8px;
    font-family: 'Rajdhani'; font-size: 0.9rem; font-weight: 700;
    display: flex; align-items: center; gap: 12px;
    animation: slideUpFade 0.3s ease-out forwards;
    backdrop-filter: blur(5px);
}
.m-toast.warning { border-color: var(--m-amber); border-left-color: var(--m-amber); color: var(--m-amber); }
.m-toast.error { border-color: var(--m-error); border-left-color: var(--m-error); color: var(--m-error); }
.m-toast.success { border-color: var(--m-success); border-left-color: var(--m-success); color: var(--m-success); }
@keyframes slideUpFade {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
.m-toast.out { animation: fadeOut 0.3s ease-out forwards; }
@keyframes fadeOut { to { opacity: 0; transform: translateY(-10px); } }
`;

const mobileHTML = `
<div id="app-container">
    <div class="m-content-wrapper">
        <div class="m-ptr" id="m-ptr-indicator"><i class="fas fa-arrow-down m-ptr-icon"></i></div>

        <div class="m-content">
            <div class="m-hero">
                <div class="logo-container">
                    <img src="https://i.ibb.co/j9tSSy7f/Gemini-Generated-Image-xep84gxep84gxep8-Photoroom.png" alt="Leviathan Logo" class="logo-image">
                    <div class="logo-particles" id="logoParticles"></div>
                </div>
                
                <h1 class="m-brand-title">LEVIATHAN</h1>
                <div class="m-brand-sub">SOVRANO DEGLI ABISSI</div>
                <div class="m-version-tag"><div class="m-v-dot"></div>v2.7.0 STABLE</div>
            </div>

            <div id="page-setup" class="m-page active">
                
                <div class="m-hypervisor">
                    <div class="m-hyp-header">
                        <span>ACCESS CREDENTIALS</span>
                        <i class="fas fa-fingerprint m-hyp-icon"></i>
                    </div>

                    <div class="m-srv-rail">
                        <div class="m-srv-btn active" onclick="setMService('rd', this)"><span class="m-rail-icon">🐋</span> RD</div>
                        <div class="m-srv-btn" onclick="setMService('tb', this)"><span class="m-rail-icon">⚓</span> TB</div>
                        <div class="m-srv-btn" onclick="setMService('p2p', this)"><span class="m-rail-icon">🦈</span> P2P</div>
                    </div>

                    <div class="m-field-group">
                        <div class="m-field-header">
                            <span class="m-field-label">API KEY</span>
                            <div class="m-field-link" onclick="openApiPage()">OTTIENI <i class="fas fa-external-link-alt"></i></div>
                        </div>
                        <div class="m-input-box">
                            <i class="fas fa-key m-input-ico"></i>
                            <input type="text" id="m-apiKey" class="m-input-tech" placeholder="Incolla la tua chiave qui..." oninput="updateLinkModalContent()">
                            <div class="m-paste-action" onclick="pasteTo('m-apiKey')"><i class="fas fa-paste"></i></div>
                        </div>
                    </div>

                    <div class="m-field-group">
                        <div class="m-field-header">
                            <span class="m-field-label" style="color:var(--m-accent)">TMDB (Opzionale)</span>
                            <div class="m-field-link" style="color:var(--m-accent)" onclick="openApiPage('tmdb')">OTTIENI <i class="fas fa-external-link-alt"></i></div>
                        </div>
                        <div class="m-input-box tmdb-box">
                            <i class="fas fa-film m-input-ico"></i>
                            <input type="text" id="m-tmdb" class="m-input-tech" placeholder="Chiave Personale (Opzionale)" oninput="updateLinkModalContent()">
                            <div class="m-paste-action" onclick="pasteTo('m-tmdb')"><i class="fas fa-paste"></i></div>
                        </div>
                    </div>
                </div>

                <div class="m-hypervisor">
                     <div class="m-hyp-header">
                        <span>WEB MODULES</span>
                        <i class="fas fa-cubes m-hyp-icon"></i>
                    </div>

                    <div class="m-sys-grid">
                        
                        <div class="m-sys-row">
                            <div class="m-sys-info">
                                <h4>
                                    <i class="fas fa-play-circle" style="color:var(--m-secondary)"></i> StreamingCommunity
                                    <span class="m-noproxy-badge">NO PROXY</span>
                                </h4>
                                <p>Scraper Veloce & Affidabile</p>
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

                        <div class="m-sys-row">
                            <div class="m-sys-info">
                                <h4>
                                    <i class="fas fa-film" style="color:var(--m-primary)"></i> GuardaHD 
                                    <span class="m-proxy-badge"><i class="fas fa-shield-alt"></i> MFP</span>
                                </h4>
                                <p>Film Streaming ITA</p>
                            </div>
                            <label class="m-switch">
                                <input type="checkbox" id="m-enableGhd" onchange="updateStatus('m-enableGhd','st-ghd'); toggleModuleStyle('m-enableGhd', 'mod-ghd');">
                                <span class="m-slider"></span>
                            </label>
                        </div>

                        <div class="m-sys-row">
                            <div class="m-sys-info">
                                <h4>
                                    <i class="fas fa-tv" style="color:var(--m-accent)"></i> GuardaSerie 
                                    <span class="m-proxy-badge"><i class="fas fa-shield-alt"></i> MFP</span>
                                </h4>
                                <p>Serie TV ITA</p>
                            </div>
                            <label class="m-switch">
                                <input type="checkbox" id="m-enableGs" onchange="updateStatus('m-enableGs','st-gs'); toggleModuleStyle('m-enableGs', 'mod-gs');">
                                <span class="m-slider m-slider-purple"></span>
                            </label>
                        </div>

                        <div class="m-sys-row">
                            <div class="m-sys-info">
                                <h4>
                                    <i class="fas fa-torii-gate" style="color:#ff6600"></i> AnimeWorld 
                                    <span class="m-noproxy-badge">NO PROXY</span>
                                </h4>
                                <p>Anime ITA Database</p>
                            </div>
                            <label class="m-switch">
                                <input type="checkbox" id="m-enableAnimeWorld" onchange="updateStatus('m-enableAnimeWorld','st-aw'); toggleModuleStyle('m-enableAnimeWorld', 'mod-aw');">
                                <span class="m-slider m-slider-amber"></span>
                            </label>
                        </div>

                        <div class="m-sys-row">
                            <div class="m-sys-info">
                                <h4><i class="fas fa-spider" style="color:#fff"></i> WebStreamr</h4>
                                <p>Fallback di emergenza (No-Debrid)</p>
                            </div>
                            <label class="m-switch">
                                <input type="checkbox" id="m-enableWebStreamr" checked onchange="toggleModuleStyle('m-enableWebStreamr', 'mod-webstr');">
                                <span class="m-slider" style="background-color:#333;"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div id="m-priority-panel" class="m-priority-wrapper">
                    <div style="margin-top:5px; padding:15px; border-radius:16px; background:linear-gradient(90deg, rgba(112,0,255,0.1), transparent); border-left:4px solid var(--m-secondary);">
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
                    <div class="m-neural-frame">
                        <div class="m-neural-header">
                            <span class="m-nh-title">/// NEURAL SIGNATURE ///</span>
                            <span class="m-nh-id">ID: L3V-2026</span>
                        </div>
                        
                        <div class="m-neural-grid">
                            <a href="https://github.com/LUC4N3X/stremio-leviathan-addon" target="_blank" class="m-dev-module">
                                <img src="https://i.ibb.co/gLkrjxXT/Whats-App-Image-2026-01-12-at-20-15-37.jpg" alt="Dev" class="m-dev-img">
                                <div class="m-dev-data">
                                    <span class="m-dev-role">ARCHITECT</span>
                                    <span class="m-dev-nick">LUC4N3X</span>
                                </div>
                                <i class="fab fa-github" style="position:absolute; right:10px; top:10px; color:rgba(255,255,255,0.1); font-size:1.5rem;"></i>
                            </a>

                            <a href="https://ko-fi.com/luc4n3x" target="_blank" class="m-support-module">
                                <i class="fas fa-mug-hot m-kofi-ico"></i>
                                <span class="m-support-txt">KO-FI</span>
                            </a>
                        </div>
                        
                        <a href="https://stremio-addons.net/addons/leviathan" target="_blank" class="m-star-btn">
                            <i class="fas fa-star spin-star"></i> 
                            <span>LASCIAMI UNA STELLA</span>
                            <i class="fas fa-star spin-star"></i>
                        </a>

                        <div class="m-neural-footer">LEVIATHAN SYSTEM v2.7.0</div>
                    </div>
                </div>
            </div>

            <div id="page-filters" class="m-page">
                
                <div class="m-visual-core-v2" id="m-visual-core-v2">
                
                     <div class="m-hyp-header" style="margin-bottom:15px; border:none; padding-bottom:0;">
                        <span>VISUAL FORMATTER</span>
                        <i class="fas fa-swatchbook m-hyp-icon"></i>
                     </div>
                
                     <div class="m-aio-lock" id="m-aio-lock-overlay">
                        <i class="fas fa-lock m-lock-icon"></i>
                        <div class="m-lock-text">OVERRIDDEN BY AIO CORE</div>
                        <div class="m-lock-sub">Disabilita "Compatibilità AIO" per sbloccare le skin.</div>
                    </div>

                    <div class="m-visual-preview" id="m-preview-box">
                        <div class="m-recalc-overlay" id="m-recalc-layer">
                            <div class="m-recalc-text"><i class="fas fa-cog fa-spin"></i> UPDATING CORE...</div>
                        </div>
                        
                        <div class="m-vp-icon"><i class="fas fa-film"></i></div>
                        <div class="m-vp-text">
                            <div class="m-vp-title" id="m-prev-title">LEVIATHAN</div>
                            <div class="m-vp-sub" id="m-prev-info">...</div>
                        </div>
                    </div>

                    <div class="m-cortex-grid">
                        <div class="m-cortex-chip active" id="msk_leviathan" onclick="selectMobileSkin('leviathan')">
                            <div class="m-chip-icon">🦑</div>
                            <div class="m-chip-label">Leviathan</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_lev2" onclick="selectMobileSkin('lev2')">
                            <div class="m-chip-icon">🧬</div>
                            <div class="m-chip-label">Archetype</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_fra" onclick="selectMobileSkin('fra')">
                            <div class="m-chip-icon">⚡️</div>
                            <div class="m-chip-label">Horizon</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_comet" onclick="selectMobileSkin('comet')">
                            <div class="m-chip-icon">☄️</div>
                            <div class="m-chip-label">Comet</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_stremio_ita" onclick="selectMobileSkin('stremio_ita')">
                            <div class="m-chip-icon">🇮🇹</div>
                            <div class="m-chip-label">Ita Mod</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_dav" onclick="selectMobileSkin('dav')">
                            <div class="m-chip-icon">📼</div>
                            <div class="m-chip-label">Databank</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_pri" onclick="selectMobileSkin('pri')">
                            <div class="m-chip-icon">👑</div>
                            <div class="m-chip-label">Eclipse</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_and" onclick="selectMobileSkin('and')">
                            <div class="m-chip-icon">🎬</div>
                            <div class="m-chip-label">Matrix</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_lad" onclick="selectMobileSkin('lad')">
                            <div class="m-chip-icon">🎟️</div>
                            <div class="m-chip-label">Compact</div>
                        </div>
                        <div class="m-cortex-chip" id="msk_custom" onclick="selectMobileSkin('custom')" style="grid-column: span 3; border-style: dashed; background: rgba(0,0,0,0.3);">
                            <div class="m-chip-icon">🛠️</div>
                            <div class="m-chip-label">CUSTOM BUILDER</div>
                        </div>
                    </div>
                    
                    <div id="m-custom-skin-area" class="m-custom-dash">
                        <div class="m-custom-desc">
                            Usa i tag dinamici per costruire il tuo formato. Incolla il template qui sotto:
                        </div>
                        <div class="m-tag-list">
                            <div class="m-tag-item">{title}</div>
                            <div class="m-tag-item">{quality}</div>
                            <div class="m-tag-item">{size}</div>
                            <div class="m-tag-item">{source}</div>
                            <div class="m-tag-item">{service}</div>
                        </div>
                        <input type="text" class="m-input" id="m-customTemplate" placeholder="Es: Lev {quality} ||| {title}" style="padding:10px; font-size:0.9rem; border:1px solid rgba(255,255,255,0.3);" oninput="updateMobilePreview(); updateLinkModalContent()">
                    </div>
                </div>

                <div class="m-hypervisor">
                    <div class="m-hyp-header">
                        <span>SYSTEM HYPERVISOR</span>
                        <i class="fas fa-microchip m-hyp-icon"></i>
                    </div>
                    
                    <p class="m-hyp-desc" style="margin-bottom:15px;">
                        Ottimizza l'algoritmo di ricerca in base alle tue preferenze di visione.
                    </p>

                    <div class="m-flux-control">
                        <div class="m-flux-grid">
                            <div class="m-flux-opt active-bal" id="sort-balanced" onclick="setSortMode('balanced')">
                                <i class="fas fa-dragon"></i>
                                <span>BALANCED</span>
                            </div>
                            <div class="m-flux-opt" id="sort-resolution" onclick="setSortMode('resolution')">
                                <i class="fas fa-gem"></i>
                                <span>QUALITY</span>
                            </div>
                            <div class="m-flux-opt" id="sort-size" onclick="setSortMode('size')">
                                <i class="fas fa-hdd"></i>
                                <span>SIZE</span>
                            </div>
                        </div>
                        
                        <div class="m-flux-readout mode-bal" id="flux-readout-box">
                            <i class="fas fa-info-circle m-fr-icon" id="flux-icon-display"></i>
                            <div class="m-fr-text">
                                <span class="m-fr-title" id="flux-title-display">STANDARD MODE</span>
                                <span class="m-fr-desc" id="flux-desc-display">L'algoritmo standard di Leviathan. Bilancia perfettamente qualità e velocità.</span>
                            </div>
                        </div>
                    </div>

                    <div class="m-hyp-header" style="margin-top:25px; border-top:none; padding-top:0; margin-bottom:10px;">
                         <span>AUDIO & LANGUAGE</span>
                         <i class="fas fa-globe-americas m-hyp-icon"></i>
                    </div>
                    
                    <div class="m-lang-grid">
                        <div class="m-lang-opt active-ita" id="lang-ita" onclick="setLangMode('ita')">
                            <i class="fas fa-flag"></i>
                            <span class="m-lang-txt">ITA ONLY</span>
                        </div>
                        <div class="m-lang-opt" id="lang-ita-eng" onclick="setLangMode('ita-eng')">
                            <i class="fas fa-comments"></i>
                            <span class="m-lang-txt">ITA + ENG</span>
                        </div>
                        <div class="m-lang-opt" id="lang-eng" onclick="setLangMode('eng')">
                            <i class="fas fa-flag-usa"></i>
                            <span class="m-lang-txt">ENG ONLY</span>
                        </div>
                    </div>

                    <div id="lang-desc-container" style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px; margin-bottom: 25px; border-left: 3px solid var(--m-primary);">
                        <p id="lang-description" style="margin:0; font-size: 0.7rem; color: var(--m-dim); line-height: 1.3; font-family:'Outfit';">
                             Cerca solo contenuti in Italiano. Ignora tutto il resto.
                        </p>
                    </div>

                    <div class="m-hyp-label">Resolution Filter (Exclude)</div>
                    <p class="m-hyp-desc">Tocca per escludere risoluzioni specifiche.</p>
                    
                    <div class="m-chip-grid">
                        <div class="m-qual-chip" id="mq-4k" onclick="toggleFilter('mq-4k')">4K UHD</div>
                        <div class="m-qual-chip" id="mq-1080" onclick="toggleFilter('mq-1080')">1080p</div>
                        <div class="m-qual-chip" id="mq-720" onclick="toggleFilter('mq-720')">720p <span class="mini-tag">HD</span></div>
                        <div class="m-qual-chip" id="mq-sd" onclick="toggleFilter('mq-sd')">CAM/SD</div>
                    </div>

                    <div class="m-sys-grid">
                        <div class="m-sys-row">
                            <div class="m-sys-info"><h4><i class="fas fa-layer-group" style="color:var(--m-accent)"></i> AIO Mode <span class="m-status-text" id="st-aio">OFF</span></h4><p>Formatta per AIOStreams</p></div>
                            <label class="m-switch"><input type="checkbox" id="m-aioMode" onchange="updateStatus('m-aioMode','st-aio')"><span class="m-slider m-slider-purple"></span></label>
                        </div>
                        <div class="m-sys-row">
                            <div class="m-sys-info"><h4><i class="fas fa-film" style="color:var(--m-cine)"></i> Trailer Mode <span class="m-status-text" id="st-trailer">OFF</span></h4><p>Cinema Experience</p></div>
                            <label class="m-switch"><input type="checkbox" id="m-enableTrailers" onchange="updateStatus('m-enableTrailers','st-trailer')"><span class="m-slider m-slider-pink"></span></label>
                        </div>
                    </div>

                    <div class="m-row" style="border:none; padding: 5px 0;">
                        <div class="m-label">
                            <h4><i class="fas fa-compress-arrows-alt" style="color:var(--m-error)"></i> Signal Gate <span class="m-status-text" id="st-gate">OFF</span></h4>
                            <p style="font-size:0.65rem; color:var(--m-error);">Filtro Qualità (Max risultati per ris.)</p>
                        </div>
                        <label class="m-switch"><input type="checkbox" id="m-gateActive" onchange="toggleGate()"><span class="m-slider"></span></label>
                    </div>
                    <div id="m-gate-wrapper" class="m-gate-wrapper">
                        <div class="m-gate-control">
                            <span style="font-size:0.8rem; color:#666;">1</span>
                            <input type="range" min="1" max="20" value="3" class="m-range" id="m-gateVal" oninput="updateGateDisplay(this.value)">
                            <span style="font-family:'Rajdhani'; font-weight:800; font-size:1.2rem; color:var(--m-primary); width:30px; text-align:center;" id="m-gate-display">3</span>
                        </div>
                        <p class="m-range-desc">Limita il numero di risultati mostrati per ogni qualità. Utile per dispositivi lenti.</p>
                    </div>

                    <div class="m-row" style="border:none; padding: 5px 0;">
                        <div class="m-label">
                            <h4><i class="fas fa-weight-hanging" style="color:var(--m-amber)"></i> Size Limit <span class="m-status-text" id="st-size">OFF</span></h4>
                            <p style="font-size:0.65rem; color:var(--m-amber);">Filtro Peso Massimo (GB)</p>
                        </div>
                        <label class="m-switch"><input type="checkbox" id="m-sizeActive" onchange="toggleSize()"><span class="m-slider m-slider-amber"></span></label>
                    </div>
                     <div id="m-size-wrapper" class="m-gate-wrapper">
                        <div class="m-gate-control">
                            <span style="font-size:0.8rem; color:#666;">1GB</span>
                            <input type="range" min="1" max="100" step="1" value="0" class="m-range" id="m-sizeVal" oninput="updateSizeDisplay(this.value)" style="background:linear-gradient(90deg, #ff9900, #333)">
                            <span style="font-family:'Rajdhani'; font-weight:800; font-size:1.1rem; color:var(--m-amber); width:45px; text-align:center;" id="m-size-display">∞</span>
                        </div>
                         <p class="m-range-desc">Nasconde automaticamente tutti i file che superano la dimensione selezionata.</p>
                    </div>

                </div>
            </div>

            <div id="page-network" class="m-page">
                <div class="m-hypervisor">
                    <div class="m-hyp-header">
                        <span>NETWORK BRIDGE</span>
                        <i class="fas fa-network-wired m-hyp-icon" style="color:var(--m-secondary)"></i>
                    </div>
                    
                    <div style="padding:0 5px;">
                        <p style="font-size:0.8rem; color:var(--m-dim); margin-bottom:20px; line-height:1.4;">
                            Proxy Server necessario per i moduli Italiani. Se attivo, il <b>Debrid Ghost</b> userà questo server per nascondere il tuo IP reale.
                        </p>

                        <div class="m-field-group">
                            <div class="m-field-header"><span class="m-field-label">SERVER URL</span></div>
                            <div class="m-input-box">
                                <i class="fas fa-server m-input-ico"></i>
                                <input type="text" id="m-mfUrl" class="m-input-tech" placeholder="https://tuo-proxy.com" oninput="updateLinkModalContent()">
                                <div class="m-paste-action" onclick="pasteTo('m-mfUrl')"><i class="fas fa-paste"></i></div>
                            </div>
                        </div>

                        <div class="m-field-group">
                            <div class="m-field-header"><span class="m-field-label">PASSWORD</span></div>
                            <div class="m-input-box">
                                <i class="fas fa-lock m-input-ico"></i>
                                <input type="password" id="m-mfPass" class="m-input-tech" placeholder="••••••••" oninput="updateLinkModalContent()">
                            </div>
                        </div>

                        <div class="m-ghost-panel" id="ghost-zone-box">
                            <div class="m-ghost-head">
                                <div class="m-ghost-title"><i class="fas fa-user-shield"></i> DEBRID GHOST</div>
                                <div class="m-ghost-status" id="ghost-status-text">VISIBLE</div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <p style="margin:0; font-size:0.75rem; color:rgba(255,255,255,0.6); max-width:70%;">
                                    Instrada il traffico Debrid attraverso il Proxy configurato.
                                </p>
                                <label class="m-switch">
                                    <input type="checkbox" id="m-proxyDebrid" onchange="updateGhostVisuals(); updateLinkModalContent()">
                                    <span class="m-slider m-slider-purple"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div> 
    </div>

    <div class="m-dock-container">
        <div class="m-dock-actions">
            <button class="m-btn-install" onclick="mobileInstall()">
                <i class="fas fa-download"></i> INSTALLA
            </button>
            <button class="m-btn-copy" onclick="openLinkModal()">
                <i class="fas fa-link"></i><span>COPIA</span>
            </button>
        </div>
        <div class="m-dock-nav">
            <div class="m-nav-item active" onclick="navTo('setup', this)">
                <i class="fas fa-sliders-h"></i><span>SETUP</span>
            </div>
            <div class="m-nav-item" onclick="navTo('filters', this)">
                <i class="fas fa-filter"></i><span>FILTRI</span>
            </div>
            <div class="m-nav-item" onclick="navTo('network', this)">
                <i class="fas fa-globe"></i><span>NET</span>
            </div>
        </div>
    </div>
    
    <div class="m-action-modal" id="m-link-modal">
        <div class="m-am-card">
            <div class="m-am-title">LINK GENERATO</div>
            <div class="m-am-subtitle">Scegli come procedere</div>
            
            <div class="m-flux-terminal">
                <div class="m-flux-header">
                    <span>FLUX DATA STREAM</span>
                    <i class="fas fa-network-wired"></i>
                </div>
                <textarea id="m-generatedUrlBox" class="m-flux-input" readonly>/// WAITING FOR DATA ///</textarea>
            </div>
            
            <div class="m-act-btn m-act-copy" onclick="copyFromModal()">
                <i class="fas fa-copy"></i> COPIA NEGLI APPUNTI
            </div>
            
            <div class="m-act-btn m-act-close" onclick="closeLinkModal()">
                CHIUDI
            </div>
        </div>
    </div>
    
    <div class="m-toast-container" id="m-toast-area"></div>

</div>
`;

// --- LOGIC ---

let mCurrentService = 'rd';
let mScQuality = 'all';
let mSortMode = 'balanced';
let mSkin = 'leviathan';
let mLangMode = 'ita';

const fluxData = {
    'balanced': {
        title: "STANDARD MODE",
        desc: "L'algoritmo standard di Leviathan. Bilancia perfettamente qualità, popolarità del file e velocità.",
        icon: "fa-dragon"
    },
    'resolution': {
        title: "VISUAL FIDELITY",
        desc: "Gerarchia visiva rigida. I risultati 4K UHD appariranno sempre in cima alla lista.",
        icon: "fa-gem"
    },
    'size': {
        title: "DATA HEAVY",
        desc: "Ordina per dimensione del file. Ideale per chi cerca il massimo bitrate possibile.",
        icon: "fa-hdd"
    }
};

const langDescriptions = {
    'ita': "Solo contenuti in Italiano. Ignora tutto il resto.",
    'ita-eng': "Cerca prima in Italiano. Se non trova nulla, mostra i risultati in Inglese.",
    'eng': "Solo contenuti in Inglese."
};

const skinMaps = {
    'bold': {
        nums: {'0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵'},
        chars: {'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝','K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧','U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭','a':'𝗮','b':'𝗯','c':'𝗰','d':'𝗱','e':'𝗲','f':'𝗳','g':'𝗴','h':'𝗵','i':'𝗶','j':'j','k':'𝗸','l':'𝗹','m':'𝗺','n':'𝗻','o':'ᴏ','p':'ᴘ','q':'𝗾','r':'𝗿','s':'𝘀','t':'𝘁','u':'𝘂','v':'𝘃','w':'𝘄','x':'𝘅','y':'𝘆','z':'ᴢ'}
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

function showToast(msg, type = 'info') {
    const container = document.getElementById('m-toast-area');
    if(!container) return;
    const el = document.createElement('div');
    el.className = `m-toast ${type}`;
    
    let icon = 'fa-info-circle';
    if(type === 'warning') icon = 'fa-exclamation-triangle';
    if(type === 'error') icon = 'fa-bug';
    if(type === 'success') icon = 'fa-check-circle';
    
    el.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(el);
    
    if(navigator.vibrate) navigator.vibrate(20);
    
    setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function triggerPreviewUpdateEffect() {
    const layer = document.getElementById('m-recalc-layer');
    if(!layer) return;
    
    layer.classList.add('visible');
    setTimeout(() => {
        layer.classList.remove('visible');
    }, 400); 
}

function selectMobileSkin(skinId) {
    const isAIO = document.getElementById('m-aioMode').checked;
    
    if (isAIO && skinId !== 'leviathan') {
        const lockOverlay = document.getElementById('m-aio-lock-overlay');
        lockOverlay.classList.remove('m-denied-anim');
        void lockOverlay.offsetWidth; 
        lockOverlay.classList.add('m-denied-anim');
        
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]); 
        showToast("SKIN BLOCCATA DA AIO MODE", "warning");
        return; 
    }

    mSkin = skinId;
    document.querySelectorAll('.m-cortex-chip').forEach(b => b.classList.remove('active'));
    const selectedBtn = document.getElementById('msk_' + skinId);
    if(selectedBtn) selectedBtn.classList.add('active');
    
    const customArea = document.getElementById('m-custom-skin-area');
    if(skinId === 'custom') customArea.style.display = 'block';
    else customArea.style.display = 'none';
    
    const previewBox = document.getElementById('m-preview-box');
    if(previewBox) {
        previewBox.classList.remove('glitching');
        void previewBox.offsetWidth;
        previewBox.classList.add('glitching');
    }
    updateMobilePreview();
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function updateMobilePreview() {
    let langStr = "🇮🇹 ITA";
    if(mLangMode === 'ita-eng') langStr = "🇮🇹 ITA 🇺🇸 ENG";
    if(mLangMode === 'eng') langStr = "🇺🇸 ENG";

    const p = {
        title: "Dune Parte Due",
        cleanName: "Dune Parte Due (2024)",
        quality: "4K",
        sizeString: "67.81 GB",
        source: "ilCorSaRoNeRo",
        displaySource: "ilCorSaRoNeRo",
        serviceTag: mCurrentService === 'p2p' ? "P2P" : mCurrentService.toUpperCase(),
        serviceIcon: mCurrentService === 'rd' ? "☄️" : (mCurrentService === 'tb' ? "📦" : "🦈"),
        lang: langStr,
        audioInfo: "🔊 ⚡ Stereo",
        info: "💎 𝗥𝗘𝗠𝗨𝗫 • 🔥 𝗛𝗗𝗥 • 👁️ 𝗗𝗩 • ⚙️ 𝗛𝗘𝗩𝗖", 
        cleanInfo: "Remux • HDR • DV",
        seedersStr: "152"
    };

    let name = "", desc = "";

    if (mSkin === 'leviathan') {
        const qualityBold = toStylized(p.quality, 'bold');
        const qIconOverride = p.serviceIcon;
        name = `🦑 𝗟𝗘𝗩𝗜𝗔𝗧𝗛𝗔𝗡\n${qIconOverride} ┃ ${qualityBold}`;
        desc = `📁 ${p.cleanName}\n🗣️ ${p.lang} • ${p.audioInfo}\n${p.info}\n🧲 ${p.sizeString} • 👥 ${p.seedersStr}\n${p.serviceIcon} [${p.serviceTag}] ${p.displaySource}`;
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
        if(p.serviceTag === "TB") servSmall = "ᴛᴏʀʙᴏx";
        desc = `🎬 ${titleBold}\n📦 ${sizeSmall} │ ʀᴇᴍᴜx │ ᴅᴏʟʙʏ ᴠɪsɪᴏɴ\n🔊 ${audioSmall} • 🇮🇹 ${langSmall}\n🔗 ${servSmall} │ ${srcSmall}`;
    } else if (mSkin === 'fra') {
        name = `⚡️ Leviathan 4K`;
        desc = `📄 ❯ ${p.cleanName}\n🌎 ❯ ${p.lang} • TrueHD\n✨ ❯ ${p.serviceTag} • ${p.source}\n🔥 ❯ 4K • Remux • HDR\n💾 ❯ ${p.sizeString} / 👥 ❯ 1337`;
    } else if (mSkin === 'comet') {
        name = `[${p.serviceTag} ⚡]\nLeviathan\n4K`;
        desc = `📄 ${p.cleanName}\n📹 HEVC • ${p.cleanInfo} | TrueHD\n⭐ ${p.source}\n💾 ${p.sizeString} 👥 1337\n🌍 ${p.lang}`;
    } else if (mSkin === 'stremio_ita') {
        name = `⚡️ Leviathan 4K`;
        desc = `📄 ❯ ${p.cleanName}\n🌎 ❯ ${p.lang}\n✨ ❯ ${p.serviceTag} • ${p.source}\n🔥 ❯ 4K • HEVC • ${p.cleanInfo}\n💾 ❯ ${p.sizeString} / 👥 ❯ 1337\n🔉 ❯ TrueHD • 7.1`;
    } else if (mSkin === 'dav') {
        name = `🎥4K UHD HEVC`;
        desc = `📺 ${p.cleanName}\n🎧 TrueHD 7.1 | 🎞️ HEVC\n🗣️ ${p.lang} | 📦 ${p.sizeString}\n⏱️ 1337 Seeds | 🏷️ ${p.source}\n${p.serviceIcon} Leviathan 📡 ${p.serviceTag}\n📂 ${p.title}`;
    } else if (mSkin === 'and') {
        name = `🎬 ${p.cleanName}`;
        desc = `4K ⚡\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─\nLingue: ${p.lang}\nSpecifiche: 4K | 📺 Remux HDR | 🔊 TrueHD\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n📂 ${p.sizeString} | ☁️ ${p.serviceTag} | 🛰️ Leviathan`;
    } else if (mSkin === 'lad') {
        name = `🖥️ 4K ${p.serviceTag}`;
        desc = `🎟️ ${p.cleanName}\n📜 Movie\n🎥 4K 🎞️ HEVC 🎧 TrueHD\n📦 ${p.sizeString} • 🔗 Leviathan\n🌐 ${p.lang}`;
    } else if (mSkin === 'pri') {
        name = `[${p.serviceTag}]⚡️☁️\n4K🔥UHD\n[Leviathan]`;
        desc = `🎬 ${toStylized(p.cleanName, 'bold')}\n💎 ʀᴇᴍᴜx 🔆 HDR\n🎧 TrueHD | 🔊 7.1 | 🗣️ ${p.lang}\n📁 ${p.sizeString} | 🏷️ ${p.source}\n📄 ▶️ ${p.title} ◀️`;
    } else if (mSkin === 'custom') {
        let tpl = document.getElementById('m-customTemplate').value || "Lev {quality} ||| {title} - {size}";
        tpl = tpl.replace("{title}", p.cleanName).replace("{quality}", p.quality)
                 .replace("{size}", p.sizeString).replace("{source}", p.source)
                 .replace("{service}", p.serviceTag).replace("{lang}", p.lang)
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

function createLogoParticles() {
    const container = document.getElementById('logoParticles');
    if(!container) return;
    const count = 6; 
    container.innerHTML = '';
    for(let i=0; i < count; i++) {
        const p = document.createElement('div');
        p.classList.add('logo-particle');
        const size = Math.random() * 4 + 2;
        p.style.width = `${size}px`; p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 10 + 5}s`;
        p.style.animationDelay = `-${Math.random() * 10}s`;
        const sway = Math.random() * 8 - 4;
        p.style.transform = `translateX(${sway}px)`;
        container.appendChild(p);
    }
}

function initMobileInterface() {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = mobileCSS;
    document.head.appendChild(styleSheet);
    document.body.innerHTML = mobileHTML;
    createLogoParticles();
    initPullToRefresh();
    loadMobileConfig();
    updateMobilePreview();
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
    document.querySelector('.m-content').scrollTop = 0;
    if(navigator.vibrate) navigator.vibrate(10);
}

function setMService(srv, btn, keepInput = false) {
    if(mCurrentService === srv && !keepInput) return;
    mCurrentService = srv;
    if (!keepInput) { document.getElementById('m-apiKey').value = ''; }

    document.querySelectorAll('.m-srv-btn').forEach(b => {
        b.classList.remove('active');
    });
    if(btn) {
        btn.classList.add('active');
    }
    
    const input = document.getElementById('m-apiKey');
    
    if (srv === 'p2p') {
        input.placeholder = "Nessuna API Key richiesta (P2P)";
        input.disabled = true;
        input.style.opacity = "0.5";
    } else {
        const placeholders = { 'rd': "RD API Key...", 'tb': "TB API Key..." };
        input.placeholder = placeholders[srv];
        input.disabled = false;
        input.style.opacity = "1";
    }

    updateMobilePreview(); 
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function updateStatus(inputId, statusId) {
    const chk = document.getElementById(inputId).checked;
    const lbl = document.getElementById(statusId);
    if(lbl) {
        lbl.innerText = chk ? "ON" : "OFF";
        if(chk) lbl.classList.add('on'); else lbl.classList.remove('on');
    }
    
    if(inputId === 'm-enableVix') toggleScOptions();
    if(inputId === 'm-aioMode') toggleMobileAIOLock();
    checkWebPriorityVisibility();
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function setLangMode(mode) {
    mLangMode = mode;
    const btnIta = document.getElementById('lang-ita');
    const btnHyb = document.getElementById('lang-ita-eng');
    const btnEng = document.getElementById('lang-eng');

    // Reset Classes
    [btnIta, btnHyb, btnEng].forEach(b => {
        b.className = 'm-lang-opt';
    });

    // Apply specific Active Class
    if(mode === 'ita') btnIta.classList.add('active-ita');
    if(mode === 'ita-eng') btnHyb.classList.add('active-hyb');
    if(mode === 'eng') btnEng.classList.add('active-eng');

    const descEl = document.getElementById('lang-description');
    if(descEl) {
        descEl.style.opacity = 0;
        setTimeout(() => {
            descEl.innerText = langDescriptions[mode];
            descEl.style.opacity = 1;
        }, 200);
    }
    updateMobilePreview();
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function checkWebPriorityVisibility() {
    const vix = document.getElementById('m-enableVix').checked;
    const ghd = document.getElementById('m-enableGhd').checked;
    const gs = document.getElementById('m-enableGs').checked;
    const aw = document.getElementById('m-enableAnimeWorld').checked;
    const panel = document.getElementById('m-priority-panel');
    if (vix || ghd || gs || aw) panel.classList.add('show');
    else panel.classList.remove('show');
}

function updatePriorityLabel() {
    const isLast = document.getElementById('m-vixLast').checked;
    const desc = document.getElementById('priority-desc');
    desc.innerText = isLast ? "Priorità Bassa: Risultati dopo i Torrent" : "Priorità Alta: Risultati in cima";
    desc.style.color = isLast ? "var(--m-secondary)" : "var(--m-primary)";
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate([15, 10, 15]);
}

function toggleScOptions() {
    const chk = document.getElementById('m-enableVix').checked;
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
    
    if(active) { 
        wrapper.classList.add('show'); 
        if(lbl) {lbl.innerText = "ON"; lbl.classList.add('on');}
        showToast("Signal Gate Attivo: Risultati Limitati", "warning");
    } else { 
        wrapper.classList.remove('show'); 
        if(lbl) {lbl.innerText = "OFF"; lbl.classList.remove('on');}
    }
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function updateGateDisplay(val) { document.getElementById('m-gate-display').innerText = val; updateLinkModalContent(); }

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
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function updateSizeDisplay(val) {
    const display = document.getElementById('m-size-display');
    if (val == 0) { display.innerText = "∞"; } else { display.innerText = val; }
    updateLinkModalContent();
}

function openApiPage(type) {
    if(type === 'tmdb') {
         window.open('https://www.themoviedb.org/settings/api', '_blank');
         return;
    }
    const links = { 'rd': 'https://real-debrid.com/apitoken', 'tb': 'https://torbox.app/settings' };
    if (links[mCurrentService]) window.open(links[mCurrentService], '_blank');
}
function setScQuality(val) {
    mScQuality = val;
    ['all','1080','720'].forEach(q => {
        const el = document.getElementById('mq-sc-'+q);
        if(el) el.classList.remove('active');
    });
    const activeEl = document.getElementById('mq-sc-' + val);
    if(activeEl) activeEl.classList.add('active');
    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function setSortMode(mode) {
    mSortMode = mode;
    ['balanced', 'resolution', 'size'].forEach(m => {
        const btn = document.getElementById('sort-' + m);
        const map = {'balanced':'active-bal', 'resolution':'active-res', 'size':'active-sz'};
        
        // Remove ALL active classes
        btn.classList.remove('active-bal', 'active-res', 'active-sz');
        
        if(m === mode) btn.classList.add(map[m]);
    });
    
    const readout = document.getElementById('flux-readout-box');
    const title = document.getElementById('flux-title-display');
    const desc = document.getElementById('flux-desc-display');
    const icon = document.getElementById('flux-icon-display');
    
    readout.className = "m-flux-readout"; 
    
    // Tiny fade effect
    readout.style.opacity = 0.5;
    setTimeout(() => {
        if(mode === 'balanced') readout.classList.add('mode-bal');
        if(mode === 'resolution') readout.classList.add('mode-res');
        if(mode === 'size') readout.classList.add('mode-sz');
        
        title.innerText = fluxData[mode].title;
        desc.innerText = fluxData[mode].desc;
        icon.className = `fas ${fluxData[mode].icon} m-fr-icon`;
        
        readout.style.opacity = 1;
    }, 150);

    updateLinkModalContent();
    if(navigator.vibrate) navigator.vibrate(10);
}

function updateGhostVisuals() {
    const chk = document.getElementById('m-proxyDebrid').checked;
    const box = document.getElementById('ghost-zone-box');
    const txt = document.getElementById('ghost-status-text');
    
    if(chk) {
        box.classList.add('active');
        if(txt) txt.innerText = "STEALTH";
    } else {
        box.classList.remove('active');
        if(txt) txt.innerText = "VISIBLE";
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
    updateLinkModalContent();
}

function toggleFilter(id) { 
    document.getElementById(id).classList.toggle('excluded'); 
    const isExcluded = document.getElementById(id).classList.contains('excluded');
    if(isExcluded) {
        if(navigator.vibrate) navigator.vibrate(20);
        triggerPreviewUpdateEffect();
    }
    updateLinkModalContent();
}

async function pasteTo(id) {
    const input = document.getElementById(id);
    if (input.disabled) return;
    try {
        const text = await navigator.clipboard.readText();
        input.value = text;
        updateLinkModalContent();
        const btn = document.querySelector(`#${id}`).parentElement.querySelector('.m-paste-action');
        if(btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = originalHTML, 1500);
        }
        showToast("INCOLLATO CON SUCCESSO", "success");
    } catch (err) { alert("Impossibile accedere agli appunti. Incolla manualmente."); }
}

function loadMobileConfig() {
    try {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length >= 2 && pathParts[1].length > 10) {
            const config = JSON.parse(atob(pathParts[1]));
            if(config.service) {
                const srvMap = {'rd':0, 'tb':1}; 
                const railBtns = document.querySelectorAll('#page-setup .m-srv-btn');
                if(railBtns.length > 0 && srvMap[config.service] !== undefined) {
                     setMService(config.service, railBtns[srvMap[config.service]], true);
                }
            } else if (config.filters && config.filters.enableP2P) {
                 // Select P2P if active and no service
                 const railBtns = document.querySelectorAll('#page-setup .m-srv-btn');
                 setMService('p2p', railBtns[2], true);
            }

            if(config.key) document.getElementById('m-apiKey').value = config.key;

            if(config.tmdb) document.getElementById('m-tmdb').value = config.tmdb;
            if(config.aiostreams_mode) document.getElementById('m-aioMode').checked = true;
            
            if(config.sort) setSortMode(config.sort);
            else setSortMode('balanced');
            
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
                
                document.getElementById('m-enableAnimeWorld').checked = config.filters.enableAnimeWorld || false;
                toggleModuleStyle('m-enableAnimeWorld', 'mod-aw');

                document.getElementById('m-enableWebStreamr').checked = config.filters.enableWebStreamr !== false;
                toggleModuleStyle('m-enableWebStreamr', 'mod-webstr');

                if(config.filters.language) {
                    setLangMode(config.filters.language);
                } else {
                    setLangMode(config.filters.allowEng ? 'ita-eng' : 'ita');
                }

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
            updateStatus('m-enableAnimeWorld', 'st-aw');
            updateStatus('m-aioMode', 'st-aio');
            updateStatus('m-enableTrailers', 'st-trailer');
            updateGhostVisuals();
            toggleScOptions();
            checkWebPriorityVisibility(); 
            toggleMobileAIOLock();
            updateMobilePreview(); 
            updateLinkModalContent();
        }
    } catch(e) { console.log("No config loaded"); }
}

function getMobileConfig() {
    const gateActive = document.getElementById('m-gateActive').checked;
    const gateVal = parseInt(document.getElementById('m-gateVal').value);
    const sizeActive = document.getElementById('m-sizeActive').checked;
    const sizeVal = parseInt(document.getElementById('m-sizeVal').value);
    const finalMaxSizeGB = sizeActive ? sizeVal : 0;
    
    const isP2P = mCurrentService === 'p2p';

    return {
        service: isP2P ? '' : mCurrentService,
        key: document.getElementById('m-apiKey').value.trim(),
        tmdb: document.getElementById('m-tmdb').value.trim(),
        sort: mSortMode, 
        formatter: mSkin, 
        customTemplate: document.getElementById('m-customTemplate').value,
        aiostreams_mode: document.getElementById('m-aioMode').checked,
        mediaflow: {
            url: document.getElementById('m-mfUrl').value.trim().replace(/\/$/, ""),
            pass: document.getElementById('m-mfPass').value.trim(),
            proxyDebrid: document.getElementById('m-proxyDebrid').checked
        },
        filters: {
            language: mLangMode,
            allowEng: (mLangMode === 'ita-eng' || mLangMode === 'eng'), 
            enableP2P: isP2P,
            no4k: document.getElementById('mq-4k').classList.contains('excluded'),
            no1080: document.getElementById('mq-1080').classList.contains('excluded'),
            no720: document.getElementById('mq-720').classList.contains('excluded'),
            noScr: document.getElementById('mq-sd').classList.contains('excluded'),
            noCam: document.getElementById('mq-sd').classList.contains('excluded'),
            enableVix: document.getElementById('m-enableVix').checked,
            enableGhd: document.getElementById('m-enableGhd').checked,
            enableGs: document.getElementById('m-enableGs').checked,
            enableAnimeWorld: document.getElementById('m-enableAnimeWorld').checked,
            enableWebStreamr: document.getElementById('m-enableWebStreamr').checked,
            enableTrailers: document.getElementById('m-enableTrailers').checked,
            vixLast: document.getElementById('m-vixLast').checked,
            scQuality: mScQuality,
            maxPerQuality: gateActive ? gateVal : 0,
            maxSizeGB: finalMaxSizeGB > 0 ? finalMaxSizeGB : null
        }
    };
}

function updateLinkModalContent() {
    const box = document.getElementById('m-generatedUrlBox');
    if(!box) return;
    
    const config = getMobileConfig();
    const isWebEnabled = config.filters.enableVix || config.filters.enableGhd || config.filters.enableGs || config.filters.enableAnimeWorld || config.filters.enableP2P;
    
    if(!config.key && !isWebEnabled) {
        box.value = "/// SYSTEM OFFLINE: WAITING FOR CONFIGURATION DATA ///\\n[!] Inserisci API Key o Attiva Sorgenti Web/P2P";
        box.style.color = "var(--m-error)";
        return;
    }
    
    const manifestUrl = `${window.location.protocol}//${window.location.host}/${btoa(JSON.stringify(config))}/manifest.json`;
    box.value = manifestUrl;
    box.style.color = "var(--m-primary)";
}

function mobileInstall() {
    const config = getMobileConfig();
    const isWebEnabled = config.filters.enableVix || config.filters.enableGhd || config.filters.enableGs || config.filters.enableAnimeWorld || config.filters.enableP2P;
    if(!config.key && !isWebEnabled) {
        showToast("ERRORE: API KEY MANCANTE", "error"); return;
    }
    const manifestUrl = `${window.location.host}/${btoa(JSON.stringify(config))}/manifest.json`;
    window.location.href = `stremio://${manifestUrl}`;
}

function openLinkModal() {
    updateLinkModalContent();
    document.getElementById('m-link-modal').classList.add('show');
    if(navigator.vibrate) navigator.vibrate(10);
}

function closeLinkModal() {
    document.getElementById('m-link-modal').classList.remove('show');
}

async function copyFromModal() {
    const box = document.getElementById('m-generatedUrlBox');
    const textToCopy = box.value;
    
    if (textToCopy.includes("WAITING FOR")) {
        showToast("CONFIGURA PRIMA L'ADDON", "error");
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
            closeLinkModal();
            showToast("LINK COPIATO NEGLI APPUNTI", "success");
        } else {
            const dummy = document.createElement("textarea");
            document.body.appendChild(dummy);
            dummy.value = textToCopy;
            dummy.select();
            document.execCommand("copy");
            document.body.removeChild(dummy);
            closeLinkModal();
            showToast("LINK COPIATO NEGLI APPUNTI", "success");
        }
    } catch (err) {
        showToast("ERRORE COPIA MANUALE", "error");
    }
}

initMobileInterface();
