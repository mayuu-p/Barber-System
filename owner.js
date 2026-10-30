import { supabase } from "./supabase.js";
const $=s=>document.querySelector(s);let user=null,shop=null,channel=null;
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(t,type=""){const n=$("#notice");n.textContent=t;n.className="notice "+type;n.hidden=!t;}
function authPanel(){ $("#auth-panel").hidden=false;$("#setup-panel").hidden=true;$("#dashboard").hidden=true;}
function setupPanel(){ $("#auth-panel").hidden=true;$("#setup-panel").hidden=false;$("#dashboard").hidden=true;}
function dashboard(){ $("#auth-panel").hidden=true;$("#setup-panel").hidden=true;$("#dashboard").hidden=false; }
async function load(){
 const {data:{session}}=await supabase.auth.getSession();user=session?.user||null;
 if(!user){authPanel();return;}
 const {data,error}=await supabase.from("barber_shops").select("id,name,slug,phone,address,join_code").eq("owner_id",user.id).limit(1).maybeSingle();
 if(error)throw error;
 if(!data){setupPanel();return;}shop=data;dashboard();$("#shop-name").textContent=shop.name;$("#join-code").textContent=shop.join_code;await refresh();if(channel)await supabase.removeChannel(channel);channel=supabase.channel("owner-bookings-"+shop.id).on("postgres_changes",{event:"*",schema:"public",table:"barber_bookings",filter:"shop_id=eq."+shop.id},()=>loadBookings().catch(e=>notice(e.message,"error"))).subscribe();
}
async function refresh(){
 if(!shop)return;
 await Promise.all([loadServices(),loadBookings(),loadMembers()]);
}
async function loadServices(){
 const {data,error}=await supabase.from("barber_services").select("*").eq("shop_id",shop.id).order("created_at",{ascending:false});if(error)throw error;
 $("#services-list").innerHTML=(data||[]).map(s=>`<div class="data-row"><div><b>${esc(s.name)}</b><small>${s.duration_minutes} min · ${money(s.price)}</small></div><span class="status ${s.is_available?"good":"muted-status"}">${s.is_available?"Available":"Hidden"}</span><button class="tiny-btn" data-toggle-service="${s.id}" data-next="${!s.is_available}">${s.is_available?"Hide":"Show"}</button><button class="tiny-btn danger" data-delete-service="${s.id}">Delete</button></div>`).join("")||'<p class="empty">No services yet. Add your first service.</p>';
}
async function loadBookings(){
 const {data,error}=await supabase.from("barber_bookings").select("id,customer_name,customer_phone,appointment_at,status,notes,barber_services(name,price)").eq("shop_id",shop.id).order("appointment_at",{ascending:true}).limit(100);if(error)throw error;
 $("#bookings-list").innerHTML=(data||[]).map(b=>`<div class="booking-row"><div class="booking-main"><b>${esc(b.customer_name)}</b><small>${esc(b.customer_phone)} · ${esc(b.barber_services?.name||"Service")}</small><small>${new Date(b.appointment_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</small></div><span class="status">${esc(b.status.replace("_"," "))}</span><select aria-label="Update booking status" data-booking-status="${b.id}"><option value="">Update</option>${["pending","confirmed","in_progress","completed","cancelled","no_show"].map(x=>`<option value="${x}" ${b.status===x?"selected":""}>${x.replace("_"," ")}</option>`).join("")}</select></div>`).join("")||'<p class="empty">No appointments yet. New bookings will appear here.</p>';
 $("#booking-count").textContent=(data||[]).length;$("#pending-count").textContent=(data||[]).filter(x=>x.status==="pending").length;
}
async function loadMembers(){
 const {data,error}=await supabase.from("barber_members").select("id,display_name,role,is_active").eq("shop_id",shop.id).order("created_at");if(error)throw error;
 $("#members-list").innerHTML=(data||[]).map(m=>`<div class="data-row"><div><b>${esc(m.display_name)}</b><small>${esc(m.role)}</small></div><span class="status ${m.is_active?"good":"muted-status"}">${m.is_active?"Active":"Inactive"}</span></div>`).join("")||'<p class="empty">No team members yet.</p>';
}
$("#auth-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const mode=f.get("mode");const btn=$("#auth-submit");btn.disabled=true;
 try{let r=mode==="signup"?await supabase.auth.signUp({email:f.get("email"),password:f.get("password"),options:{data:{full_name:f.get("full_name")}}}):await supabase.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(r.error)throw r.error;if(mode==="signup"&&!r.data.session){notice("Check your email to confirm your account, then sign in.","success");return;}user=r.data.user;await load();}catch(err){notice(err.message,"error");}finally{btn.disabled=false;}
});
$("#mode-toggle").addEventListener("click",()=>{const signup=$("#auth-form").dataset.mode!=="signup";$("#auth-form").dataset.mode=signup?"signup":"login";$("#auth-form [name=mode]").value=signup?"signup":"login";$("#name-field").hidden=!signup;$("#auth-submit").textContent=signup?"Create account":"Sign in";$("#mode-toggle").textContent=signup?"Already registered? Sign in":"New here? Create an owner account";});
$("#shop-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get("name")).trim();const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+Math.random().toString(36).slice(2,6);try{const {data,error}=await supabase.from("barber_shops").insert({owner_id:user.id,name,slug,phone:f.get("phone")||null,address:f.get("address")||null}).select("id,name,slug,phone,address,join_code").single();if(error)throw error;const m=await supabase.from("barber_members").insert({shop_id:data.id,user_id:user.id,display_name:String(f.get("owner_name")||"Owner"),role:"owner"});if(m.error)throw m.error;shop=data;await load();notice("Your shop workspace is ready.","success");}catch(err){notice(err.message,"error");}});
$("#service-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const {error}=await supabase.from("barber_services").insert({shop_id:shop.id,name:f.get("name"),description:f.get("description")||null,duration_minutes:Number(f.get("duration")),price:Number(f.get("price"))});if(error)throw error;e.currentTarget.reset();await loadServices();notice("Service added.","success");}catch(err){notice(err.message,"error");}});
$("#services-list").addEventListener("click",async e=>{const t=e.target.closest("[data-toggle-service]"),d=e.target.closest("[data-delete-service]");try{if(t){const {error}=await supabase.from("barber_services").update({is_available:t.dataset.next==="true"}).eq("id",t.dataset.toggleService);if(error)throw error;}if(d){if(!confirm("Delete this service? Existing bookings may prevent deletion."))return;const {error}=await supabase.from("barber_services").delete().eq("id",d.dataset.deleteService);if(error)throw error;}await loadServices();}catch(err){notice(err.message,"error");}});
$("#bookings-list").addEventListener("change",async e=>{const el=e.target.closest("[data-booking-status]");if(!el||!el.value)return;try{const {error}=await supabase.from("barber_bookings").update({status:el.value}).eq("id",el.dataset.bookingStatus);if(error)throw error;await loadBookings();}catch(err){notice(err.message,"error");}});
$("#copy-code").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(shop.join_code);notice("Staff invite code copied.","success");}catch{notice("Invite code: "+shop.join_code);}});
$("#refresh").addEventListener("click",()=>refresh().then(()=>notice("Dashboard refreshed.","success")).catch(e=>notice(e.message,"error")));
$("#signout").addEventListener("click",async()=>{await supabase.auth.signOut();user=null;shop=null;authPanel();});
supabase.auth.onAuthStateChange(()=>{setTimeout(()=>load().catch(e=>notice(e.message,"error")),0);});
load().catch(e=>notice(e.message,"error"));