export const themeStorageKey = "homie_theme";
export const textStorageKey = "homie_text";
export const tintStorageKey = "homie_tint";
export const boldStorageKey = "homie_bold";

export const launchStorageKey = "homie_launch_day";

/**
 * Runs inline before first paint: the installed app opening on one of its screens gets the front-door
 * launch (LaunchDoor), the whole walk up on the first open of the day and only the door after that.
 * `?launch=full` or `?launch=short` plays it anywhere, for checking it in a browser.
 */
export const launchScript = `try{var d=document.documentElement;var v=new URLSearchParams(location.search).get("launch");if(v!=="full"&&v!=="short"){v=null;var app=/HomieApp/.test(navigator.userAgent)||navigator.standalone===true||matchMedia("(display-mode: standalone)").matches;if(app&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&/^\\/(he|en)(\\/(tasks|shopping|calendar|settings))?\\/?$/.test(location.pathname)){var day=new Date().toDateString();v=localStorage.getItem("${launchStorageKey}")===day?"short":"full";localStorage.setItem("${launchStorageKey}",day)}}if(v)d.dataset.launch=v}catch(e){}`;

/** Runs inline before first paint so the stored appearance never flashes. */
export const themeScript = `try{var d=document.documentElement;var t=localStorage.getItem("${themeStorageKey}");if(t==="dark"||t==="system")d.dataset.theme=t;var scales={"0":"0.9","1":"0.95","3":"1.08","4":"1.15"};var s=localStorage.getItem("${textStorageKey}");if(scales[s]){d.dataset.text=s;document.body.style.zoom=scales[s]}var c=localStorage.getItem("${tintStorageKey}");if(c==="coral"||c==="teal"||c==="indigo"||c==="plum")d.dataset.tint=c;if(localStorage.getItem("${boldStorageKey}")==="1")d.dataset.bold="1"}catch(e){}`;
