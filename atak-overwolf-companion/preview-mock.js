/* preview-mock.js — design preview with sample data.
 * Activates ONLY when the URL contains ?preview (Overwolf never passes it),
 * so this file has ZERO effect on the real overlay. Open in a browser:
 *   in_game.html?preview      champ_select.html?preview
 * It injects representative data into the existing DOM so you can iterate on
 * the visual design without Overwolf or a live game.
 */
(function () {
  if (!location.search.toLowerCase().includes('preview')) return;

  const DD = 'https://ddragon.leagueoflegends.com/cdn/15.1.1';
  const champImg = (c) => `${DD}/img/champion/${c}.png`;
  const itemImg = (id) => `${DD}/img/item/${id}.png`;
  const perk = (p) => `https://ddragon.leagueoflegends.com/cdn/img/perk-images/${p}`;
  const $ = (id) => document.getElementById(id);
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const img = (id, src) => { const e = $(id); if (e) { e.src = src; e.style.opacity = '1'; } };

  // Fake "game" backdrop so the liquid glass reads like it's over the client.
  function backdrop() {
    const d = document.createElement('div');
    d.style.cssText =
      'position:fixed;inset:0;z-index:-100;background-size:cover;background-position:center;' +
      `background-image:url('${DD.replace('/cdn/15.1.1', '')}/img/champion/splash/Ahri_0.jpg')`;
    // splash path is /cdn/img/champion/splash/.. — fix:
    d.style.backgroundImage = "url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg')";
    document.body.appendChild(d);
  }

  const TEAM_A = [
    { c: 'Garen', pos: 'TOP', n: 'TopDiff#LAN', k: 4, d: 2, a: 3, cs: 162, rank: 'PLAT II', wr: 54 },
    { c: 'LeeSin', pos: 'JG', n: 'InvadeNow#LAN', k: 6, d: 4, a: 9, cs: 121, rank: 'DIA IV', wr: 58 },
    { c: 'Ahri', pos: 'MID', n: 'Kister#NGC', k: 8, d: 3, a: 11, cs: 184, rank: 'DIA II', wr: 61, me: true },
    { c: 'Jinx', pos: 'BOT', n: 'RocketQ#LAN', k: 11, d: 2, a: 7, cs: 211, rank: 'PLAT I', wr: 56 },
    { c: 'Thresh', pos: 'SUP', n: 'HookGod#LAN', k: 1, d: 5, a: 19, cs: 38, rank: 'EME III', wr: 52 },
  ];
  const TEAM_B = [
    { c: 'Darius', pos: 'TOP', n: 'NoMercy#LAN', k: 3, d: 5, a: 2, cs: 148, rank: 'PLAT III', wr: 49 },
    { c: 'Viego', pos: 'JG', n: 'Reset#LAN', k: 5, d: 6, a: 6, cs: 133, rank: 'DIA III', wr: 53 },
    { c: 'Zed', pos: 'MID', n: 'ShadowOTP#LAN', k: 7, d: 6, a: 4, cs: 176, rank: 'DIA I', wr: 60 },
    { c: 'Caitlyn', pos: 'BOT', n: 'Headshot#LAN', k: 6, d: 4, a: 5, cs: 198, rank: 'PLAT II', wr: 51 },
    { c: 'Lulu', pos: 'SUP', n: 'Enchant#LAN', k: 0, d: 7, a: 14, cs: 31, rank: 'EME II', wr: 48 },
  ];

  // ── IN-GAME overlay ──────────────────────────────────────────────────────
  function previewInGame() {
    const waiting = $('waiting'); if (waiting) waiting.style.display = 'none';
    const live = $('live'); if (live) live.style.display = 'flex';
    const pill = $('live-pill'); if (pill) pill.classList.add('on');

    set('game-time', '24:17');
    img('champ-portrait', champImg('Ahri'));
    set('champ-name-live', 'Ahri');
    set('lv-badge', 'LV 14');
    set('summoner-live', 'Kister#NGC');
    const hp = $('hp-fill'); if (hp) hp.style.transform = 'scaleX(.78)';
    set('hp-txt', '1820 / 2310 HP');
    const mp = $('mp-fill'); if (mp) mp.style.transform = 'scaleX(.6)';
    set('mp-txt', '540 / 900 MP');
    set('gold-val', '12.4k');
    set('cs-val', '184 CS');
    set('cs-pm', '7.2 /min');
    set('st-k', '8'); set('st-d', '3'); set('st-a', '11'); set('st-kda', '6.3');
    set('cs-pill-v', '184 CS'); set('cs-pill-pm', '7.2 /min');
    set('ward-val', '18');
    set('gold-diff-val', '+2.1k'); set('gold-diff-lbl', 'GOLD LEAD');
    set('ms-ad', '142'); set('ms-ap', '320'); set('ms-ar', '78');
    set('ms-mr', '52'); set('ms-ms', '345'); set('ms-cr', '25%');
    const ai = $('ai-text'); if (ai) { ai.classList.remove('loading'); ai.textContent = 'You’re ahead in CS and gold — push your mid wave and look to roam bot for a pick. Watch Zed’s ult cooldown before stepping up.'; }

    const row = (p) => `
      <div class="prow ${p.me ? 'me' : (p.team === 'b' ? 'ally' : 'ally')} ${p.dead ? 'dead' : ''}">
        <img class="prow-icon" src="${champImg(p.c)}" />
        <div class="prow-left">
          <div class="prow-cname">${p.c}</div>
          <div class="prow-sub"><span>${p.pos}</span><span>LV ${10 + (p.k % 5)}</span>${p.me ? '<span style="color:var(--gold)">YOU</span>' : ''}</div>
        </div>
        <div class="prow-kda">
          <div><span class="kk">${p.k}</span>/<span class="dd">${p.d}</span>/<span class="aa">${p.a}</span></div>
          <div class="cs-s">${p.cs} cs</div>
        </div>
      </div>`;
    const ally = $('ally-list'); if (ally) ally.innerHTML = TEAM_A.map(row).join('');
    const enemy = $('enemy-list');
    if (enemy) enemy.innerHTML = TEAM_B.map(p => row(p).replace('class="prow ally', 'class="prow enemy')).join('');
  }

  // ── CHAMP SELECT overlay ─────────────────────────────────────────────────
  function previewChampSelect() {
    set('timer-num', '23');
    const tf = $('timer-fill'); if (tf) tf.style.width = '62%';

    const slot = (p, mine) => `
      <div class="cslot ${mine ? 'me locked' : 'locked'}">
        <img src="${champImg(p.c)}" />
        <div class="cgrad"></div>
        <div class="cpos">${p.pos}</div>
      </div>`;
    const aRow = $('ally-row'); if (aRow) aRow.innerHTML = TEAM_A.map(p => slot(p, p.me)).join('');
    const eRow = $('enemy-row'); if (eRow) eRow.innerHTML = TEAM_B.map(p => slot(p, false)).join('');

    const ban = (c) => `<div class="bslot filled"><img src="${champImg(c)}" /></div>`;
    const aBans = $('ally-bans'); if (aBans) aBans.innerHTML = ['Yasuo', 'Akali', 'Kaisa'].map(ban).join('');
    const eBans = $('enemy-bans'); if (eBans) eBans.innerHTML = ['Yone', 'Sylas', 'Vayne'].map(ban).join('');

    // Pick panel
    const noPick = $('no-pick'); if (noPick) noPick.style.display = 'none';
    const pickCard = $('pick-card'); if (pickCard) pickCard.style.display = 'flex';
    img('pick-img', champImg('Ahri'));
    const lb = $('lock-badge'); if (lb) lb.classList.add('on');
    const pw = $('pick-winrate'); if (pw) pw.childNodes[0].nodeValue = '52% ';
    set('s-patch', '15.1'); set('s-role', 'MID');
    set('pick-champ-name', 'Ahri');
    set('pick-role-tag', 'MID');
    const tip = $('pick-tip'); if (tip) { tip.classList.remove('loading'); tip.textContent = 'Hit level 6 power spike before forcing fights. Save charm for engages, and roam after pushing the wave.'; }
    img('keystone-icon', perk('Styles/Domination/Electrocute/Electrocute.png'));
    set('keystone-name', 'Electrocute');
    img('rune-path-icon', perk('Styles/7200_Domination.png'));
    const subR = $('sub-runes');
    if (subR) subR.innerHTML = [
      'Styles/Domination/CheapShot/CheapShot.png',
      'Styles/Domination/EyeballCollection/EyeballCollection.png',
      'Styles/Sorcery/Transcendence/Transcendence.png',
    ].map(p => `<img class="rune-sm" src="${perk(p)}" />`).join('');

    const items = (id) => `<img class="iico" src="${itemImg(id)}" />`;
    const starter = $('starter-row'); if (starter) starter.innerHTML = [1056, 2003].map(items).join('');
    const core = $('core-row'); if (core) core.innerHTML = [6655, 4645, 3157].map(items).join('');
    const boots = $('boots-row'); if (boots) boots.innerHTML = [`<img class="iico boots" src="${itemImg(3020)}" />`].join('');
  }

  function run() {
    backdrop();
    if ($('kda-card')) previewInGame();
    if ($('panel-pick')) previewChampSelect();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 60));
  else setTimeout(run, 60);
})();
