// Öffentliche Verbindungsdaten. Beide Werte dürfen im Frontend stehen –
// die Daten schützt Supabase per Login und Row Level Security.
// NIEMALS hier den service_role-Key eintragen.
// Bei jedem Update hochzählen – steht unten im Profil, damit man sieht, welcher Stand läuft
export const APP_VERSION = '2026-10-16.3';

export const SUPABASE_URL = 'https://msjvorshfezbcsomsvmj.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_lz1mNSlqqLuUvOhW77VGaw_j2xbbWyp';
// Withings: Client ID ist öffentlich (steht auch in der Login-Adresse). Das Secret liegt NUR in Supabase.
export const WITHINGS_CLIENT_ID = '971f9bba482fe3b307b56cd7ce1587c02f6e958ed6db212b388635da01581953';
export const WITHINGS_REDIRECT = 'https://schrontz.github.io/motivapp/';
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
