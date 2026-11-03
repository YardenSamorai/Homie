/** Appearance chosen on this device before looks moved into the account; read once, then cleared (src/lib/prefs-store.ts). */
export const themeStorageKey = "homie_theme";
export const textStorageKey = "homie_text";
export const tintStorageKey = "homie_tint";
export const boldStorageKey = "homie_bold";

/** The signed-in person's look as last drawn on this device: attributes, CSS variables, zoom and the photo link. */
export const lookCacheKey = "homie_look";

export const launchStorageKey = "homie_launch_day";

/**
 * Runs inline before first paint: the installed app opening on one of its screens gets the front-door
 * launch (LaunchDoor), the whole walk up on the first open of the day and only the door after that.
 * Someone who turned motion or the drawings off gets no door; gentle motion gets only the door.
 * `?launch=full` or `?launch=short` plays it anywhere, for checking it in a browser.
 */
export const launchScript = `try{var d=document.documentElement;var v=new URLSearchParams(location.search).get("launch");if(v!=="full"&&v!=="short"){v=null;var app=/HomieApp/.test(navigator.userAgent)||navigator.standalone===true||matchMedia("(display-mode: standalone)").matches;var off=d.dataset.motion==="none"||d.dataset.art==="0";if(app&&!off&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&/^\\/(he|en)(\\/(tasks|shopping|calendar|settings))?\\/?$/.test(location.pathname)){var day=new Date().toDateString();v=localStorage.getItem("${launchStorageKey}")===day||d.dataset.motion==="gentle"?"short":"full";localStorage.setItem("${launchStorageKey}",day)}}if(v)d.dataset.launch=v}catch(e){}`;

/**
 * Runs inline before first paint so the stored look never flashes. The cached look is drawn only for the person
 * signed in on this device; anyone else starts from the defaults until their own choices load. Also names the
 * screen (for a background that covers Today only) and the part of the day (for the sky).
 */
export const themeScript = `try{var d=document.documentElement;var p=location.pathname.replace(/^\\/(he|en)/,"");d.dataset.page=p===""||p==="/"?"today":(p.match(/^\\/(tasks|shopping|calendar|settings)/)||[0,"other"])[1];var h=new Date().getHours();d.dataset.period=h>=5&&h<12?"morning":h>=12&&h<17?"afternoon":h>=17&&h<22?"evening":"night";var uid=null;try{uid=JSON.parse(localStorage.getItem("homie-auth")).state.session.userId}catch(e){}var c=null;try{c=JSON.parse(localStorage.getItem("${lookCacheKey}"))}catch(e){}if(c&&uid&&c.uid===uid){for(var k in c.attrs)d.setAttribute("data-"+k,c.attrs[k]);for(var n in c.vars)d.style.setProperty(n,c.vars[n]);if(c.zoom&&c.zoom!==1)document.body.style.zoom=String(c.zoom);if(c.photo&&c.photo.until>Date.now())d.style.setProperty("--bg-photo",'url("'+c.photo.url+'")')}else if(!c||!uid){var t=localStorage.getItem("${themeStorageKey}");if(t==="dark"||t==="system")d.dataset.theme=t;var scales={"0":"0.9","1":"0.95","3":"1.08","4":"1.15"};var s=localStorage.getItem("${textStorageKey}");if(scales[s]){d.dataset.text=s;document.body.style.zoom=scales[s]}var u=localStorage.getItem("${tintStorageKey}");if(u==="coral"||u==="teal"||u==="indigo"||u==="plum")d.dataset.tint=u;if(localStorage.getItem("${boldStorageKey}")==="1")d.dataset.bold="1"}}catch(e){}`;
