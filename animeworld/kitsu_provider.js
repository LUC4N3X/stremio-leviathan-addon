const axios = require('axios');

const TIMEOUT = 10000;

class KitsuProvider {
  async getAnimeInfo(kitsuId) {
    try {
      const response = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
        timeout: TIMEOUT
      });
      
      const data = response.data.data;
      // Prende il titolo inglese se esiste, altrimenti il canonical
      const title = (data.attributes.titles && data.attributes.titles.en) 
                    ? data.attributes.titles.en 
                    : data.attributes.canonicalTitle;
      const date = data.attributes.startDate;
      
      return { title, date };
    } catch (error) {
      console.error(`Error fetching Kitsu info for ID ${kitsuId}:`, error.message);
      return null;
    }
  }

  parseKitsuId(kitsuIdString) {
    const parts = kitsuIdString.split(':');
    
    // Controllo base formato
    if (parts.length < 2 || parts[0] !== 'kitsu') {
      return null; 
    }

    const kitsuId = parts[1];

    if (parts.length === 2) {
      // kitsu:ID (Film o Serie generica)
      return { kitsuId, seasonNumber: null, episodeNumber: null, isMovie: true };
    } else if (parts.length === 3) {
      // kitsu:ID:EPISODIO
      return { kitsuId, seasonNumber: null, episodeNumber: parseInt(parts[2]), isMovie: false };
    } else if (parts.length === 4) {
      // kitsu:ID:STAGIONE:EPISODIO
      return { kitsuId, seasonNumber: parseInt(parts[2]), episodeNumber: parseInt(parts[3]), isMovie: false };
    }
    
    return null;
  }

  normalizeTitle(title) {
    const replacements = {
      'Attack on Titan': "L'attacco dei Giganti",
      'Season': '',
      'Shippuuden': 'Shippuden',
      '-': '',
      'Ore dake Level Up na Ken': 'Solo Leveling'
    };
    
    let normalized = title;
    for (const [key, value] of Object.entries(replacements)) {
      // Replace globale case-insensitive se necessario, qui uso replace standard come da esempio
      normalized = normalized.split(key).join(value);
    }
    
    if (normalized.includes('Naruto:')) {
      normalized = normalized.replace(':', '');
    }
    
    // Pulizia extra spazi
    return normalized.replace(/\s+/g, ' ').trim();
  }
}

module.exports = new KitsuProvider();
