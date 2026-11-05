/*
 * BilimGo — Android ko'prigi.
 * Faqat Android ilova ichida (window.AndroidTTS mavjud bo'lsa) ishga tushadi; oddiy brauzerda hech narsa qilmaydi.
 *  1) window.speechSynthesis va SpeechSynthesisUtterance ni Android TextToSpeech orqali ishlatadi
 *     (Android WebView da Web Speech API jim ishlaydi).
 *  2) window.__bilimgoBack() — tizimning "Orqaga" tugmasi uchun ilova ichidagi navigatsiya.
 * Bu skript asosiy ilova skriptidan OLDIN yuklanishi shart (hasTTS yuklanishda tekshiriladi).
 */
(function () {
  'use strict';
  var A = window.AndroidTTS;
  if (!A) return;

  var voices = [];
  var seq = 0;
  var live = {}; // id -> utterance
  var listeners = {voiceschanged: []};

  function Voice(o) {
    this.name = o.name; this.lang = o.lang; this.voiceURI = 'android:' + o.lang;
    this.localService = true; this['default'] = false;
  }

  function SpeechSynthesisUtterance(text) {
    this.text = text == null ? '' : String(text);
    this.lang = ''; this.voice = null;
    this.rate = 1; this.pitch = 1; this.volume = 1;
    this.onstart = null; this.onend = null; this.onerror = null;
    this._l = {};
  }
  SpeechSynthesisUtterance.prototype.addEventListener = function (t, f) { (this._l[t] = this._l[t] || []).push(f); };
  SpeechSynthesisUtterance.prototype.removeEventListener = function (t, f) {
    var a = this._l[t]; if (a) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
  };

  function fire(target, type, ev) {
    try { if (typeof target['on' + type] === 'function') target['on' + type](ev); } catch (e) { setTimeout(function () { throw e; }); }
    var a = (target._l || listeners)[type] || [];
    a.slice().forEach(function (f) { try { f.call(target, ev); } catch (e) { setTimeout(function () { throw e; }); } });
  }

  var synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { return voices.slice(); },
    speak: function (u) {
      if (!u) return;
      var id = String(++seq);
      live[id] = u;
      synth.pending = true;
      var lang = (u.voice && u.voice.lang) || u.lang || 'en-US';
      var rate = Number(u.rate), pitch = Number(u.pitch);
      A.speak(String(u.text || ''), isFinite(rate) ? rate : 1, isFinite(pitch) ? pitch : 1, String(lang), id);
    },
    cancel: function () {
      // Bekor qilinganlar uchun native 'end' keyin keladi — live dan o'chirilgani uchun e'tiborsiz qoldiriladi.
      live = {};
      synth.speaking = synth.pending = false;
      A.stop();
    },
    pause: function () {}, resume: function () {},
    addEventListener: function (t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: function (t, f) {
      var a = listeners[t]; if (a) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
    }
  };

  function setVoices(json) {
    var list = [];
    try { list = JSON.parse(json || '[]'); } catch (e) { list = []; }
    voices = list.map(function (o) { return new Voice(o); });
    if (voices[0]) voices[0]['default'] = true;
    fire(synth, 'voiceschanged', {type: 'voiceschanged'});
  }

  window.__bilimgoTts = {
    ready: function (json) { setVoices(json); },
    event: function (id, type) {
      var u = live[id];
      if (!u) return;
      if (type === 'start') { synth.pending = false; synth.speaking = true; }
      else { delete live[id]; synth.speaking = synth.pending = Object.keys(live).length > 0; }
      fire(u, type, {type: type, utterance: u, charIndex: 0, elapsedTime: 0});
    }
  };

  try {
    Object.defineProperty(window, 'speechSynthesis', {value: synth, configurable: true, writable: true});
  } catch (e) { try { window.speechSynthesis = synth; } catch (e2) {} }
  try {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {value: SpeechSynthesisUtterance, configurable: true, writable: true});
  } catch (e) { window.SpeechSynthesisUtterance = SpeechSynthesisUtterance; }

  // TTS dvigateli sahifadan oldin tayyor bo'lgan bo'lsa — ovozlarni darhol olamiz.
  var initial = '';
  try { initial = A.getVoices(); } catch (e) {}
  if (initial) setTimeout(function () { setVoices(initial); }, 0);

  /* ---------- Orqaga tugmasi ---------- */
  function q(sel) { return document.querySelector(sel); }
  function click(el) { el.click(); return true; }

  window.__bilimgoBack = function () {
    try {
      // 1) Ochiq pastki oyna (sheet) — fonni bosgandek yopamiz
      var ov = document.querySelectorAll('.overlay.show');
      if (ov.length) {
        var o = ov[ov.length - 1];
        o.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
        return true;
      }
      // 2) Dars / test: "Chiqish" tasdig'i
      var el = q('#quit');
      if (el) return click(el);
      // 3) Ro'yxatdan o'tish bosqichlari: oldingi qadam
      el = q('#back');
      if (el) return click(el);
      // 4) Natija oynasi: "Davom etish"
      el = q('#cont') || q('#goStart');
      if (el) return click(el);
      // 5) Reyting / Mukofotlar / Profil: bosh sahifaga
      var nav = q('.nav');
      if (nav) {
        var home = nav.querySelector('[data-tab="home"]');
        if (home && !home.classList.contains('on')) { home.click(); return true; }
      }
    } catch (e) {}
    return false; // native tomon ilovadan chiqadi (2 marta bosilganda)
  };
})();
