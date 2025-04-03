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
            // Caso receba um novo token, podemos atualizar; caso contrário, redireciona para login.
            if (data.newAccessToken) {
              localStorage.setItem('spotify_access_token', data.newAccessToken);
              loadLikedTracks(data.newAccessToken, refreshToken);
            } else {
              alert('Sessão expirada. Faça login novamente.');
              window.location.href = data.redirect || '/api/login';
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
        genreDropdown.innerHTML = '<option value="">Selecione um gênero</option>'; // Resetar opções
    
        const uniqueGenres = new Set();
        tracks.forEach(track => {
            if (track.genre && track.genre.length > 0) {
                track.genre.forEach(g => uniqueGenres.add(g));
            }
        });
    
        if (uniqueGenres.size === 0) {
            console.warn("Nenhum gênero encontrado.");
            return;
        }
    
        uniqueGenres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreDropdown.appendChild(option);
        });
    }
    
    
    // Evento do dropdown para filtrar músicas
    document.addEventListener("DOMContentLoaded", () => {
        const filterButton = document.getElementById('filterButton');
        if (!filterButton) {
            console.error("Elemento 'filterButton' não encontrado.");
            return;
        }
        filterButton.addEventListener('click', () => {
            const genreDropdown = document.getElementById('genreDropdown');
            if (!genreDropdown) {
                console.error("Elemento 'genreDropdown' não encontrado.");
                return;
            }
            const genre = genreDropdown.value;
            if (genre) {
                loadLikedTracksByGenre(genre).then(() => {
                    console.log(`Músicas filtradas pelo gênero: ${genre}`);
                }).catch(error => {
                    console.error('Erro ao filtrar músicas pelo gênero:', error);
                });
            } else {
                alert('Por favor, selecione um gênero.');
            }
        });
    });

    function updateTrackList(tracks) {
        const trackList = document.getElementById('trackList');
        trackList.innerHTML = tracks.map(track => `
            <li class="lista" data-uri="${track.uri}"><img src="image.png" alt="Spotify-logo"/> ${track.name} - ${track.artist}</li>
        `).join('');
    
        // Adiciona o evento de clique para seleção
        document.querySelectorAll('#trackList li').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('selected');
            });
        });
    }
    

    // Função para carregar músicas filtradas por gênero
    async function loadLikedTracksByGenre(genre) {
        try {
            const token = localStorage.getItem('spotify_access_token');
            const refreshToken = localStorage.getItem('spotify_refresh_token');
    
            const response = await fetch(`/api/liked-tracks`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Refresh-Token': refreshToken,
                },
            });
    
            if (response.ok) {
                const tracks = await response.json();
                const filteredTracks = tracks.filter(track => track.genre.includes(genre));
    
                updateTrackList(filteredTracks);
            } else {
                console.error('Erro ao carregar músicas curtidas');
            }
        } catch (error) {
            console.error('Erro ao carregar músicas curtidas:', error);
        }
    }
    
document.getElementById('createPlaylistButton').addEventListener('click', async () => {
    const playlistInput = document.getElementById('playlistName');
    const status = document.getElementById('status');
    status.textContent = 'Criando playlist...';
  
    if (!playlistInput) {
      alert("Erro: Campo de nome da playlist não encontrado.");
      return;
    }
  
    const playlistName = playlistInput.value;
    const selectedTracks = Array.from(document.querySelectorAll('#trackList li.selected'))
                                .map(li => li.dataset.uri);
  
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
      } else if (response.status === 401) {
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = data.redirect || '/api/login';
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
        const genre = document.getElementById('genreDropdown').value;
        if (genre) {
            const status = document.getElementById('status');
            status.textContent = 'Carregando músicas...'; // Exibe mensagem de carregamento

            loadLikedTracksByGenre(genre).then(() => {
                status.textContent = ''; // Limpa a mensagem após o carregamento
            }).catch(error => {
                status.textContent = 'Erro ao carregar músicas.';
                console.error('Erro ao filtrar músicas pelo gênero:', error);
            });
        } else {
            alert('Por favor, selecione um gênero.');
        }
    });
    

document.getElementById('selectAllButton').addEventListener('click', () => {
    const tracks = document.querySelectorAll('#trackList li');
    const allSelected = Array.from(tracks).every(track => track.classList.contains('selected'));

    tracks.forEach(track => {
        if (allSelected) {
            track.classList.remove('selected'); // Desmarca tudo se todas já estiverem selecionadas
        } else {
            track.classList.add('selected'); // Marca todas se alguma estiver desmarcada
        }
    });
});


document.getElementById('loginButton').addEventListener('click', () => {
window.location.href = '/api/login';
});

document.addEventListener("DOMContentLoaded", () => {
    const trackList = document.getElementById("trackList");

    trackList.addEventListener("click", (event) => {
        if (event.target.tagName === "li") {
            event.target.classList.toggle("selected");
        }
    });
});

checkAuth();