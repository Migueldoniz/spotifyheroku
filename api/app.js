const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(express.json());

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.REDIRECT_URI) {
  console.error('Erro: Variáveis de ambiente não definidas.');
  process.exit(1);
}

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
});

app.get('/api/login', (req, res) => {
  const scopes = [
    'user-library-read',
    'playlist-modify-public',
    'playlist-modify-private',
  ];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

app.get('/api/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    res.redirect(`/?access_token=${data.body.access_token}&refresh_token=${data.body.refresh_token}`);
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(500).send('Erro na autenticação.');
  }
});

function checkAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token ausente', redirect: '/api/login' });
  spotifyApi.setAccessToken(token);
  next();
}

app.get('/api/liked-tracks', checkAuth, async (req, res) => {
  try {
      let allTracks = [];
      let offset = 0;
      const limit = 50;
      let total = null;

      do {
          const likedTracks = await spotifyApi.getMySavedTracks({ limit, offset });

          // Coletar IDs dos artistas (removendo duplicados)
          const artistIds = [...new Set(likedTracks.body.items.flatMap(item => item.track.artists.map(artist => artist.id)))];

          let artistGenres = {};

          // Buscar detalhes dos artistas em lotes de até 50 IDs
          for (let i = 0; i < artistIds.length; i += 50) {
              const batch = artistIds.slice(i, i + 50);
              const artistDetails = await spotifyApi.getArtists(batch);
              artistDetails.body.artists.forEach(artist => {
                  artistGenres[artist.id] = artist.genres; // Mapear ID do artista para gêneros
              });
          }

          allTracks.push(...likedTracks.body.items.map(item => ({
              name: item.track.name,
              artist: item.track.artists.map(a => a.name).join(', '),
              uri: item.track.uri,
              genre: item.track.artists.flatMap(artist => artistGenres[artist.id] || []) // Pegar gêneros
          })));

          total = likedTracks.body.total;
          offset += limit;
      } while (offset < total);

      res.json(allTracks);
  } catch (error) {
      console.error('Erro ao obter músicas:', error);
      res.status(500).json({ error: 'Erro ao obter músicas curtidas do Spotify.' });
  }
});



app.post('/api/create-playlist', checkAuth, async (req, res) => {
  const { playlistName, trackUris } = req.body;
  if (!playlistName || !trackUris?.length) {
    return res.status(400).json({ message: 'Nome da playlist e músicas são obrigatórios.' });
  }

  try {
    const playlistData = await spotifyApi.createPlaylist(playlistName, { public: false });
    const playlistId = playlistData.body.id;
    
    for (let i = 0; i < trackUris.length; i += 100) {
      await spotifyApi.addTracksToPlaylist(playlistId, trackUris.slice(i, i + 100));
    }

    res.json({ message: 'Playlist criada!', playlistUrl: playlistData.body.external_urls.spotify });
  } catch (error) {
    console.error('Erro ao criar playlist:', error);
    if (error.statusCode === 401) {
      return res.status(401).json({ message: 'Token expirado', redirect: '/api/login' });
    }
    res.status(500).send('Erro ao criar playlist.');
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));

module.exports = app;
