const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

const app = express();

// Configuração do Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
});

// Rota para redirecionar ao Spotify para login
app.get('/login', (req, res) => {
  const scopes = ['user-library-read', 'playlist-modify-public'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

// Rota de callback após autorização
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;

    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    res.send('Autenticação bem-sucedida! Você pode fechar esta aba.');
  } catch (error) {
    res.status(500).send(`Erro durante a autenticação: ${error.message}`);
  }
});

// Rota para criar a playlist
app.get('/create-playlist', async (req, res) => {
  try {
    const likedTracks = await spotifyApi.getMySavedTracks({ limit: 50 });
    const trackUris = likedTracks.body.items.map((item) => item.track.uri);

    const me = await spotifyApi.getMe();
    const userId = me.body.id;

    const playlist = await spotifyApi.createPlaylist(userId, {
      name: 'Minhas Curtidas como Playlist',
      description: 'Playlist criada a partir das músicas curtidas.',
      public: false,
    });

    await spotifyApi.addTracksToPlaylist(playlist.body.id, trackUris);

    res.send('Playlist criada com sucesso!');
  } catch (error) {
    res.status(500).send(`Erro ao criar a playlist: ${error.message}`);
  }
});

module.exports = app;