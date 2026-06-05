// DharmaChat Shared Navigation v5.0
// Cross-device premium sync via Firebase Firestore.
import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut as fbSignOut }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyDvw26WTzNRsBBgjXG9At60pN8ApDvPB7o",
  authDomain:        "dharmachat-cc71d.firebaseapp.com",
  projectId:         "dharmachat-cc71d",
  storageBucket:     "dharmachat-cc71d.firebasestorage.app",
  messagingSenderId: "718284855701",
  appId:             "1:718284855701:web:d7ef64292cd48ffdf13e9c"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

window.__dcFirestore = db;
window.__dcSetDoc    = setDoc;
window.__dcDoc       = doc;

const style = document.createElement('style');
style.textContent = `
.dc-burger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:6px;border:none;background:none;z-index:1001;}
.dc-burger span{display:block;width:24px;height:2px;background:rgba(240,192,64,0.8);border-radius:2px;transition:all .3s ease;}
.dc-burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg);}
.dc-burger.open span:nth-child(2){opacity:0;transform:scaleX(0);}
.dc-burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}
.dc-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999;backdrop-filter:blur(2px);opacity:0;transition:opacity .3s ease;}
.dc-overlay.show{display:block;opacity:1;}
.dc-drawer{position:fixed;top:0;right:-320px;width:300px;height:100vh;background:linear-gradient(160deg,#3E0000 0%,#5A0A0A 100%);z-index:1000;transition:right .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,0.5);overflow-y:auto;}
.dc-drawer.open{right:0;}
.dc-drawer-head{padding:20px 24px;border-bottom:1px solid rgba(212,160,23,0.15);display:flex;align-items:center;justify-content:space-between;}
.dc-drawer-logo{display:flex;align-items:center;gap:10px;text-decoration:none;}
.dc-drawer-logo img{width:36px;height:36px;border-radius:50%;object-fit:cover;box-shadow:0 0 10px rgba(212,160,23,0.4);}
.dc-drawer-logo span{font-family:'Cinzel Decorative',serif;font-size:15px;color:#F0C040;}
.dc-close{background:none;border:none;color:rgba(255,255,255,0.4);font-size:22px;cursor:pointer;padding:4px 8px;line-height:1;transition:color .2s;}
.dc-close:hover{color:rgba(240,192,64,0.8);}
.dc-drawer-user{padding:20px 24px;border-bottom:1px solid rgba(212,160,23,0.1);min-height:80px;display:flex;align-items:center;}
.dc-drawer-user-inner{display:flex;align-items:center;gap:12px;width:100%;}
.dc-drawer-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid rgba(212,160,23,0.4);flex-shrink:0;}
.dc-drawer-avatar-placeholder{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#6B1A1A,#E8611A);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:16px;color:#F0C040;font-weight:700;flex-shrink:0;}
.dc-drawer-user-info{flex:1;}
.dc-drawer-user-name{font-family:'Cinzel',serif;font-size:13px;color:#F0C040;font-weight:700;margin-bottom:2px;}
.dc-drawer-user-sub{font-family:'EB Garamond',serif;font-style:italic;font-size:12px;color:rgba(255,255,255,0.35);}
.dc-drawer-signin-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:13px 18px;background:white;border:none;border-radius:50px;font-family:'Noto Sans',sans-serif;font-size:14px;font-weight:500;color:#333;cursor:pointer;transition:all .2s;box-shadow:0 4px 16px rgba(0,0,0,0.2);}
.dc-drawer-signin-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,0.3);}
.dc-drawer-nav{padding:16px 0;flex:1;}
.dc-drawer-nav a{display:flex;align-items:center;gap:14px;padding:14px 24px;font-family:'Cinzel',serif;font-size:13px;letter-spacing:.06em;color:rgba(255,255,255,0.65);text-decoration:none;transition:all .2s;border-left:3px solid transparent;}
.dc-drawer-nav a:hover{color:#F0C040;background:rgba(212,160,23,0.05);border-left-color:rgba(212,160,23,0.4);}
.dc-drawer-nav a.active{color:#F0C040;background:rgba(212,160,23,0.08);border-left-color:#D4A017;}
.dc-drawer-nav .dc-nav-emoji{font-size:18px;width:24px;text-align:center;flex-shrink:0;}
.dc-drawer-nav .dc-nav-badge{margin-left:auto;font-size:9px;background:rgba(232,97,26,0.2);color:#F5832A;border:1px solid rgba(232,97,26,0.3);border-radius:10px;padding:2px 8px;letter-spacing:.04em;}
.dc-drawer-divider{height:1px;background:rgba(212,160,23,0.1);margin:8px 24px;}
.dc-drawer-cta{padding:20px 24px 32px;border-top:1px solid rgba(212,160,23,0.1);}
.dc-drawer-cta a{display:block;text-align:center;padding:13px;background:linear-gradient(135deg,#E8611A,#D4A017);border-radius:50px;color:white;font-family:'Cinzel',serif;font-size:13px;font-weight:700;letter-spacing:.06em;text-decoration:none;box-shadow:0 4px 16px rgba(232,97,26,0.35);transition:all .2s;margin-bottom:10px;}
.dc-drawer-cta a:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(232,97,26,0.45);}
.dc-drawer-signout{width:100%;padding:10px;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:50px;color:rgba(255,255,255,0.35);font-family:'Cinzel',serif;font-size:11px;letter-spacing:.06em;cursor:pointer;transition:all .2s;}
.dc-drawer-signout:hover{border-color:rgba(255,255,255,0.2);color:rgba(255,255,255,0.6);}
@media(max-width:860px){.dc-burger{display:flex !important;}}
`;
document.head.appendChild(style);

const path     = window.location.pathname.split('/').pop() || 'index.html';
const isActive = (href) => (path === href || path === href.replace('.html','')) ? 'active' : '';

const navLinks = [
  { href:'index.html',     emoji:'🏠', label:'Home' },
  { href:'articles.html',  emoji:'📖', label:'Dharma Articles', badge:'2,000+' },
  { href:'lessons.html',   emoji:'📚', label:'Learn' },
  { href:'chat.html',      emoji:'🤖', label:'AI Chat' },
  { href:'premium.html',   emoji:'👑', label:'Premium', badge:'7-day free' },
];

const googleSVG = (w, h) => `<svg width="${w}" height="${h}" viewBox="0 0 24 24">
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
</svg>`;

function readPremium() {
  try {
    const raw = localStorage.getItem('dc_premium');
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d) return null;
    if (d.expiry && new Date(d.expiry) <= new Date()) {
      try { localStorage.removeItem('dc_premium'); } catch(e) {}
      return null;
    }
    return d;
  } catch(e) { return null; }
}

// Firestore is the AUTHORITATIVE source of premium status. The
// matching firestore.rules deny client writes to users/{uid}/premium,
// so the only way a doc can be there is if /api/verify-payment wrote
// it after a Razorpay-verified purchase. This function makes sure
// localStorage cannot drift from Firestore — if Firestore says no
// premium (or expired), we wipe the local copy. This is what defeats
// the "set localStorage from devtools" bypass on any signed-in device.
async function syncPremiumFromFirestore(user) {
  if (!user) return;
  try {
    const premiumRef = doc(db, 'users', user.uid, 'premium', 'status');
    const snap       = await getDoc(premiumRef);

    // No server-side premium doc → user is NOT premium. Wipe any
    // local copy that might have been set manually or left over from
    // a previous account on this device.
    if (!snap.exists()) {
      try { localStorage.removeItem('dc_premium'); } catch(e) {}
      try { sessionStorage.removeItem('dc_premium'); } catch(e) {}
      updateDrawerPremiumState();
      updateDesktopAuth(user);
      return;
    }

    const data = snap.data();
    // Expired premium → also wipe the local copy.
    if (data.expiry && new Date(data.expiry) <= new Date()) {
      try { localStorage.removeItem('dc_premium'); } catch(e) {}
      try { sessionStorage.removeItem('dc_premium'); } catch(e) {}
      updateDrawerPremiumState();
      updateDesktopAuth(user);
      return;
    }

    // Active premium → mirror Firestore into local storage so the
    // synchronous readers (dc-premium-unlock.js, the rest of nav.js)
    // see it instantly without waiting for another async round trip.
    try {
      localStorage.setItem('dc_premium', JSON.stringify(data));
    } catch(e) {
      try { sessionStorage.setItem('dc_premium', JSON.stringify(data)); } catch(e2) {}
    }
    updateDrawerPremiumState();
    updateDesktopAuth(user);
    hideTryFreeIfPremium();
    if (window.__dcPremiumUnlock) window.__dcPremiumUnlock();
  } catch(err) {
    console.warn('[DharmaChat] Firestore sync failed:', err.message);
  }
}

function buildDrawer() {
  const premium = readPremium();
  const navHtml = navLinks.map(l => `
    <a href="${l.href}" class="${isActive(l.href)}">
      <span class="dc-nav-emoji">${l.emoji}</span>
      ${l.label}
      ${l.badge ? `<span class="dc-nav-badge">${l.badge}</span>` : ''}
    </a>`).join('');

  const premiumRowHtml = premium
    ? `<a id="dcDrawerPremiumLink" href="premium.html" style="color:#F0C040;">
        <span class="dc-nav-emoji">👑</span>Premium Member
        <span class="dc-nav-badge" style="background:rgba(212,160,23,0.2);color:#F0C040;border-color:rgba(212,160,23,0.4);">ACTIVE</span>
      </a>`
    : `<a id="dcDrawerPremiumLink" href="premium.html">
        <span class="dc-nav-emoji">👑</span>Premium Plan
        <span class="dc-nav-badge">UPGRADE</span>
      </a>`;

  const ctaBtnHtml = premium
    ? `<a id="dcDrawerCta" href="bhagavad-gita-18-chapters.html" style="background:linear-gradient(135deg,#8B1A1A,#D4A017);">📖 Read Scriptures</a>`
    : `<a id="dcDrawerCta" href="chat.html">Ask DharmaChat AI →</a>`;

  const drawerEl = document.createElement('div');
  drawerEl.id = 'dcDrawer';
  drawerEl.className = 'dc-drawer';
  drawerEl.innerHTML = `
    <div class="dc-drawer-head">
      <a class="dc-drawer-logo" href="index.html">
        <img src="logo.jpeg" alt="DharmaChat" loading="lazy"/>
        <span>DharmaChat</span>
      </a>
      <button class="dc-close" id="dcClose" aria-label="Close menu">✕</button>
    </div>
    <div class="dc-drawer-user" id="dcDrawerUser">
      <button class="dc-drawer-signin-btn" id="dcDrawerSignIn">
        ${googleSVG(18,18)} Sign In with Google
      </button>
    </div>
    <nav class="dc-drawer-nav">
      ${navHtml}
      <div class="dc-drawer-divider"></div>
      ${premiumRowHtml}
    </nav>
    <div class="dc-drawer-cta">
      ${ctaBtnHtml}
      <button class="dc-drawer-signout" id="dcDrawerSignOut" style="display:none;">Sign Out</button>
    </div>`;

  const overlayEl = document.createElement('div');
  overlayEl.id = 'dcOverlay';
  overlayEl.className = 'dc-overlay';
  document.body.appendChild(overlayEl);
  document.body.appendChild(drawerEl);
  return { drawerEl, overlayEl };
}

function updateDrawerPremiumState() {
  const premium = readPremium();
  const premiumLink = document.getElementById('dcDrawerPremiumLink');
  if (premiumLink) {
    if (premium) {
      premiumLink.style.color = '#F0C040';
      premiumLink.innerHTML = `<span class="dc-nav-emoji">👑</span>Premium Member<span class="dc-nav-badge" style="background:rgba(212,160,23,0.2);color:#F0C040;border-color:rgba(212,160,23,0.4);">ACTIVE</span>`;
    } else {
      premiumLink.style.color = '';
      premiumLink.innerHTML = `<span class="dc-nav-emoji">👑</span>Premium Plan<span class="dc-nav-badge">UPGRADE</span>`;
    }
  }
  const ctaLink = document.getElementById('dcDrawerCta');
  if (ctaLink) {
    if (premium) {
      ctaLink.href = 'bhagavad-gita-18-chapters.html';
      ctaLink.textContent = '📖 Read Scriptures';
      ctaLink.style.background = 'linear-gradient(135deg,#8B1A1A,#D4A017)';
    } else {
      ctaLink.href = 'chat.html';
      ctaLink.textContent = 'Ask DharmaChat AI →';
      ctaLink.style.background = '';
    }
  }
}

function buildBurger() {
  const burger = document.createElement('button');
  burger.id = 'dcBurger';
  burger.className = 'dc-burger';
  burger.setAttribute('aria-label', 'Open menu');
  burger.innerHTML = '<span></span><span></span><span></span>';
  const nav = document.querySelector('nav');
  if (!nav) return burger;
  const navRight = nav.querySelector('.nav-cta,.nav-right,.topbar-right,.nav-links');
  if (navRight) navRight.insertBefore(burger, navRight.firstChild);
  else nav.appendChild(burger);
  return burger;
}

function wireEvents(burger, drawerEl, overlayEl) {
  const open = () => { drawerEl.classList.add('open'); overlayEl.classList.add('show'); burger.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { drawerEl.classList.remove('open'); overlayEl.classList.remove('show'); burger.classList.remove('open'); document.body.style.overflow = ''; };
  burger.addEventListener('click', open);
  overlayEl.addEventListener('click', close);
  document.getElementById('dcClose')?.addEventListener('click', close);
  drawerEl.querySelectorAll('nav a').forEach(a => a.addEventListener('click', close));
  document.getElementById('dcDrawerSignIn')?.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); }
    catch(e) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') console.error(e.code); }
  });
  document.getElementById('dcDrawerSignOut')?.addEventListener('click', async () => {
    await fbSignOut(auth);
    try { localStorage.removeItem('dc_guest'); } catch(e) {}
    location.reload();
  });
}

function updateDrawerUser(user) {
  const userSection = document.getElementById('dcDrawerUser');
  const signoutBtn  = document.getElementById('dcDrawerSignOut');
  if (!userSection) return;
  if (user) {
    const photo = user.photoURL || '';
    const name  = user.displayName?.split(' ')[0] || 'Devotee';
    const email = user.email || '';
    userSection.innerHTML = `<div class="dc-drawer-user-inner">
      ${photo ? `<img src="${photo}" class="dc-drawer-avatar" alt="${name}" loading="lazy" onerror="this.style.display='none'"/>` : `<div class="dc-drawer-avatar-placeholder">${name.charAt(0)}</div>`}
      <div class="dc-drawer-user-info"><div class="dc-drawer-user-name">${name}</div><div class="dc-drawer-user-sub">${email}</div></div>
    </div>`;
    if (signoutBtn) signoutBtn.style.display = 'block';
  } else {
    const guest = localStorage.getItem('dc_guest');
    if (guest) {
      userSection.innerHTML = `<div class="dc-drawer-user-inner">
        <div class="dc-drawer-avatar-placeholder">${guest.charAt(0).toUpperCase()}</div>
        <div class="dc-drawer-user-info"><div class="dc-drawer-user-name">${guest}</div><div class="dc-drawer-user-sub">Guest Devotee</div></div>
      </div>`;
      if (signoutBtn) signoutBtn.style.display = 'block';
    } else {
      userSection.innerHTML = `<button class="dc-drawer-signin-btn" id="dcDrawerSignIn">${googleSVG(18,18)} Sign In with Google</button>`;
      document.getElementById('dcDrawerSignIn')?.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch(e) {} });
    }
  }
}

function updateDesktopAuth(user) {
  const navAuth = document.getElementById('navAuth');
  if (!navAuth) return;
  const premium = readPremium();
  if (user) {
    const name  = user.displayName?.split(' ')[0] || 'Devotee';
    const photo = user.photoURL || '';
    navAuth.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">
      ${photo ? `<img src="${photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid rgba(212,160,23,0.4);" loading="lazy" onerror="this.style.display='none'"/>` : ''}
      <span style="font-family:Cinzel,serif;font-size:12px;color:rgba(240,192,64,0.9);">${name}</span>
      ${premium ? `<span id="dcNavPremiumBadge" style="font-family:Cinzel,serif;font-size:10px;color:#F0C040;background:rgba(212,160,23,0.15);border:1px solid rgba(212,160,23,0.35);border-radius:20px;padding:3px 10px;letter-spacing:.04em;">👑 Premium</span>` : ''}
      <button onclick="window.__dcNavSignOut()" style="font-family:Cinzel,serif;font-size:10px;color:rgba(255,255,255,0.4);background:none;border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:4px 10px;cursor:pointer;letter-spacing:.04em;">Sign Out</button>
    </div>`;
  } else if (premium) {
    navAuth.innerHTML = `<a id="dcNavPremiumBadge" href="premium.html" style="display:flex;align-items:center;gap:8px;font-family:Cinzel,serif;font-size:11px;color:#F0C040;background:rgba(212,160,23,0.1);border:1px solid rgba(212,160,23,0.3);border-radius:20px;padding:5px 14px;text-decoration:none;letter-spacing:.04em;">👑 Premium Member</a>`;
  } else {
    navAuth.innerHTML = `<button onclick="window.__dcNavSignIn()" style="display:flex;align-items:center;gap:8px;padding:7px 16px;background:white;border:none;border-radius:50px;font-family:Noto Sans,sans-serif;font-size:12px;color:#333;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${googleSVG(14,14)} Sign In</button>`;
  }
  window.__dcNavSignIn  = async () => { try { await signInWithPopup(auth, provider); } catch(e) {} };
  window.__dcNavSignOut = async () => { await fbSignOut(auth); try { localStorage.removeItem('dc_guest'); } catch(e) {} location.reload(); };
}

function hideTryFreeIfPremium() {
  if (!readPremium()) return;
  const PROTECTED = ['#navAuth','#dcNavPremiumBadge','#dcDrawer','#heroBtns','.hero','.hero-btns','footer'];
  document.querySelectorAll('a, button').forEach(function(el) {
    for (let i = 0; i < PROTECTED.length; i++) { if (el.closest(PROTECTED[i])) return; }
    if (el.id === 'dcNavPremiumBadge') return;
    const txt = el.textContent.trim().toLowerCase();
    if (txt === 'try free' || txt === 'try dharmachat free' || txt.startsWith('try ') ||
        txt === 'go premium' || txt === '👑 go premium' ||
        txt.includes('upgrade')) {
      el.style.setProperty('display', 'none', 'important');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const { drawerEl, overlayEl } = buildDrawer();
  const burger = buildBurger();
  wireEvents(burger, drawerEl, overlayEl);

  onAuthStateChanged(auth, async (user) => {
    updateDesktopAuth(user);
    updateDrawerUser(user);
    if (user) { await syncPremiumFromFirestore(user); }
    updateDrawerPremiumState();
    hideTryFreeIfPremium();
  });

  if (!auth.currentUser) { updateDrawerUser(null); }
  window.addEventListener('load', () => { setTimeout(hideTryFreeIfPremium, 300); });

  // Sidebar: make MORE LESSONS scrollable + swap emoji thumbs for real article images
  const thumbMap = {
    'who-is-hanuman': 'hanuman2.png',
    'who-is-lord-rama': 'article-rama.jpg',
    'who-is-sita': 'article-sita.jpg',
    'who-is-ravana': 'article-ravana.jpg',
    'who-is-lord-krishna': 'krishna.png',
    'who-is-lord-shiva': 'shiva.png',
    'who-is-arjuna': 'article-arjuna.jpg',
    'who-is-karna': 'article-karna.jpg',
    'who-is-bhishma': 'article-bhishma.jpg',
    'who-is-goddess-durga': 'article-durga.jpg',
    'what-is-dharma': 'article-dharma.jpg',
    'what-is-karma': 'article-karma.jpg',
    'what-is-moksha': 'moksha.png',
    'what-are-the-4-vedas': 'article-vedas.jpg',
    'vedas': 'article-vedas.jpg',
    'what-happens-after-death': 'afterdeath.png',
    'four-purusharthas': 'article-purusharthas.jpg',
    'how-to-find-inner-peace': 'article-innerpeace.jpg',
    'is-ahimsa-absolute': 'article-ahimsa.jpg',
    'ramayana': 'article-rama.jpg',
    'bhagavad-gita-18-chapters': 'gita.png',
    'bhagavad-gita': 'gita.png',
  };
  document.querySelectorAll('.sidebar-card').forEach(card => {
    const h3 = card.querySelector('h3');
    if (!h3 || !h3.textContent.includes('MORE')) return;
    const nav = card.querySelector('.sidebar-nav');
    if (nav) { nav.style.maxHeight = '360px'; nav.style.overflowY = 'auto'; nav.style.paddingRight = '4px'; }
    card.querySelectorAll('.related-card').forEach(rc => {
      const href = rc.getAttribute('href') || '';
      const key = Object.keys(thumbMap).find(k => href.includes(k));
      const thumb = rc.querySelector('.related-thumb');
      if (key && thumb) {
        thumb.innerHTML = `<img src="${thumbMap[key]}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:8px 8px 0 0;">`;
        thumb.style.cssText = 'height:100px;overflow:hidden;font-size:0;padding:0;border-radius:8px 8px 0 0;';
        rc.style.borderRadius = '10px';
        rc.style.overflow = 'hidden';
      }
    });
  });
});
