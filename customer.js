import { supabase } from "./supabase.js";
const $=s=>document.querySelector(s);
const state={shops:[],shop:null,services:[]};
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
function msg(text,type=""){const el=$("#notice");el.textContent=text;el.className="notice "+type;el.hidden=!text;}
function localDate(d){return new Date(d).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});}
async function loadShops(){
 const {data,error}=await supabase.from("barber_shops").select("id,name,slug,phone,address").eq("is_active",true).order("name");
 if(error) throw error; state.shops=data||[];
 $("#shop-list").innerHTML=state.shops.length?state.shops.map(s=>`<button class="shop-choice" data-id="${s.id}"><span class="shop-symbol">✂</span><span><b>${esc(s.name)}</b><small>${esc(s.address||"Appointments available")}</small></span><strong>→</strong></button>`).join(""):'<p class="empty">No salons have opened online yet. Check back soon.</p>';
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function chooseShop(id){
 const shop=state.shops.find(s=>s.id===id); if(!shop)return;state.shop=shop;
 $("#selected-shop").textContent=shop.name;$("#shop-picker").hidden=true;$("#booking-panel").hidden=false;msg("");
 const {data,error}=await supabase.from("barber_services").select("id,name,description,duration_minutes,price").eq("shop_id",id).eq("is_available",true).order("name");
 if(error)throw error;state.services=data||[];
 $("#service").innerHTML=state.services.map(s=>`<option value="${s.id}">${esc(s.name)} · ${money(s.price)} · ${s.duration_minutes} min</option>`).join("");
 if(!state.services.length)msg("This salon has not added bookable services yet.");
}
$("#shop-list").addEventListener("click",e=>{const b=e.target.closest("[data-id]");if(b)chooseShop(b.dataset.id).catch(err=>msg(err.message,"error"));});
$("#back-shops").addEventListener("click",()=>{$("#booking-panel").hidden=true;$("#shop-picker").hidden=false;state.shop=null;msg("");});
$("#booking-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!state.shop)return;
 const btn=$("#book-submit");btn.disabled=true;btn.textContent="Confirming…";msg("");
 try{
  const form=new FormData(e.currentTarget);const when=new Date(form.get("appointment_at"));
  if(!Number.isFinite(when.getTime())||when<=new Date())throw new Error("Choose a future appointment time.");
  const payload={shop_id:state.shop.id,service_id:form.get("service_id"),customer_name:String(form.get("customer_name")).trim(),customer_phone:String(form.get("customer_phone")).trim(),appointment_at:when.toISOString(),notes:String(form.get("notes")||"").trim()||null,status:"pending"};
  const {error}=await supabase.from("barber_bookings").insert(payload);if(error)throw error;
  $("#booking-form").reset();msg("Request sent! Your appointment is pending salon confirmation. Please keep your phone available.","success");
 }catch(err){msg(err.message||"Could not place booking. Please try again.","error");}
 finally{btn.disabled=false;btn.textContent="Request appointment →";}
});
const min=new Date(Date.now()+10*60*1000);min.setMinutes(min.getMinutes()-min.getTimezoneOffset());$("#appointment-at").min=min.toISOString().slice(0,16);
loadShops().catch(e=>msg(e.message,"error"));