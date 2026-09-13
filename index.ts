import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}');
const db=createClient(Deno.env.get('SUPABASE_URL')!,keys.default??'');
const providerUrl=Deno.env.get('TOPUP_PROVIDER_URL')??'';
const providerKey=Deno.env.get('TOPUP_PROVIDER_KEY')??'';

Deno.serve(async req=>{
  if(req.method!=='POST')return new Response('Method Not Allowed',{status:405});
  try{
    const {order_id}=await req.json();
    if(!order_id)return Response.json({error:'order_id required'},{status:400});
    const {data:o,error:oe}=await db.from('orders').select('*').eq('id',order_id).maybeSingle();
    if(oe||!o)return Response.json({error:'Order not found'},{status:404});
    if(o.payment_status!=='paid')return Response.json({error:'Order is not paid'},{status:409});
    if(!providerUrl||!providerKey)return Response.json({error:'Provider not configured',mode:'manual'},{status:503});
    const r=await fetch(providerUrl,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${providerKey}`},body:JSON.stringify({order_id:o.id,player_id:o.player_id,server_id:o.server_id,product_id:o.product_id})});
    const text=await r.text();
    if(!r.ok)return Response.json({error:'Provider request failed',provider_status:r.status,provider_response:text},{status:502});
    return Response.json({ok:true,provider_response:text});
  }catch(e){return Response.json({error:String(e)},{status:400});}
});
