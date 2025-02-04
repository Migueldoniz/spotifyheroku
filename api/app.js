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

async function refreshAccessToken(refreshToken) {
  try {
    spotifyApi.setRefreshToken(refreshToken);
    const data = await spotifyApi.refreshAccessToken();
    const { access_token } = data.body;
    spotifyApi.setAccessToken(access_token);
    return access_token;
  } catch (error) {
    console.error('Erro ao renovar o token de acesso:', error);
    throw error;
  }
}

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
    const { access_token, refresh_token } = data.body;
    res.redirect(`/?access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Erro durante a autenticação:', error);
    res.status(500).send('Erro durante a autenticação.');
  }
});

app.get('/api/liked-tracks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'];

  if (!token) {
    return res.status(401).send('Token de acesso não fornecido.');
  }

  try {
    spotifyApi.setAccessToken(token);

    let allTracks = [];
    let offset = 0;
    const limit = 50;
    let total = null;

    do {
      const likedTracks = await spotifyApi.getMySavedTracks({ limit, offset });
      
      // Pega os IDs dos artistas para obter gêneros
      const artistIds = likedTracks.body.items
        .map(item => item.track.artists[0]?.id)
        .filter(id => id);

      const artistsInfo = await spotifyApi.getArtists(artistIds);
      const artistGenres = artistsInfo.body.artists.reduce((acc, artist) => {
        acc[artist.id] = artist.genres;
        return acc;
      }, {});

      const tracks = likedTracks.body.items.map(item => ({
        name: item.track.name,
        artist: item.track.artists.map(artist => artist.name).join(', '),
        uri: item.track.uri,
        genre: artistGenres[item.track.artists[0]?.id] || []
      }));

      allTracks.push(...tracks);
      total = likedTracks.body.total;
      offset += limit;
    } while (offset < total);

    res.json(allTracks);
  } catch (error) {
    console.error('Erro ao obter músicas curtidas:', error);
    res.status(500).json({ message: 'Erro ao obter músicas curtidas', error });
  }
});

app.get('/api/liked-tracks-by-genre', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'];
  const genre = req.query.genre; // Gênero a ser filtrado

  if (!token) {
    return res.status(401).send('Token de acesso não fornecido.');
  }

  if (!genre) {
    return res.status(400).send('Gênero não especificado.');
  }

  try {
    spotifyApi.setAccessToken(token);

    let allTracks = [];
    let offset = 0;
    const limit = 50;
    let total = null;

    do {
      const likedTracks = await spotifyApi.getMySavedTracks({ limit, offset });

      // Obter os IDs dos artistas de cada música
      const artistIds = likedTracks.body.items
        .map(item => item.track.artists[0].id) // Pega o primeiro artista de cada música
        .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicatas

      // Obter os gêneros dos artistas
      const artistsInfo = await spotifyApi.getArtists(artistIds);
      const artistGenres = artistsInfo.body.artists.reduce((acc, artist) => {
        acc[artist.id] = artist.genres;
        return acc;
      }, {});

      // Filtrar as músicas pelo gênero do artista
      const tracks = likedTracks.body.items
        .filter(item => {
          const artistId = item.track.artists[0].id;
          return artistGenres[artistId]?.some(g => g.toLowerCase().includes(genre.toLowerCase()));
        })
        .map(item => ({
          name: item.track.name,
          artist: item.track.artists.map(artist => artist.name).join(', '),
          uri: item.track.uri,
        }));

      allTracks.push(...tracks);
      total = likedTracks.body.total;
      offset += limit;
    } while (offset < total);

    res.json(allTracks);
  } catch (error) {
    if (error.statusCode === 401) {
      try {
        const newAccessToken = await refreshAccessToken(refreshToken);
        spotifyApi.setAccessToken(newAccessToken);
        return res.redirect('/api/liked-tracks-by-genre');
      } catch (refreshError) {
        return res.status(500).json({ message: 'Erro ao renovar o token', error: refreshError });
      }
    }
    console.error('Erro ao obter músicas curtidas por gênero:', error);
    res.status(500).json({ message: 'Erro ao obter músicas curtidas por gênero', error });
  }
});
app.post('/api/create-playlist', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'];
  const { playlistName, trackUris } = req.body;

  if (!token) {
      return res.status(401).json({ message: 'Token de acesso não fornecido.' });
  }

  if (!playlistName || !trackUris || trackUris.length === 0) {
      return res.status(400).json({ message: 'Nome da playlist e músicas são obrigatórios.' });
  }

  try {
      spotifyApi.setAccessToken(token);

      // Criar a playlist
      const playlistData = await spotifyApi.createPlaylist(playlistName, { public: false });
      const playlistId = playlistData.body.id;

      // Adicionar músicas em lotes de 100
      const batchSize = 100;
      for (let i = 0; i < trackUris.length; i += batchSize) {
          const batch = trackUris.slice(i, i + batchSize);
          await spotifyApi.addTracksToPlaylist(playlistId, batch);
      }

      res.json({ message: 'Playlist criada com sucesso!', playlistUrl: playlistData.body.external_urls.spotify });
  } catch (error) {
      console.error('Erro ao criar playlist:', error);
      res.status(500).json({ message: 'Erro ao criar playlist', error });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

module.exports = app;