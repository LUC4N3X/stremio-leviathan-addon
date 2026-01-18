function getManifest() {
    return {
        id: "org.corsaro.brain.v2",
        version: "2.1.0",
        name: "Leviathan",
        description: "Motore di ricerca parallelo ad alte prestazioni, ottimizzato per i contenuti italiani. Include integrazione StreamingCommunity e supporto nativo Debrid per garantire streaming 4K/HDR fluido e senza buffering.",
        logo: "https://i.ibb.co/jvTQLbjb/Gemini-Generated-Image-51j2ce51j2ce51j2-1.png",
        resources: ["catalog", "stream"],
        types: ["movie", "series"],
        catalogs: [],
        behaviorHints: { 
            configurable: true, 
            configurationRequired: false 
        },
        
        stremioAddonsConfig: {
            issuer: "https://stremio-addons.net",
            signature: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..guRYCFSZxJ-zbESKkZicTg.R-jeN-fyn1-6JWfMqJREy66fhEopTajTGkAKoDmwimetqMzI8zRhFoHYOckwb6KncfR4XK1g_8h9u7gYq2LFdvF5Lwm2Hr3iLcpO5vygwbSpIX7DmtV9fzKh0Z-Fe5l0.5Uy2bL0SyUSZ0mPlOSeiaA"
        }
    };
}

module.exports = { getManifest };
