/**
 * dc-premium-unlock.js  v4.0
 * DharmaChat — Universal Premium Unlock
 * Fixes: paywall-wrap + paywall-overlay both hidden, btn-upgrade hidden not renamed
 */
(function () {
  'use strict';

  var premium = null;
  try {
    var raw = localStorage.getItem('dc_premium');
    if (!raw) {
      raw = sessionStorage.getItem('dc_premium');
    }
    if (raw) {
      var d = JSON.parse(raw);
      if (d) {
        if (!d.expiry || new Date(d.expiry) > new Date()) {
          premium = d;
        } else {
          localStorage.removeItem('dc_premium');
        }
      }
    }
  } catch (e) {}

  // Website premium lock REMOVED — all scripture content is free for everyone
  // on the web. Premium lives in the app only. We still read dc_premium above
  // purely to decide whether to show the "Premium Active" banner to real
  // subscribers (see the gated banner block at the bottom of this file).
  // The unlock CSS + DOM pass below now run unconditionally for every visitor.

  /* ── CSS injection — unlocks all content types ── */
  var unlockCSS =
    '.chapter.locked-chapter .chapter-content,' +
    '.chapter.locked-ch .chapter-content,' +
    '.parva.locked-parva .parva-content,' +
    '.kanda.locked-k .kanda-content,' +
    '.upanishad.locked-up .up-content,' +
    '.veda.locked-veda .veda-content,' +
    '.purana.locked-purana .purana-content,' +
    /* direct fix for bhagavad-gita-18-chapters locked-chapter content */
    '.chapter.locked-chapter .chapter-content' +
    '{filter:none!important;max-height:none!important;' +
    'overflow:visible!important;user-select:auto!important;' +
    'pointer-events:auto!important;}' +
    /* Hide ALL paywall overlays AND paywall-wrap gradients */
    '.paywall-overlay,.paywall-wrap{display:none!important;}';

  var styleEl = document.createElement('style');
  styleEl.id  = 'dc-premium-unlock-v4';
  styleEl.textContent = unlockCSS;
  (document.head || document.documentElement).appendChild(styleEl);

  /* ── DOM manipulation ── */
  function unlockDOM() {
    /* Unlock all wrapper types */
    var wrappers = document.querySelectorAll(
      '.locked-chapter,.locked-ch,.locked-parva,.locked-k,' +
      '.locked-up,.locked-veda,.locked-purana'
    );

    wrappers.forEach(function (wrapper) {
      var contentDiv = wrapper.querySelector(
        '.chapter-content,.parva-content,.kanda-content,' +
        '.up-content,.veda-content,.purana-content'
      );
      if (contentDiv) {
        contentDiv.style.setProperty('filter',        'none',     'important');
        contentDiv.style.setProperty('max-height',    'none',     'important');
        contentDiv.style.setProperty('overflow',      'visible',  'important');
        contentDiv.style.setProperty('user-select',   'auto',     'important');
        contentDiv.style.setProperty('pointer-events','auto',     'important');
      }

      /* Hide paywall overlays AND paywall-wrap inside wrappers */
      var overlay = wrapper.querySelector('.paywall-overlay, .paywall-wrap');
      if (overlay) { overlay.style.setProperty('display', 'none', 'important'); }
    });

    /* Hide ALL standalone paywall overlays and paywall-wrap divs */
    document.querySelectorAll('.paywall-overlay, .paywall-wrap').forEach(function (el) {
      el.style.setProperty('display', 'none', 'important');
    });

    /* Hide the "Go Premium" button ONLY for users who already have premium.
       Everyone else should see it — it drives to the fee-free web checkout. */
    if (premium) {
      document.querySelectorAll('a.btn-upgrade').forEach(function (el) {
        el.style.setProperty('display', 'none', 'important');
      });
    }

    /* Fix Ramayana progress dots */
    document.querySelectorAll('.progress-k').forEach(function (dot) {
      var name = dot.getAttribute('data-name') || '';
      var m    = name.match(/\d+/);
      if (!m) return;
      var idx = parseInt(m[0], 10);
      var nd  = dot.cloneNode(false);
      nd.className = dot.className.replace(/(?:^|\s)(?!free-k)\S+/g, '').trim() + ' progress-k free-k';
      nd.setAttribute('data-name', name);
      nd.style.background = 'linear-gradient(90deg,#E8611A,#D4A017)';
      nd.style.cursor     = 'pointer';
      nd.onclick = function () { var t = document.getElementById('k-' + idx); if (t) t.scrollIntoView({ behavior: 'smooth' }); };
      if (dot.parentNode) dot.parentNode.replaceChild(nd, dot);
    });

    /* Fix Mahabharata progress dots */
    document.querySelectorAll('.progress-parva.locked').forEach(function (dot) {
      var name = dot.getAttribute('data-name') || '';
      var m    = name.match(/^(\d+)/);
      if (!m) return;
      var num = parseInt(m[1], 10);
      var nd  = dot.cloneNode(false);
      nd.className = 'progress-parva free';
      nd.setAttribute('data-name', name);
      nd.style.background = 'linear-gradient(90deg,#E8611A,#D4A017)';
      nd.style.cursor     = 'pointer';
      nd.onclick = function () { var t = document.getElementById('parva-' + num); if (t) t.scrollIntoView({ behavior: 'smooth' }); };
      if (dot.parentNode) dot.parentNode.replaceChild(nd, dot);
    });

    /* Fix nav links that point to premium.html */
    document.querySelectorAll(
      '.parva-nav-item,.k-nav-item,.up-nav-item,.veda-nav-item,.purana-nav-item'
    ).forEach(function (a) {
      if ((a.getAttribute('href') || '').indexOf('premium') !== -1) {
        a.innerHTML = a.innerHTML.replace('🔒', '📖');
        var m = a.textContent.match(/\d+/);
        if (m) {
          var n   = parseInt(m[0], 10);
          var ids = ['parva-','k-','up-','v-','p-','ch-'];
          for (var i = 0; i < ids.length; i++) {
            var t = document.getElementById(ids[i] + n);
            if (t) { a.setAttribute('href', '#' + t.id); break; }
          }
        }
        a.classList.remove('locked-item');
      }
    });

    /* Fix chapter nav links */
    document.querySelectorAll('.ch-nav-item,.chapter-pill').forEach(function (a) {
      if ((a.getAttribute('href') || '').indexOf('premium') !== -1) {
        a.innerHTML = a.innerHTML.replace('🔒', '📖');
        var m = a.textContent.match(/\d+/);
        if (m) {
          var n = parseInt(m[0], 10);
          var t = document.getElementById('ch-' + n);
          if (t) a.setAttribute('href', '#ch-' + n);
        }
        a.classList.remove('locked');
      }
    });

    console.log('[DharmaChat] Premium unlocked v4.0');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', unlockDOM);
  } else {
    unlockDOM();
  }
  window.addEventListener('load', unlockDOM);

  /* ── Premium status banner ── */
  window.addEventListener('load', function () {
    if (!premium) return; // banner only for real subscribers; web content is free for all
    if (sessionStorage.getItem('dc_unlock_v4')) return;
    sessionStorage.setItem('dc_unlock_v4', '1');

    var expiry  = premium.expiry ? new Date(premium.expiry) : null;
    var dateStr = expiry ? expiry.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : 'Active';
    var plan = (premium.plan === 'yearly' || premium.plan === 'annual') ? 'Annual' : 'Monthly';

    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(130%);z-index:99999;background:linear-gradient(135deg,#3E0000,#5A0A0A);border:1px solid rgba(212,160,23,0.5);border-radius:20px;padding:14px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 40px rgba(0,0,0,0.5);max-width:380px;width:calc(100% - 48px);transition:transform .5s cubic-bezier(0.34,1.56,0.64,1);';
    b.innerHTML = '<div style="font-size:20px;flex-shrink:0;">👑</div><div style="flex:1;min-width:0;"><div style="font-family:Cinzel,serif;font-size:12px;color:#F0C040;font-weight:700;margin-bottom:2px;">Premium Active — ' + plan + ' Plan</div><div style="font-size:10px;color:rgba(255,255,255,0.55);">Full access · Valid until ' + dateStr + '</div></div><button id="dcUnlockX" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:22px;height:22px;color:rgba(255,255,255,0.7);font-size:14px;cursor:pointer;flex-shrink:0;">×</button>';
    document.body.appendChild(b);
    setTimeout(function () { b.style.transform = 'translateX(-50%) translateY(0)'; }, 700);

    function dismiss() {
      b.style.transform = 'translateX(-50%) translateY(160%)';
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 500);
    }
    var t = setTimeout(dismiss, 4500);
    document.getElementById('dcUnlockX').addEventListener('click', function () { clearTimeout(t); dismiss(); });
  });

})();
