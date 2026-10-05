/**
 * Runs before hydration (inline, no React).
 *
 * 1. One-time bust of broken App Shell service workers that served /~offline for
 *    every navigation (React #418). Keeps utility-pdf-* caches.
 * 2. On utilityos.tech, probe static /ok.txt immediately; hop to the campus
 *    Vercel host when the custom domain is unreachable (before React mounts).
 * 3. Hydration diagnostics: on React #418/#423/#425, snapshot the client text
 *    nodes, fetch the server HTML, and log which text differs. Detects Chrome
 *    auto-translate and extensions that rewrite text before React hydrates.
 */
export const SW_RECOVERY_SCRIPT = `(function(){
  var VER="2026-10-02-ok-probe";
  var KEY="utility-sw-bust";
  var DIAG_KEY="utility-hydration-diag";
  var CAMPUS="https://planner-flax-six.vercel.app";
  var HOP_KEY="uo-origin-hop";
  var PROBE="/ok.txt";
  var SKIP=/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/;
  var IGNORE={"Loading…":1};

  function isCanonicalHost(h){
    return h==="utilityos.tech"||h==="www.utilityos.tech";
  }

  function campusUrl(){
    var path=location.pathname||"/";
    if(path==="/~offline") path="/";
    return CAMPUS+path+(location.search||"")+(location.hash||"");
  }

  function requestCampusHop(){
    if(!isCanonicalHost(location.hostname)) return false;
    try{
      if(sessionStorage.getItem(HOP_KEY)==="1") return false;
      sessionStorage.setItem(HOP_KEY,"1");
    }catch(e){}
    location.replace(campusUrl());
    return true;
  }

  function documentCameFromNetwork(){
    try{
      var nav=performance.getEntriesByType("navigation")[0];
      if(!nav) return true;
      if(nav.transferSize===0&&nav.decodedBodySize>0) return false;
      return true;
    }catch(e){return true;}
  }

  function probeOrigin(){
    if(!isCanonicalHost(location.hostname)) return;
    if(!navigator.onLine) return;
    var controller=typeof AbortController!=="undefined"?new AbortController():null;
    var timedOut=false;
    var timer=setTimeout(function(){
      timedOut=true;
      if(controller) controller.abort();
    },1500);
    var opts={cache:"no-store"};
    if(controller) opts.signal=controller.signal;
    fetch(PROBE,opts).then(function(res){
      if(!res.ok) throw new Error("unreachable");
    }).catch(function(){
      if(controller&&controller.signal.aborted&&!timedOut) return;
      if(timedOut&&documentCameFromNetwork()) return;
      requestCampusHop();
    }).finally(function(){clearTimeout(timer);});
  }

  function texts(root){
    var out=[];
    if(!root) return out;
    var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    var n;
    while((n=w.nextNode())){
      var p=n.parentElement;
      if(!p||SKIP.test(p.tagName)) continue;
      var t=(n.textContent||"").replace(/\\s+/g," ").trim();
      if(t&&!IGNORE[t]) out.push(t);
    }
    return out;
  }
  function counts(arr){var m={};for(var i=0;i<arr.length;i++){m[arr[i]]=(m[arr[i]]||0)+1;}return m;}

  function clearAndReload(){
    var tasks=[];
    try{
      if("serviceWorker" in navigator){
        tasks.push(navigator.serviceWorker.getRegistrations().then(function(rs){
          return Promise.all(rs.map(function(r){return r.unregister();}));
        }));
      }
      if("caches" in window){
        tasks.push(caches.keys().then(function(ks){
          return Promise.all(ks.filter(function(k){
            return k!=="utility-pdf-v2" && k.indexOf("utility-pdf")!==0;
          }).map(function(k){return caches.delete(k);}));
        }));
      }
    }catch(e){}
    Promise.all(tasks).then(function(){location.reload();}).catch(function(){location.reload();});
  }

  function recoverOfflineShell(){
    if(!(navigator.onLine)) return false;
    var h1=document.querySelector("h1");
    if(!h1||(h1.textContent||"").trim().toLowerCase()!=="you're offline") return false;
    if(isCanonicalHost(location.hostname)){
      requestCampusHop();
      return true;
    }
    clearAndReload();
    return true;
  }

  var diagDone=false;
  window.addEventListener("error",function(e){
    var m=(e&&e.message)||"";
    if(!/React error #4(18|23|25)|Hydration failed|hydrat/i.test(m)) return;
    if(diagDone) return;
    diagDone=true;
    var clientTexts=texts(document.body);
    var html=document.documentElement;
    var translated=/translated-(ltr|rtl)/.test(html.className)||!!document.querySelector(".goog-te-banner-frame,#goog-gt-tt,.skiptranslate");
    if(recoverOfflineShell()) return;
    fetch(location.href,{cache:"no-store",credentials:"same-origin"}).then(function(r){return r.text();}).then(function(src){
      var doc=new DOMParser().parseFromString(src,"text/html");
      var s=counts(texts(doc.body)), c=counts(clientTexts);
      var onlyServer=Object.keys(s).filter(function(t){return !c[t];}).slice(0,20);
      var onlyClient=Object.keys(c).filter(function(t){return !s[t];}).slice(0,20);
      var diag={
        url:location.href,
        at:new Date().toISOString(),
        message:m,
        serverTextNotInClient:onlyServer,
        clientTextNotInServer:onlyClient,
        chromeTranslate:translated,
        htmlClass:html.className,
        lang:html.lang,
        swControlled:!!(navigator.serviceWorker&&navigator.serviceWorker.controller),
        ua:navigator.userAgent
      };
      try{localStorage.setItem(DIAG_KEY,JSON.stringify(diag));}catch(x){}
      console.warn("[utility] Hydration mismatch diagnostics (copy this JSON when reporting):\\n"+JSON.stringify(diag,null,1));
      if(translated){
        console.warn("[utility] Chrome auto-translate rewrote page text before React hydrated. Disable translation for this site to stop React #418.");
      }
    }).catch(function(){});
  });

  function run(){
    try{
      probeOrigin();
      if(localStorage.getItem(KEY)===VER){
        recoverOfflineShell();
        return;
      }
      localStorage.setItem(KEY,VER);
      if(!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.getRegistrations().then(function(rs){
        if(!rs.length && !navigator.serviceWorker.controller) return;
        clearAndReload();
      }).catch(function(){});
    }catch(e){}
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",run);
  }else{
    run();
  }
})();`;
