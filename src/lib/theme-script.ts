export const themeStorageKey = "homie_theme";
export const textStorageKey = "homie_text";
export const tintStorageKey = "homie_tint";
export const boldStorageKey = "homie_bold";

/** Runs inline before first paint so the stored appearance never flashes. */
export const themeScript = `try{var d=document.documentElement;var t=localStorage.getItem("${themeStorageKey}");if(t==="dark"||t==="system")d.dataset.theme=t;var scales={"0":"0.9","1":"0.95","3":"1.08","4":"1.15"};var s=localStorage.getItem("${textStorageKey}");if(scales[s]){d.dataset.text=s;document.body.style.zoom=scales[s]}var c=localStorage.getItem("${tintStorageKey}");if(c==="coral"||c==="teal"||c==="indigo"||c==="plum")d.dataset.tint=c;if(localStorage.getItem("${boldStorageKey}")==="1")d.dataset.bold="1"}catch(e){}`;
