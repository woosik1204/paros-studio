/* =====================================================================
   Paros Studio — analytics (PostHog)

   Turn it on by pasting your PostHog project key into SITE.analytics in
   data.js. Until then nothing is loaded or sent.

   What gets recorded:
   - page views, time on page, where visitors came from (PostHog default)
   - every click (PostHog autocapture) plus named events from the site:
       cta_click          any button/link with data-track (which one = "cta")
       product_request    "Request this" on a product card (which "product")
       gallery_nav        arrows on a product photo gallery
       filter_click       shop category chips
       lang_switch        KR / EN
       request_submitted  order/request form sent (type, item, quantity only —
                          never the visitor's name or contact)
       send_email / send_dm   which send option they chose
   - session replay and heatmaps, if switched on in PostHog settings
     (form inputs are masked)

   A/B tests: create a multivariate feature flag / experiment in PostHog
   with the same key as an entry in SITE.analytics.experiments. Visitors
   then get "control" or "test" and the site swaps the matching text.
   ===================================================================== */
(function () {
  "use strict";

  var POSTHOG_ESM = "https://cdn.jsdelivr.net/npm/posthog-js@1.438.21/+esm";
  // SITE is declared with const in data.js, so it is a global but not window.SITE.
  var cfg = (typeof SITE !== "undefined" && SITE.analytics) || {};
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var queue = [];
  var flagWaiters = [];
  var ph = null;

  function log() {
    if (isLocal && window.console) console.info.apply(console, ["[analytics]"].concat([].slice.call(arguments)));
  }

  /* Record a named event. Safe to call before PostHog has loaded. */
  window.track = function (event, props) {
    var p = props || {};
    log(event, p);
    if (ph) ph.capture(event, p);
    else if (cfg.posthogKey) queue.push([event, p]);
  };

  /* Super properties attached to every later event. */
  window.trackContext = function (props) {
    log("context", props);
    if (ph) ph.register(props);
    else if (cfg.posthogKey) queue.push(["$register", props]);
  };

  /* Ask which A/B variant this visitor is in. cb(variant) is called once;
     variant is "control" when analytics is off or the flag doesn't exist. */
  window.abVariant = function (flagKey, cb) {
    if (!cfg.posthogKey) { cb("control"); return; }
    if (ph) ph.onFeatureFlags(function () { cb(ph.getFeatureFlag(flagKey) || "control"); });
    else flagWaiters.push([flagKey, cb]);
  };

  if (!cfg.posthogKey) {
    log("off — no PostHog key in data.js (events are only logged here on localhost)");
    return;
  }

  import(POSTHOG_ESM).then(function (mod) {
    var posthog = mod.default || mod.posthog || mod;
    posthog.init(cfg.posthogKey, {
      api_host: cfg.posthogHost || "https://us.i.posthog.com",
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: { maskAllInputs: true },
      // Never send test traffic from your own computer's preview.
      before_send: isLocal ? function (e) { log("(not sent from localhost)", e && e.event); return null; } : undefined,
    });
    ph = posthog;
    queue.splice(0).forEach(function (q) {
      if (q[0] === "$register") ph.register(q[1]); else ph.capture(q[0], q[1]);
    });
    flagWaiters.splice(0).forEach(function (w) { window.abVariant(w[0], w[1]); });
  }).catch(function (err) {
    log("could not load PostHog", err);
    flagWaiters.splice(0).forEach(function (w) { w[1]("control"); });
  });
})();
