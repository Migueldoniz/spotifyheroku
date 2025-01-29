const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(express.json()); // Middleware para permitir JSON no corpo das requisições

// Verifique se as variáveis de ambiente estão definidas
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.REDIRECT_URI) {
  console.error('Erro: Variáveis de ambiente não definidas.');
  process.exit(1);
}

// Configuração do Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
});

// Rota para redirecionar ao Spotify para login
app.get('/api/login', (req, res) => {
  const scopes = [
    'user-library-read',
    'playlist-modify-public',
    'playlist-modify-private',
  ];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

// Rota de callback após autorização
app.get('/api/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;

    // Salvar o refresh token (aqui seria ideal salvar no banco de dados)
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    res.redirect(`/?access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Erro durante a autenticação:', error);
    res.status(500).send(`Erro durante a autenticação: ${error.message}`);
  }
});

// Rota para obter todas as músicas curtidas
app.get('/api/liked-tracks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).send('Token de acesso não fornecido.');
  }

  try {
    spotifyApi.setAccessToken(token);

    let allTracks = [];
    let limit = 50;
    let offset = 0;
    let total = null;

    do {
      const likedTracks = await spotifyApi.getMySavedTracks({ limit, offset });

      allTracks.push(...likedTracks.body.items.map(item => ({
        name: item.track.name,
        artist: item.track.artists.map(artist => artist.name).join(', '),
        uri: item.track.uri
      })));

      total = likedTracks.body.total;
      offset += limit;
    } while (offset < total);

    res.json(allTracks);
  } catch (error) {
    console.error('Erro ao obter músicas curtidas:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter músicas curtidas', error });
  }
});

// Rota para criar playlist
app.post('/api/create-playlist', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de acesso não fornecido.' });
  }

  const { name, trackUris } = req.body;

  if (!trackUris || trackUris.length === 0) {
    return res.status(400).json({ success: false, message: 'Nenhuma música foi selecionada.' });
  }

  try {
    spotifyApi.setAccessToken(token);

    const me = await spotifyApi.getMe();
    const userId = me.body.id;

    // Criar a playlist
    const playlist = await spotifyApi.createPlaylist(name || 'Minhas Curtidas como Playlist', {
      description: 'Playlist criada a partir das músicas curtidas.',
      public: false,
    });

    const playlistId = playlist.body.id;

    // Adicionar músicas em lotes de 100
    const batchSize = 100;
    for (let i = 0; i < trackUris.length; i += batchSize) {
      const batch = trackUris.slice(i, i + batchSize);
      await spotifyApi.addTracksToPlaylist(playlistId, batch);
    }

    res.json({ success: true, playlistUrl: playlist.body.external_urls.spotify });
  } catch (error) {
    console.error('Erro ao criar a playlist:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar a playlist', error });
  }
});

// Iniciar o servidor
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

module.exports = app;
