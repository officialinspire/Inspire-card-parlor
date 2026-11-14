(function () {
  'use strict';
  if (
    window.__inspireStoreAnalytics ||
    !/^(www\.)?inspireclothing\.art$/.test(location.hostname) ||
    /\/(cart|account|checkout|checkouts|orders)(\/|$)/.test(location.pathname) ||
    (window.Shopify && window.Shopify.designMode)
  )
    return;
  window.__inspireStoreAnalytics = true;
  var sdk,
    initialized = false,
    pageCaptured = false,
    attribution,
    pending;
  var key = 'inspire_store_attribution_v1';
  var utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var events = ['$pageview', 'play_page_viewed', 'game_cta_clicked', 'game_outbound_launched'];
  var games = {
    'inspire-card-parlor': 'Inspire-card-parlor',
    gridlock: 'GRIDLOCK',
    blackjak: 'BlackJak',
    'bird-mahjong': 'Bird-Mahjong',
    'deja-vu-memory-game': 'DEJA-VU-MEMORY-GAME',
    'sudoku-by-inspire-v1': 'sudoku-by-inspire-v1',
    'i-spy': 'I-SPY',
    spiritball: 'SPIRITBALL',
    'inspire-x-ismokeshop-nugz-game': 'inspire-x-ismokeshop-NUGZ-game',
    'the-hardigan-boys-vs-the-mexican-drug-cartel': 'THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL',
    'emoji-elements-beta-version-': 'EMOJI-ELEMENTS-BETA-VERSION-',
    'close-encounters': 'CLOSE-ENCOUNTERS',
    'shells-feathers': 'SHELLS-FEATHERS',
    space_commando: 'SPACE_COMMANDO',
    'canna-cultivator-': 'CANNA-CULTIVATOR-',
  };
  var safeKeys = [
    'token',
    'distinct_id',
    '$device_id',
    '$session_id',
    '$window_id',
    '$lib',
    '$lib_version',
    '$browser',
    '$browser_version',
    '$os',
    '$os_version',
    '$device_type',
    '$screen_height',
    '$screen_width',
    '$viewport_height',
    '$viewport_width',
    '$insert_id',
    '$time',
    '$is_identified',
    '$process_person_profile',
    '$geoip_disable',
    '$current_url',
    '$host',
    '$pathname',
    '$referrer',
    '$referring_domain',
    'brand',
    'source',
    'store_domain',
    'analytics_version',
    'source_path',
    'game',
    'destination_url',
    'cta_location',
    'launch_method',
    'referral_domain',
    'qa_run_id',
    'launch_id',
    'attribution_version',
    'game_id',
  ].concat(utms);
  function allowed() {
    try {
      return (
        !navigator.globalPrivacyControl &&
        navigator.doNotTrack !== '1' &&
        window.Shopify.customerPrivacy.analyticsProcessingAllowed() === true
      );
    } catch (_) {
      return false;
    }
  }
  function clean(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9 _.:+-]{1,100}$/.test(value) ? value : undefined;
  }
  function host(value) {
    try {
      return new URL(value).hostname;
    } catch (_) {
      return '';
    }
  }
  function sessionAttribution() {
    if (attribution) return attribution;
    var saved;
    try {
      saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch (_) {}
    var now = Date.now(),
      params = new URLSearchParams(location.search),
      next = {},
      hasCampaign = false;
    utms.forEach(function (k) {
      var v = clean(params.get(k));
      if (v) {
        next[k] = v;
        hasCampaign = true;
      }
    });
    if (!hasCampaign && saved && now - saved.at < 1800000) {
      utms.forEach(function (k) {
        var v = clean(saved[k]);
        if (v) next[k] = v;
      });
      next.referral_domain = saved.referral_domain ? host('https://' + saved.referral_domain) : '';
    } else {
      var referral = host(document.referrer);
      next.referral_domain = referral === location.hostname ? '' : referral;
    }
    next.at = now;
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch (_) {}
    attribution = next;
    return next;
  }
  function common() {
    var a = sessionAttribution(),
      props = {
        brand: 'inspire',
        source: 'shopify_storefront',
        store_domain: 'www.inspireclothing.art',
        analytics_version: '2.0.0',
        source_path: location.pathname,
        referral_domain: a.referral_domain || '',
        $current_url: location.origin + location.pathname,
        $host: location.hostname,
        $pathname: location.pathname,
        $referrer: a.referral_domain ? 'https://' + a.referral_domain + '/' : '',
        $referring_domain: a.referral_domain || '',
        $process_person_profile: false,
        $geoip_disable: true,
      };
    utms.forEach(function (k) {
      if (a[k]) props[k] = a[k];
    });
    var qa = new URLSearchParams(location.search).get('inspire_analytics_qa');
    if (qa && /^[a-zA-Z0-9_-]{1,64}$/.test(qa)) props.qa_run_id = qa;
    return props;
  }
  function capture(name, props) {
    if (!sdk || !allowed()) return;
    try {
      sdk.capture(name, Object.assign(common(), props || {}));
    } catch (_) {}
  }
  function filterEvent(event) {
    if (!allowed() || !event || events.indexOf(event.event) < 0) return null;
    var props = event.properties || {},
      filtered = {};
    safeKeys.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(props, k)) filtered[k] = props[k];
    });
    Object.assign(filtered, common());
    utms.forEach(function (k) {
      var value = clean(props[k]);
      if (value) filtered[k] = value;
    });
    event.properties = filtered;
    return event;
  }
  function gameLink(anchor) {
    try {
      var url = new URL(
        anchor.getAttribute('data-inspire-original-href') || anchor.getAttribute('href'),
        location.href,
      );
      if (url.protocol !== 'https:' || url.hostname !== 'officialinspire.github.io') return;
      var parts = url.pathname.split('/').filter(Boolean);
      if (parts.length !== 1) return;
      var game = games[parts[0].toLowerCase()];
      if (!game) return;
      return { url: url, game: game };
    } catch (_) {}
  }
  function decorate(anchor, info, placement) {
    var url = info.url,
      a = sessionAttribution();
    if (!anchor.hasAttribute('data-inspire-original-href'))
      anchor.setAttribute('data-inspire-original-href', anchor.getAttribute('href'));
    utms.forEach(function (k) {
      if (a[k] && !url.searchParams.has(k)) url.searchParams.set(k, a[k]);
    });
    var defaults = {
      utm_source: 'inspireclothing.art',
      utm_medium: 'website',
      utm_campaign: 'inspire_arcade',
      utm_content: placement + '_' + info.game.toLowerCase(),
    };
    Object.keys(defaults).forEach(function (k) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, defaults[k]);
    });
    var hash = new URLSearchParams(url.hash.slice(1));
    var id =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var n = Math.floor(Math.random() * 16);
            return (c === 'x' ? n : (n & 3) | 8).toString(16);
          });
    hash.set('inspire_launch_id', id);
    hash.set('inspire_launch_at', String(Date.now()));
    hash.set('inspire_cta', placement);
    url.hash = hash.toString();
    anchor.setAttribute('href', url.href);
    var props = { launch_id: id, attribution_version: 'v2', game_id: info.game };
    utms.forEach(function (k) {
      var value = clean(url.searchParams.get(k));
      if (value) props[k] = value;
    });
    return props;
  }
  function click(event) {
    try {
      var node = event.target && event.target.closest ? event.target : event.target.parentElement;
      if (!node) return;
      if (node.closest('[data-game-modal-close], .inspire-game-modal__backdrop')) {
        pending = undefined;
        return;
      }
      if (!sdk || !allowed() || (event.type === 'auxclick' && event.button !== 1)) return;
      if (node.closest('[data-game-modal-continue]')) {
        var modal = document.getElementById('inspire-game-modal');
        if (pending && modal && modal.classList.contains('is-open')) {
          capture('game_outbound_launched', Object.assign({}, pending, { launch_method: 'modal_continue' }));
          pending = undefined;
        }
        return;
      }
      var anchor = node.closest('a[href]');
      if (!anchor || anchor.hasAttribute('download')) return;
      var info = gameLink(anchor);
      if (!info) return;
      var props = {
        game: info.game,
        destination_url: info.url.origin + info.url.pathname,
        cta_location: anchor.closest('[data-play-carousel]')
          ? 'play_carousel'
          : location.pathname === '/'
            ? 'homepage'
            : 'storefront',
      };
      Object.assign(props, decorate(anchor, info, props.cta_location));
      capture('game_cta_clicked', props);
      if (
        anchor.classList.contains('js-inspire-play') &&
        event.type === 'click' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        pending = props;
        return;
      }
      if (!event.defaultPrevented)
        capture(
          'game_outbound_launched',
          Object.assign({}, props, { launch_method: event.type === 'auxclick' ? 'middle_click' : 'direct_link' }),
        );
    } catch (_) {}
  }
  document.addEventListener('click', click, true);
  document.addEventListener('auxclick', click, true);
  function sync() {
    try {
      if (!allowed()) {
        attribution = undefined;
        pending = undefined;
        document.querySelectorAll('a[data-inspire-original-href]').forEach(function (a) {
          a.setAttribute('href', a.getAttribute('data-inspire-original-href'));
          a.removeAttribute('data-inspire-original-href');
        });
        try {
          sessionStorage.removeItem(key);
        } catch (_) {}
        if (sdk) sdk.opt_out_capturing();
        return;
      }
      if (sdk) {
        sdk.opt_in_capturing();
        recordPage();
        return;
      }
      if (initialized) return;
      initialized = true;
      installSDK();
    } catch (_) {}
  }
  document.addEventListener('visitorConsentCollected', sync);
  function loadPrivacy() {
    try {
      if (!window.Shopify) return;
      if (window.Shopify.customerPrivacy) {
        sync();
        return;
      }
      if (typeof window.Shopify.loadFeatures === 'function')
        window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], function (error) {
          if (!error) sync();
        });
    } catch (_) {}
  }
  function installSDK() {
    !(function (t, e) {
      var o, n, p, r;
      e.__SV ||
        (window.posthog && window.posthog.__loaded) ||
        ((window.posthog = e),
        (e._i = []),
        (e.init = function (i, s, a) {
          function g(t, e) {
            var o = e.split('.');
            (2 == o.length && ((t = t[o[0]]), (e = o[1])),
              (t[e] = function () {
                t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
              }));
          }
          p ||
            (((p = t.createElement('script')).type = 'text/javascript'),
            (p.crossOrigin = 'anonymous'),
            (p.async = !0),
            (p.src = s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js'),
            (p.onerror = function () {
              p = null;
            }),
            (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r));
          var u = e;
          for (
            void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
              u.people = u.people || [],
              Object.defineProperty(u, 'toString', {
                configurable: !0,
                enumerable: !0,
                writable: !0,
                value: function (t) {
                  var e = 'posthog';
                  return ('posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e);
                },
              }),
              Object.defineProperty(u.people, 'toString', {
                configurable: !0,
                enumerable: !0,
                writable: !0,
                value: function () {
                  return u.toString(1) + '.people (stub)';
                },
              }),
              o =
                'init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep'.split(
                  ' ',
                ),
              n = 0;
            n < o.length;
            n++
          )
            g(u, o[n]);
          e._i.push([i, s, a]);
        }),
        (e.__SV = 1));
    })(document, window.posthog || []);
    window.posthog.init(
      'phc_wpvFbvptidYWtnkJG8EdMMhaXn6s2ZDznzNUha5V4KRm',
      {
        api_host: 'https://us.i.posthog.com',
        defaults: '2026-05-30',
        persistence: 'localStorage',
        cross_subdomain_cookie: false,
        person_profiles: 'never',
        autocapture: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        before_send: filterEvent,
        loaded: function (instance) {
          sdk = instance;
          if (!allowed()) {
            sdk.opt_out_capturing();
            return;
          }
          recordPage();
        },
      },
      'inspireStore',
    );
  }
  function recordPage() {
    if (!pageCaptured && sdk && allowed()) {
      pageCaptured = true;
      capture('$pageview');
      if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?pages\/play\/?$/i.test(location.pathname)) capture('play_page_viewed');
    }
  }
  loadPrivacy();
})();
