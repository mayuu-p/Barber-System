import { supabase } from "./supabase.js";
const $=s=>document.querySelector(s);
let user=null, member=null, shop=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(t,type=""){const n=$("#notice");n.textContent=t;n.className="notice "+type;n.hidden=!t;}
async function load(){
 const {data:{session}}=await supabase.auth.getSession();user=session?.user||null;
 if(!user){$("#auth-panel").hidden=false;$("#join-panel").hidden=true;$("#staff-desk").hidden=true;return;}
 const {data,error}=await supabase.from("barber_members").select("id,shop_id,display_name,role").eq("user_id",user.id).limit(1).maybeSingle();if(error)throw error;
 if(!data){$("#auth-panel").hidden=true;$("#join-panel").hidden=false;$("#staff-desk").hidden=true;return;}
 member=data;const s=await supabase.from("barber_shops").select("id,name").eq("id",member.shop_id).single();if(s.error)throw s.error;shop=s.data;
 $("#auth-panel").hidden=true;$("#join-panel").hidden=true;$("#staff-desk").hidden=false;$("#staff-shop").textContent=shop.name;$("#staff-name").textContent=member.display_name;await bookings();if(window.staffChannel)await supabase.removeChannel(window.staffChannel);window.staffChannel=supabase.channel("staff-bookings-"+shop.id).on("postgres_changes",{event:"*",schema:"public",table:"barber_bookings",filter:"shop_id=eq."+shop.id},()=>bookings().catch(e=>notice(e.message,"error"))).subscribe();
}
async function bookings(){
 const {data,error}=await supabase.from("barber_bookings").select("id,customer_name,customer_phone,appointment_at,status,notes,barber_services(name,price)").eq("shop_id",shop.id).order("appointment_at",{ascending:true}).limit(100);if(error)throw error;
 $("#staff-bookings").innerHTML=(data||[]).map(b=>'<article class="staff-ticket"><div class="ticket-head"><span class="status">'+esc(b.status.replace("_"," "))+'</span><small>'+new Date(b.appointment_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})+'</small></div><h3>'+esc(b.customer_name)+'</h3><p>'+esc(b.customer_phone)+' · '+esc(b.barber_services?.name||"Service")+'</p><div class="ticket-actions"><button class="tiny-btn" data-status="'+b.id+'" data-next="confirmed">Confirm</button><button class="tiny-btn" data-status="'+b.id+'" data-next="in_progress">Start</button><button class="tiny-btn" data-status="'+b.id+'" data-next="completed">Complete</button><button class="tiny-btn danger" data-status="'+b.id+'" data-next="cancelled">Cancel</button></div></article>').join("")||'<p class="empty">No appointments yet.</p>';
 $("#staff-total").textContent=(data||[]).length;$("#staff-pending").textContent=(data||[]).filter(x=>x.status==="pending").length;
}
$("#auth-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const mode=f.get("mode");try{const r=mode==="signup"?await supabase.auth.signUp({email:f.get("email"),password:f.get("password")}):await supabase.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(r.error)throw r.error;if(mode==="signup"&&!r.data.session){notice("Confirm your email, then sign in.","success");return;}await load();}catch(err){notice(err.message,"error");}});
$("#join-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const {error}=await supabase.rpc("barber_join_shop",{p_join_code:f.get("code"),p_display_name:f.get("display_name")});if(error)throw error;await load();}catch(err){notice(err.message,"error");}});
$("#staff-bookings").addEventListener("click",async e=>{const b=e.target.closest("[data-status]");if(!b)return;try{const {error}=await supabase.from("barber_bookings").update({status:b.dataset.next}).eq("id",b.dataset.status);if(error)throw error;await bookings();notice("Appointment updated.","success");}catch(err){notice(err.message,"error");}});
$("#staff-refresh").addEventListener("click",()=>bookings().catch(e=>notice(e.message,"error")));
$("#staff-signout").addEventListener("click",async()=>{await supabase.auth.signOut();member=null;shop=null;await load();});
supabase.auth.onAuthStateChange(()=>setTimeout(()=>load().catch(e=>notice(e.message,"error")),0));
load().catch(e=>notice(e.message,"error"));