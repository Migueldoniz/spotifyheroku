    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');

    if (accessToken && refreshToken) {
    localStorage.setItem('spotify_access_token', accessToken);
    localStorage.setItem('spotify_refresh_token', refreshToken);
    window.history.replaceState({}, document.title, window.location.pathname);
    }

    function checkAuth() {
    const token = localStorage.getItem('spotify_access_token');
    const refreshToken = localStorage.getItem('spotify_refresh_token');

    if (token && refreshToken) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainScreen').style.display = 'block';
        loadLikedTracks(token, refreshToken);
    } else {
        document.getElementById('loginScreen').style.display = 'block';
    }
    }

async function loadLikedTracks(token, refreshToken) {
    try {
        const response = await fetch('/api/liked-tracks', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Refresh-Token': refreshToken,
        },
        });
    
        if (response.ok) {
        const tracks = await response.json();
        updateTrackList(tracks);
        loadGenresDropdown(tracks); // Preenche o dropdown de gêneros
        } else if (response.status === 401) {
        const data = await response.json();
        if (data.newAccessToken) {
            localStorage.setItem('spotify_access_token', data.newAccessToken);
            loadLikedTracks(data.newAccessToken, refreshToken);
        } else {
            alert('Sessão expirada. Faça login novamente.');
            window.location.href = '/api/login';
        }
        } else {
        console.error('Erro ao carregar músicas curtidas');
        }
    } catch (error) {
        console.error('Erro ao carregar músicas curtidas:', error);
    }
    }
    
    // Preenche o dropdown de gêneros musicais
    function loadGenresDropdown(tracks) {
    const genreDropdown = document.getElementById('genreDropdown');
    genreDropdown.innerHTML = '<option value="">Selecione um gênero</option>'; // Reset
    
    const uniqueGenres = new Set();
    tracks.forEach(track => {
        if (track.genre) {
        track.genre.forEach(g => uniqueGenres.add(g));
        }
    });
    
    uniqueGenres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreDropdown.appendChild(option);
    });
    }
    
    // Evento do dropdown para filtrar músicas
    document.getElementById('filterButton').addEventListener('click', () => {
    const genre = document.getElementById('genreDropdown').value;
    if (genre) {
        loadLikedTracksByGenre(genre);
    } else {
        alert('Por favor, selecione um gênero.');
    }
    });

    function updateTrackList(tracks) {
        const trackList = document.getElementById('trackList');
        trackList.innerHTML = tracks.map(track => `
          <ul>
            <input type="checkbox" class="track-checkbox" data-uri="${track.uri}">
            ${track.name} - ${track.artist}
          </ul>
        `).join('');
      }

    // Função para carregar músicas filtradas por gênero
async function loadLikedTracksByGenre(genre) {
try {
    const token = localStorage.getItem('spotify_access_token');
    const refreshToken = localStorage.getItem('spotify_refresh_token');

    const response = await fetch(`/api/liked-tracks-by-genre?genre=${encodeURIComponent(genre)}`, {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`,
        'X-Refresh-Token': refreshToken,
    },
    });

    if (response.ok) {
    const tracks = await response.json();
    updateTrackList(tracks);
    } else {
    console.error('Erro ao carregar músicas curtidas por gênero');
    }
} catch (error) {
    console.error('Erro ao carregar músicas curtidas por gênero:', error);
}
}
document.getElementById('createPlaylistButton').addEventListener('click', async () => {
    const playlistInput = document.getElementById('playlistName');
    const status = document.getElementById('status');
    status.textContent = 'Criando playlist...';
    if (!playlistInput) {
        console.error("Erro: Campo de nome da playlist não encontrado.");
        alert("Erro: Campo de nome da playlist não encontrado.");
        return;
    }

    const playlistName = playlistInput.value;
    const selectedTracks = Array.from(document.querySelectorAll('input.track-checkbox:checked'))
                                .map(checkbox => checkbox.dataset.uri);

    if (!playlistName) {
        alert("Por favor, insira um nome para a playlist.");
        return;
    }

    if (selectedTracks.length === 0) {
        alert("Nenhuma música selecionada para a playlist.");
        return;
    }

    try {
        const token = localStorage.getItem('spotify_access_token');
        const refreshToken = localStorage.getItem('spotify_refresh_token');

        const response = await fetch('/api/create-playlist', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Refresh-Token': refreshToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlistName, trackUris: selectedTracks })
        });

        const data = await response.json();

        if (response.ok) {
            status.innerHTML = `Playlist criada com sucesso! <a href="${data.playlistUrl}" target="_blank">Abrir no Spotify</a>`;
        } else {
        alert(`Erro ao criar playlist: ${data.message}`);
        console.error("Erro ao criar playlist:", data.error);
        }
    } catch (error) {
        console.error("Erro ao enviar requisição de criação de playlist:", error);
        alert("Erro ao criar playlist. Veja o console para mais detalhes.");
    }
});
  

    // Evento do botão de filtro
document.getElementById('filterButton').addEventListener('click', () => {
const genre = document.getElementById('genreInput').value;
if (genre) {
    loadLikedTracksByGenre(genre);
} else {
    alert('Por favor, insira um gênero.');
}
});

document.getElementById('selectAllButton').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.track-checkbox');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
  
    checkboxes.forEach(checkbox => {
      checkbox.checked = !allChecked; // Alterna entre marcar e desmarcar tudo
    });
  });

document.getElementById('loginButton').addEventListener('click', () => {
window.location.href = '/api/login';
});

checkAuth();