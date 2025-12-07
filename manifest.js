function getManifest() {
    return {
        id: "org.corsaro.brain.v31.3",
        version: "1.3.0",
        name: "Leviathan",
        description: "Deep Sea Streaming Core | AI Powered | ITA Priority",
        logo: "https://img.icons8.com/ios-filled/500/00f2ea/dragon.png",
        resources: ["catalog", "stream"],
        types: ["movie", "series"],
        catalogs: [],
        behaviorHints: { 
            configurable: true, 
            configurationRequired: false 
        },

        // 👇 AGGIUNTO
        stremioAddonsConfig: {
            issuer: "https://stremio-addons.net",
            signature: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..guRYCFSZxJ-zbESKkZicTg.R-jeN-fyn1-6JWfMqJREy66fhEopTajTGkAKoDmwimetqMzI8zRhFoHYOckwb6KncfR4XK1g_8h9u7gYq2LFdvF5Lwm2Hr3iLcpO5vygwbSpIX7DmtV9fzKh0Z-Fe5l0.5Uy2bL0SyUSZ0mPlOSeiaA"
        }
    };
}

module.exports = { getManifest };
