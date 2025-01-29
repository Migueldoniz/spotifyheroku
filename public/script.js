const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('access_token');

if (accessToken) {
    localStorage.setItem('spotify_access_token', accessToken);
    window.history.replaceState({}, document.title, window.location.pathname);
}

function checkAuth() {
    const token = localStorage.getItem('spotify_access_token');

    if (token) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainScreen').style.display = 'block';
        loadLikedTracks(token);
    } else {
        document.getElementById('loginScreen').style.display = 'block';
    }
}

async function loadLikedTracks(token) {
    try {
        const response = await fetch('/api/liked-tracks', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const tracks = await response.json();
            const trackList = document.getElementById('trackList');
            trackList.innerHTML = tracks.map(track => `<li>${track.name} - ${track.artist}</li>`).join('');
        } else {
            console.error('Erro ao carregar músicas curtidas');
        }
    } catch (error) {
        console.error('Erro ao carregar músicas curtidas:', error);
    }
}

document.getElementById('createPlaylistButton').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.textContent = 'Criando playlist...';

    try {
        const token = localStorage.getItem('spotify_access_token');
        const playlistName = document.getElementById('playlistName').value;

        const likedTracks = await fetch('/api/liked-tracks', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (likedTracks.ok) {
            const tracks = await likedTracks.json();
            const trackUris = tracks.map(track => track.uri);

            const response = await fetch('/api/create-playlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ name: playlistName, trackUris }),
            });

            if (response.ok) {
                const result = await response.json();
                status.innerHTML = `Playlist criada com sucesso! <a href="${result.playlistUrl}" target="_blank">Abrir no Spotify</a>`;
            } else {
                status.textContent = 'Erro ao criar a playlist.';
            }
        } else {
            status.textContent = 'Erro ao obter músicas curtidas.';
        }
    } catch (error) {
        status.textContent = 'Erro na requisição.';
        console.error(error);
    }
});

document.getElementById('loginButton').addEventListener('click', () => {
    window.location.href = '/api/login';
});

checkAuth();
