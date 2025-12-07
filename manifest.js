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
        }
    };
}

module.exports = { getManifest };
