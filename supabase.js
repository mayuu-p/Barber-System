import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
export const supabase = createClient(
  "https://ewvirpfovwruxshzzlaa.supabase.co",
  "sb_publishable_Uc0KqgR1D4orcedVlswdRw_HYq1IZJk",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);