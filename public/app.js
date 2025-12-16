const API = '/api/movies';
const $ = s => document.querySelector(s);

const todo = $('#todo');
const done = $('#done');
const favs = $('#favs');

const authModal       = $('#authModal');
const authBtn         = $('#authBtn');
const authTitle       = $('#authTitle');
const authTabLogin    = $('#authTabLogin');
const authTabRegister = $('#authTabRegister');
const authEmail       = $('#authEmail');
const authNicknameRow = $('#authNicknameRow');
const authNickname    = $('#authNickname');
const authPassword    = $('#authPassword');
const authCancelBtn   = $('#authCancel');
const authSubmitBtn   = $('#authSubmit');

let authMode = 'login';

let editing = null;
let markTarget = null;
let currentUser = null;

const placeholder = 'https://placehold.co/200x300?text=%F0%9F%8E%AC';

const I18N = {
  uk: {
    subtitle: 'персональна база фільмів',
    searchPlaceholder: 'Пошук у назві/жанрі/році...',
    summary: (plans, seen) => `🎞 У планах: ${plans} | ✅ Переглянуто: ${seen}`,
    todoTitle: '🎬 Хочу переглянути',
    todoSub: 'Фільми, які плануєш подивитись',
    doneTitle: '✅ Переглянуто',
    doneSub: 'Фільми, які ти вже подивився',
    favSummary: '🌟 Улюблені фільми',
    tmdbTitle: '🔎 Знайдено у TMDB',
    btnAdd: '+ Додати',
    btnMarkWatched: '✔ Переглянуто',
    btnBackToPlan: '↩︎ В план',
    btnPlanFromTmdb: '+ У план',
    btnFavFromTmdb: '★ До улюблених',
    emptyList: 'Нічого не знайдено',
    noGenre: 'Без жанру',
    commentPrefix: 'Коментар: ',
    toastSaved: 'Збережено',
    toastMarkedWatched: 'Позначено як переглянуто',
    toastBackToPlan: 'Повернено у план',
    toastAddedPlan: 'Додано в план',
    toastAddedFav: 'Додано до улюблених',
    authLoginTitle: 'Авторизація',
    authBtnLogin: 'Увійти',
    authBtnLogout: 'Вийти',
    authEmailLabel: 'Email',
    authPasswordLabel: 'Пароль',
    authToastLoggedOut: 'Вихід виконано',
    authToastRegistered: 'Реєстрація успішна 🎉',
    authToastLoggedIn: 'Вхід успішний ✅',
    authToastFill: 'Заповніть email і пароль',
    authToastPasswordShort: 'Пароль має бути мінімум 6 символів',
    authErrorRegister: 'Помилка реєстрації',
    authErrorLogin: 'Невірний email або пароль',
    authErrorNetwork: 'Помилка мережі',
    modalAddTitle: 'Додати фільм',
    modalEditTitle: 'Редагувати фільм',
    modalSave: 'Зберегти',
    modalCancel: 'Скасувати',
    mwTitle: 'Позначити як переглянуто',
    mwLabelRating: 'Оцінка (0–5)',
    mwLabelComment: 'Коментар (опційно)',
    mwOk: 'Готово',
    mwCancel: 'Скасувати'
  },
  pl: {
    subtitle: 'osobista baza filmów',
    searchPlaceholder: 'Szukaj po tytule/gatunku/roku...',
    summary: (plans, seen) => `🎞 W planach: ${plans} | ✅ Obejrzane: ${seen}`,
    todoTitle: '🎬 Chcę obejrzeć',
    todoSub: 'Filmy, które planujesz obejrzeć',
    doneTitle: '✅ Obejrzane',
    doneSub: 'Filmy, które już obejrzałeś',
    favSummary: '🌟 Ulubione filmy',
    tmdbTitle: '🔎 Znalezione w TMDB',
    btnAdd: '+ Dodaj',
    btnMarkWatched: '✔ Obejrzane',
    btnBackToPlan: '↩︎ Do planu',
    btnPlanFromTmdb: '+ Do planu',
    btnFavFromTmdb: '★ Do ulubionych',
    emptyList: 'Nic nie znaleziono',
    noGenre: 'Bez gatunku',
    commentPrefix: 'Komentarz: ',
    toastSaved: 'Zapisano',
    toastMarkedWatched: 'Oznaczono jako obejrzane',
    toastBackToPlan: 'Przeniesiono do planu',
    toastAddedPlan: 'Dodano do planu',
    toastAddedFav: 'Dodano do ulubionych',
    authLoginTitle: 'Logowanie',
    authBtnLogin: 'Zaloguj się',
    authBtnLogout: 'Wyloguj',
    authEmailLabel: 'Email',
    authPasswordLabel: 'Hasło',
    authToastLoggedOut: 'Wylogowano',
    authToastRegistered: 'Rejestracja udana 🎉',
    authToastLoggedIn: 'Logowanie udane ✅',
    authToastFill: 'Wpisz email i hasło',
    authToastPasswordShort: 'Hasło musi mieć min. 6 znaków',
    authErrorRegister: 'Błąd rejestracji',
    authErrorLogin: 'Nieprawidłowy email lub hasło',
    authErrorNetwork: 'Błąd sieci',
    modalAddTitle: 'Dodaj film',
    modalEditTitle: 'Edytuj film',
    modalSave: 'Zapisz',
    modalCancel: 'Anuluj',
    mwTitle: 'Oznacz jako obejrzane',
    mwLabelRating: 'Ocena (0–5)',
    mwLabelComment: 'Komentarz (opcjonalnie)',
    mwOk: 'Gotowe',
    mwCancel: 'Anuluj'
  }
};

let currentLang = localStorage.getItem('lang') === 'pl' ? 'pl' : 'uk';
function dict(){ return I18N[currentLang]; }

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1400);
}

function extractApiError(data, fallback){
  if (!data) return fallback;
  if (Array.isArray(data.fieldErrors) && data.fieldErrors.length){
    return data.fieldErrors[0].message || fallback;
  }
  if (data.message) return data.message;
  if (data.error) return data.error;
  return fallback;
}

function starString(n){
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

async function fetchJSON(url, { method = 'GET', body } = {}){
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  const uid = currentUser?.id || localStorage.getItem('userId');
  if (uid) headers['X-User-Id'] = uid;

  const r = await fetch(url, { method, headers, body });

  let data = null;
  if (r.status !== 204){
    data = await r.json().catch(() => null);
  }

  if (!r.ok){
    const fallback = currentLang === 'pl' ? 'Błąd serwera' : 'Помилка сервера';
    const msg = extractApiError(data, fallback);
    toast(msg);
    throw new Error(msg);
  }

  return data;
}


function openModal(m = null){
  editing = m;
  const d = dict();
  $('#mTitle').textContent = m ? d.modalEditTitle : d.modalAddTitle;
  $('#fTitle').value   = m?.title       ?? '';
  $('#fYear').value    = m?.year        ?? '';
  $('#fGenre').value   = m?.genre       ?? '';
  $('#fRating').value  = m?.rating      ?? 0;
  $('#fPoster').value  = m?.poster_url  ?? '';
  $('#fComment').value = m?.comment     ?? '';
  $('#fWatched').checked = !!m?.watched;
  $('#modal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(){
  $('#modal').classList.remove('show');
  document.body.style.overflow = '';
}

function openMini(movie){
  markTarget = movie;
  $('#mwRating').value = movie?.rating ?? 5;
  $('#mwComment').value = movie?.comment ?? '';
  $('#mini').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeMini(){
  $('#mini').classList.remove('show');
  document.body.style.overflow = '';
  markTarget = null;
}

function openAuthModal(mode = 'login'){
  authMode = mode;
  const d = dict();

  if (authTitle){
    if (mode === 'login'){
      authTitle.textContent = d.authLoginTitle;
    } else {
      authTitle.textContent = currentLang === 'pl' ? 'Rejestracja' : 'Реєстрація';
    }
  }

  if (authTabLogin && authTabRegister){
    authTabLogin.classList.toggle('primary', mode === 'login');
    authTabRegister.classList.toggle('primary', mode === 'register');
  }

  if (authNicknameRow){
    authNicknameRow.style.display = mode === 'register' ? '' : 'none';
  }

  if (authEmail)    authEmail.value = currentUser?.email || '';
  if (authPassword) authPassword.value = '';
  if (authNickname) authNickname.value = '';

  if (authModal){
    authModal.classList.add('show');
  }
  document.body.style.overflow = 'hidden';
}

function closeAuthModal(){
  if (authModal){
    authModal.classList.remove('show');
  }
  document.body.style.overflow = '';
}


function updateAuthUI(){
  const authBtn = document.getElementById('authBtn');
  const userEmailSpan = document.getElementById('userEmail');
  const d = dict();
  if (!authBtn || !userEmailSpan) return;

  if (currentUser){
    authBtn.textContent = d.authBtnLogout;
    const label = currentUser.nickname || currentUser.email || '';
    userEmailSpan.textContent = label;
    userEmailSpan.style.display = label ? 'inline' : 'none';
  } else {
    authBtn.textContent = d.authBtnLogin;
    userEmailSpan.textContent = '';
    userEmailSpan.style.display = 'none';
  }
}

function loadUserFromStorage(){
  const id       = localStorage.getItem('userId');
  const email    = localStorage.getItem('userEmail');
  const nickname = localStorage.getItem('userNickname');
  if (id){
    currentUser = {
      id,
      email: email || '',
      nickname: nickname || ''
    };
  } else {
    currentUser = null;
  }
  updateAuthUI();
}

document.getElementById('addBtn').onclick = () => openModal();
document.getElementById('cancel').onclick = closeModal;

document.getElementById('q').oninput = () => render();

document.getElementById('mwCancel').onclick = closeMini;

document.getElementById('mwOk').onclick = async () => {
  const d = dict();
  const r = Number(document.getElementById('mwRating').value || 0);
  const c = document.getElementById('mwComment').value.trim();
  if (!markTarget) return closeMini();

  await fetchJSON(`${API}/${markTarget.id}`, {
    method:'PUT',
    body: JSON.stringify({
      watched:true,
      rating: Math.max(0, Math.min(5, Math.round(r))),
      comment:c
    })
  });

  closeMini();
  toast(d.toastMarkedWatched);
  render();
  loadFavs();
};

document.getElementById('save').onclick = async () => {
  const d = dict();

  const titleEl   = document.getElementById('fTitle');
  const yearEl    = document.getElementById('fYear');
  const genreEl   = document.getElementById('fGenre');
  const ratingEl  = document.getElementById('fRating');
  const commentEl = document.getElementById('fComment');
  const posterEl  = document.getElementById('fPoster');
  const watchedEl = document.getElementById('fWatched');

  const title   = titleEl.value.trim();
  const yearStr = yearEl.value.trim();
  const genre   = genreEl.value.trim();
  const rating  = Number(ratingEl.value || 0);
  const comment = commentEl.value.trim();
  const poster  = posterEl.value.trim();
  const watched = watchedEl.checked;

  if (!title || title.length < 3 || title.length > 200){
    toast(currentLang === 'pl'
      ? 'Tytuł musi mieć 3–200 znaków'
      : 'Назва має містити від 3 до 200 символів'
    );
    titleEl.focus();
    return;
  }

  let year = null;
  if (yearStr){
    const y = Number(yearStr);
    const current = new Date().getFullYear() + 1;
    if (!Number.isInteger(y) || y < 1888 || y > current){
      toast(currentLang === 'pl'
        ? `Rok musi być liczbą od 1888 do ${current}`
        : `Рік має бути числом від 1888 до ${current}`
      );
      yearEl.focus();
      return;
    }
    year = y;
  }

  if (!Number.isFinite(rating) || rating < 0 || rating > 5){
    toast(currentLang === 'pl'
      ? 'Ocena musi być w zakresie 0–5'
      : 'Оцінка має бути в діапазоні 0–5'
    );
    ratingEl.focus();
    return;
  }

  if (comment.length > 1000){
    toast(currentLang === 'pl'
      ? 'Komentarz nie może być dłuższy niż 1000 znaków'
      : 'Коментар не може бути довшим за 1000 символів'
    );
    commentEl.focus();
    return;
  }

  let poster_url = null;
  if (poster){
    try{
      new URL(poster);
      poster_url = poster;
    } catch{
      toast(currentLang === 'pl'
        ? 'Nieprawidłowy adres URL plakatu'
        : 'Некоректна адреса URL постера'
      );
      posterEl.focus();
      return;
    }
  }

  if (!watched && rating > 0){
    toast(currentLang === 'pl'
      ? 'Nie możesz wystawić oceny, jeśli film nie jest oznaczony jako obejrzany'
      : 'Неможливо ставити оцінку, якщо фільм не позначено як переглянутий'
    );
    return;
  }

  const body = {
    title,
    year,
    genre,
    rating,
    comment,
    watched,
    poster_url
  };

  try{
    if (editing){
      await fetchJSON(`${API}/${editing.id}`, {
        method:'PUT',
        body: JSON.stringify(body)
      });
    } else {
      await fetchJSON(API, {
        method:'POST',
        body: JSON.stringify(body)
      });
    }

    closeModal();
    toast(d.toastSaved);
    render();
    loadFavs();
  } catch (e){
    console.error(e);
  }
};
function heart(isFav){ return isFav ? '♥' : '♡'; }

function drawList(items, target){
  const d = dict();
  target.innerHTML = '';
  if (!items.length){
    target.innerHTML = `<div class="empty">${d.emptyList}</div>`;
    return;
  }

  items.forEach(m => {
    const el = document.createElement('article');
    el.className = 'movie' + (m.watched ? ' watched' : '');
    const poster = m.poster_url || placeholder;

    el.innerHTML = `
      <img class="poster" src="${poster}" alt="poster">
      <div>
        <div class="title">${m.title}</div>
        <div class="meta">🎥 ${[m.genre || d.noGenre, m.year || '—'].filter(Boolean).join(' • ')}</div>
        ${m.genre ? '<div class="chip">'+m.genre+'</div>' : ''}
        <div class="meta">${m.comment ? (d.commentPrefix + m.comment) : ''}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="stars" title="Оцінити">${starString(m.rating || 0)}</div>
        <button class="btn" data-toggle>${m.watched ? d.btnBackToPlan : d.btnMarkWatched}</button>
        <button class="btn" data-edt>✎</button>
        <button class="btn" data-del>🗑</button>
        <button class="heart ${m.favorite ? 'fav' : ''}" data-fav>${heart(m.favorite)}</button>
      </div>`;

    el.querySelector('[data-del]').onclick = async () => {
      if (confirm('Видалити?')){
        await fetchJSON(`${API}/${m.id}`, { method:'DELETE' });
        render();
        loadFavs();
      }
    };

  el.querySelector('[data-edt]').onclick = () => openModal(m);

  el.querySelector('[data-toggle]').onclick = async () => {
      if (!m.watched){
        openMini(m);
      } else {
        await fetchJSON(`${API}/${m.id}`, {
          method:'PUT',
          body: JSON.stringify({ watched: false, rating: 0 })
        });
        toast(d.toastBackToPlan);
        render();
        loadFavs();
      }
    };


    el.querySelector('.stars').onclick = async () => {
      if (!m.watched){
        toast(currentLang === 'pl'
          ? 'Najpierw oznacz film jako obejrzany'
          : 'Спочатку познач фільм переглянутим'
        );
        return;
      }

      const v = Number(prompt(
        currentLang === 'pl' ? 'Ocena 0–5' : 'Оцінка 0–5',
        m.rating || 0
      ));

      if (Number.isFinite(v) && v >= 0 && v <= 5){
        await fetchJSON(`${API}/${m.id}`, {
          method:'PUT',
          body: JSON.stringify({ rating: Math.round(v) })
        });
        render();
      }
    };


    el.querySelector('[data-fav]').onclick = async () => {
      await fetchJSON(`${API}/${m.id}/favorite`, {
        method:'PUT',
        body: JSON.stringify({ favorite: !m.favorite })
      });
      render();
      loadFavs();
    };

    target.appendChild(el);
  });
}

async function refreshSummary(){
  const d = dict();
  const all = await fetchJSON(API);
  const plans = all.filter(m => !m.watched).length;
  const seen  = all.filter(m =>  m.watched).length;
  document.getElementById('summary').textContent = d.summary(plans, seen);
}

const tmdbBox   = document.getElementById('tmdbResults');
const tmdbTitleEl = document.getElementById('tmdbTitle');

function drawTmdb(results){
  const d = dict();
  if (!results.length){
    tmdbBox.style.display = 'none';
    tmdbTitleEl.style.display = 'none';
    tmdbBox.innerHTML = '';
    return;
  }

  tmdbTitleEl.style.display = '';
  tmdbBox.style.display = '';
  tmdbBox.innerHTML = '';

  results.forEach(m => {
    const el = document.createElement('article');
    el.className = 'movie';
    const poster = m.poster_url || 'https://placehold.co/200x300?text=TMDB';

    el.innerHTML = `
      <img class="poster" src="${poster}" alt="">
      <div>
        <div class="title">${m.title}</div>
        <div class="meta">${m.year || '—'}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn" data-plan>${d.btnPlanFromTmdb}</button>
        <button class="btn primary" data-fav>${d.btnFavFromTmdb}</button>
      </div>`;

    el.querySelector('[data-plan]').onclick = async () => {
      await fetchJSON('/api/tmdb/add', {
        method:'POST',
        body: JSON.stringify({ tmdb_id: m.tmdb_id, watched:false, favorite:false })
      });
      toast(d.toastAddedPlan);
      render();
      loadFavs();
    };

    el.querySelector('[data-fav]').onclick = async () => {
      await fetchJSON('/api/tmdb/add', {
        method:'POST',
        body: JSON.stringify({ tmdb_id: m.tmdb_id, watched:false, favorite:true })
      });
      toast(d.toastAddedFav);
      render();
      loadFavs();
    };

    tmdbBox.appendChild(el);
  });
}

async function searchTmdb(q){
  if (!q || q.length < 2){
    tmdbBox.style.display = 'none';
    tmdbTitleEl.style.display = 'none';
    tmdbBox.innerHTML = '';
    return;
  }
  const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`).then(r => r.json());
  drawTmdb(res);
}

async function render(){
  const q = document.getElementById('q').value.trim();
  const allItems = await fetchJSON(API);

  drawList(allItems.filter(m => !m.watched), todo);
  drawList(allItems.filter(m =>  m.watched), done);

  refreshSummary();
  searchTmdb(q);
}

async function loadFavs(){
  const items = await fetchJSON(`${API}/favorites`);
  drawList(items, favs);
}


if (authCancelBtn){
  authCancelBtn.onclick = closeAuthModal;
}

if (authBtn){
  authBtn.onclick = () => {
    const d = dict();
    if (currentUser){
      currentUser = null;
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userNickname');
      updateAuthUI();
      toast(d.authToastLoggedOut);
      render();
      loadFavs();
    } else {
      openAuthModal('login');
    }
  };
}

if (authTabLogin){
  authTabLogin.onclick = () => openAuthModal('login');
}
if (authTabRegister){
  authTabRegister.onclick = () => openAuthModal('register');
}

if (authSubmitBtn){
  authSubmitBtn.onclick = async () => {
    const d = dict();
    const email = authEmail ? authEmail.value.trim() : '';
    const password = authPassword ? authPassword.value : '';
    const nickInput = authNickname;

    if (!email || !password){
      toast(d.authToastFill);
      if (!email && authEmail) authEmail.focus();
      else if (authPassword) authPassword.focus();
      return;
    }

    if (authEmail && !authEmail.checkValidity()){
      toast(currentLang === 'pl'
        ? 'Niepoprawny adres email'
        : 'Неправильний формат email'
      );
      authEmail.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)){
      toast(currentLang === 'pl'
        ? 'Niepoprawny adres email'
        : 'Неправильний формат email'
      );
      if (authEmail) authEmail.focus();
      return;
    }

    if (password.length < 6 || password.length > 200){
      toast(d.authToastPasswordShort);
      if (authPassword) authPassword.focus();
      return;
    }

    let nickname = '';
    if (authMode === 'register'){
      if (nickInput){
        nickname = nickInput.value.trim();
      }
      if (!nickname){
        nickname = (email.split('@')[0] || 'user').slice(0, 20);
      }

      const nickRegex = /^[A-Za-z0-9_-]{3,30}$/;
      if (!nickRegex.test(nickname)){
        toast(currentLang === 'pl'
          ? 'Nick musi mieć 3–30 znaków (litery, cyfry, -, _)'
          : 'Нік має містити 3–30 символів (латинські літери, цифри, -, _)'
        );
        if (nickInput) nickInput.focus();
        return;
      }
    }

    try{
      let user = null;

      if (authMode === 'login'){
        const res = await fetch('/api/login', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok){
          toast(data?.message || d.authErrorLogin);
          return;
        }
        user = {
          id: data.id,
          email: data.email || email,
          nickname: data.nickname || ''
        };
        toast(d.authToastLoggedIn);
      } else {
        const res = await fetch('/api/register', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ email, password, nickname })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok){
          toast(data?.message || d.authErrorRegister);
          return;
        }
        user = {
          id: data.id,
          email: data.email || email,
          nickname: data.nickname || nickname
        };
        toast(d.authToastRegistered);
      }

      currentUser = user;
      if (currentUser){
        localStorage.setItem('userId', currentUser.id);
        localStorage.setItem('userEmail', currentUser.email);
        localStorage.setItem('userNickname', currentUser.nickname || '');
      }
      updateAuthUI();
      closeAuthModal();
      render();
      loadFavs();
    } catch(err){
      console.error(err);
      toast(d.authErrorNetwork);
    }
  };
}

function applyLang(){
  const d = dict();
  document.documentElement.lang = currentLang === 'pl' ? 'pl' : 'uk';

  const subtitleEl = document.getElementById('subtitle');
  if (subtitleEl) subtitleEl.textContent = d.subtitle;

  const q = document.getElementById('q');
  if (q) q.placeholder = d.searchPlaceholder;

  const todoTitle = document.getElementById('todoTitle');
  if (todoTitle) todoTitle.textContent = d.todoTitle;
  const todoSub = document.getElementById('todoSub');
  if (todoSub) todoSub.textContent = d.todoSub;

  const doneTitle = document.getElementById('doneTitle');
  if (doneTitle) doneTitle.textContent = d.doneTitle;
  const doneSub = document.getElementById('doneSub');
  if (doneSub) doneSub.textContent = d.doneSub;

  const favSummary = document.getElementById('favSummary');
  if (favSummary) favSummary.textContent = d.favSummary;

  if (tmdbTitleEl) tmdbTitleEl.textContent = d.tmdbTitle;

  document.getElementById('mTitle').textContent = editing ? d.modalEditTitle : d.modalAddTitle;
  document.getElementById('cancel').textContent = d.modalCancel;
  document.getElementById('save').textContent = d.modalSave;

  document.getElementById('mwTitle').textContent = d.mwTitle;
  document.getElementById('mwLabelRating').textContent = d.mwLabelRating;
  document.getElementById('mwLabelComment').textContent = d.mwLabelComment;
  document.getElementById('mwCancel').textContent = d.mwCancel;
  document.getElementById('mwOk').textContent = d.mwOk;

  const authTitleEl = document.getElementById('authTitle');
  if (authTitleEl){
    authTitleEl.textContent =
      authMode === 'register'
        ? (currentLang === 'pl' ? 'Rejestracja' : 'Реєстрація')
        : d.authLoginTitle;
  }

  const aEmailLabel = document.getElementById('authEmailLabel');
  if (aEmailLabel) aEmailLabel.textContent = d.authEmailLabel;

  const aPassLabel = document.getElementById('authPasswordLabel');
  if (aPassLabel) aPassLabel.textContent = d.authPasswordLabel;

  const aNickLabel = document.getElementById('authNicknameLabel');
  if (aNickLabel) aNickLabel.textContent =
    currentLang === 'pl' ? 'Nick' : 'Нік';

  const aCancel = document.getElementById('authCancel');
  if (aCancel) aCancel.textContent = d.modalCancel;

  const tabLogin = document.getElementById('authTabLogin');
  if (tabLogin) tabLogin.textContent = d.authBtnLogin;

  const tabReg = document.getElementById('authTabRegister');
  if (tabReg) tabReg.textContent =
    currentLang === 'pl' ? 'Rejestracja' : 'Реєстрація';

  const submit = document.getElementById('authSubmit');
  if (submit) submit.textContent = 'OK';

  const addBtn = document.getElementById('addBtn');
  if (addBtn) addBtn.textContent = d.btnAdd;

  updateAuthUI();

  document.getElementById('langUk').classList.toggle('active', currentLang === 'uk');
  document.getElementById('langPl').classList.toggle('active', currentLang === 'pl');
}


document.getElementById('langUk').onclick = () => {
  currentLang = 'uk';
  localStorage.setItem('lang', 'uk');
  applyLang();
  render();
  loadFavs();
};

document.getElementById('langPl').onclick = () => {
  currentLang = 'pl';
  localStorage.setItem('lang', 'pl');
  applyLang();
  render();
  loadFavs();
};

loadUserFromStorage();
applyLang();
render();
loadFavs();
