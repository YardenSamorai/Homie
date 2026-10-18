export const themeStorageKey = "homie_theme";

/** Runs inline before first paint so the stored appearance never flashes. */
export const themeScript = `try{var t=localStorage.getItem("${themeStorageKey}");if(t==="dark"||t==="system")document.documentElement.dataset.theme=t}catch(e){}`;
