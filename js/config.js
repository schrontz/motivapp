// Öffentliche Verbindungsdaten. Beide Werte dürfen im Frontend stehen –
// die Daten schützt Supabase per Login und Row Level Security.
// NIEMALS hier den service_role-Key eintragen.
export const SUPABASE_URL = 'https://msjvorshfezbcsomsvmj.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_lz1mNSlqqLuUvOhW77VGaw_j2xbbWyp';
// Withings: Client ID ist öffentlich (steht auch in der Login-Adresse). Das Secret liegt NUR in Supabase.
export const WITHINGS_CLIENT_ID = '';
export const WITHINGS_REDIRECT = 'https://schrontz.github.io/motivapp/';
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
