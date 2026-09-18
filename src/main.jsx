import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './style.css';

const supabase=createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const money=n=>`৳${Number(n||0).toLocaleString('en-BD')}`;


function Auth({onDone}){

 const [mode,setMode]=useState('login');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [oauthBusy,setOauthBusy]=useState('');
 const [msg,setMsg]=useState('');

 async function submit(e){

  e.preventDefault();

  setBusy(true);
  setMsg('');

  const r=mode==='login'
   ?await supabase.auth.signInWithPassword({
      email,
      password
    })
   :await supabase.auth.signUp({
      email,
      password
    });

  setBusy(false);

  if(r.error){
   return setMsg(r.error.message);
  }

  if(mode==='signup'&&!r.data.session){

   return setMsg(
    'Account created. Check your email if confirmation is enabled.'
   );

  }

  onDone?.();

 }


 async function socialLogin(provider){

  setOauthBusy(provider);
  setMsg('');

  const {error}=await supabase.auth.signInWithOAuth({

   provider,

   options:{
    redirectTo:window.location.origin
   }

  });

  if(error){

   setOauthBusy('');
   setMsg(error.message);

  }

 }


 return <div className="auth">

  <div className="brand">
   🎮 <b>Game Top-Up BD</b>
  </div>

  <div className="card auth-card">

   <h1>
    {mode==='login'
     ?'Welcome back'
     :'Create account'}
   </h1>

   <form onSubmit={submit}>

    <input
     required
     type="email"
     placeholder="Email"
     value={email}
     onChange={e=>setEmail(e.target.value)}
    />

    <input
     required
     type="password"
     minLength="6"
     placeholder="Password"
     value={password}
     onChange={e=>setPassword(e.target.value)}
    />

    <button disabled={busy||!!oauthBusy}>

     {busy
      ?'Please wait…'
      :mode==='login'
       ?'Login'
       :'Sign up'}

    </button>

   </form>


   <div className="oauth-divider">
    <span>or continue with</span>
   </div>


   <div className="social-buttons">

    <button
     type="button"
     className="social google"
     disabled={busy||!!oauthBusy}
     onClick={()=>socialLogin('google')}
    >

     <span className="social-icon">
      G
     </span>

     {oauthBusy==='google'
      ?'Connecting…'
      :'Continue with Google'}

    </button>


    <button
     type="button"
     className="social facebook"
     disabled={busy||!!oauthBusy}
     onClick={()=>socialLogin('facebook')}
    >

     <span className="social-icon">
      f
     </span>

     {oauthBusy==='facebook'
      ?'Connecting…'
      :'Continue with Facebook'}

    </button>

   </div>


   {msg&&
    <p className="notice">
     {msg}
    </p>
   }


   <button
    type="button"
    className="link"
    onClick={()=>
     setMode(
      mode==='login'
       ?'signup'
       :'login'
     )
    }
   >

    {mode==='login'
     ?'Need an account? Sign up'
     :'Already have an account? Login'}

   </button>

  </div>

 </div>;
}



function App(){

 const [session,setSession]=useState(null);
 const [profile,setProfile]=useState(null);
 const [games,setGames]=useState([]);
 const [products,setProducts]=useState([]);
 const [orders,setOrders]=useState([]);

 const [gameId,setGameId]=useState('');
 const [productId,setProductId]=useState('');
 const [playerId,setPlayerId]=useState('');
 const [serverId,setServerId]=useState('');

 const [tab,setTab]=useState('shop');
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 const [gateway,setGateway]=useState('bkash');


 useEffect(()=>{

  supabase.auth.getSession()
   .then(({data})=>{
    setSession(data.session);
   });


  const {data:l}=
   supabase.auth.onAuthStateChange(
    (_event,s)=>{
     setSession(s);
    }
   );


  return()=>{
   l.subscription.unsubscribe();
  };

 },[]);


 useEffect(()=>{

  if(session){
   load();
  }

 },[session]);


 async function load(){

  const [
   {data:p},
   {data:g},
   {data:pr},
   {data:o}
  ]=await Promise.all([

   supabase
    .from('profiles')
    .select('*')
    .eq('id',session.user.id)
    .maybeSingle(),

   supabase
    .from('games')
    .select('*')
    .eq('status','active')
    .order('sort_order'),

   supabase
    .from('game_products')
    .select('*')
    .eq('status','active')
    .order('sort_order'),

   supabase
    .from('orders')
    .select('*')
    .eq('user_id',session.user.id)
    .eq('payment_status','paid')
    .order('created_at',{
     ascending:false
    })
    .limit(50)

  ]);


  setProfile(p);
  setGames(g||[]);
  setProducts(pr||[]);

  // Customer only sees successfully paid orders.
  setOrders(
   (o||[]).filter(
    order=>order.payment_status==='paid'
   )
  );


  if(!gameId&&g?.[0]){
   setGameId(g[0].id);
  }

 }


 const filtered=useMemo(
  ()=>products.filter(
   p=>!gameId||p.game_id===gameId
  ),
  [products,gameId]
 );


 useEffect(()=>{

  if(
   filtered.length &&
   !filtered.some(p=>p.id===productId)
  ){
   setProductId(filtered[0].id);
  }

 },[gameId,filtered]);


 const selected=
  products.find(
   p=>p.id===productId
  );


 async function placeOrder(e){

  e.preventDefault();

  if(!session){
   return;
  }


  setBusy(true);
  setMsg('');


  const {
   data:order,
   error
  }=await supabase
   .from('orders')
   .insert({
    user_id:session.user.id,
    product_id:productId,
    player_id:playerId.trim(),
    server_id:serverId.trim()||null
   })
   .select('id')
   .single();


  if(error){

   setBusy(false);

   return setMsg(
    error.message
   );

  }


  const {
   data:pay,
   error:payErr
  }=await supabase.functions.invoke(
   'payment-init',
   {
    body:{
     order_id:order.id,
     gateway
    }
   }
  );


  setBusy(false);


  if(payErr){

   setMsg(
    payErr.message||
    'Payment initialization failed'
   );

   await load();

   setTab('shop');

   return;

  }


  if(pay?.payment_url){

   window.location.href=
    pay.payment_url;

   return;

  }


  setMsg(
   pay?.error||
   'Payment gateway is not configured yet.'
  );


  setPlayerId('');
  setServerId('');

  await load();

  setTab('shop');

 }


 async function logout(){

  await supabase.auth.signOut();

 }


 if(!session){

  return <Auth
   onDone={()=>
    supabase.auth.getSession()
     .then(({data})=>
      setSession(data.session)
     )
   }
  />;

 }


 const admin=
  profile?.role==='admin' &&
  profile?.status==='active';


 return <div className="app">


  <header>

   <div className="brand">
    🎮 <b>Game Top-Up BD</b>
   </div>


   <div className="head-actions">

    <span>
     {session.user.email}
    </span>


    {admin&&

     <button
      className="small"
      onClick={()=>
       setTab(
        tab==='admin'
         ?'shop'
         :'admin'
       )
      }
     >

      {tab==='admin'
       ?'Shop'
       :'Admin'}

     </button>

    }


    <button
     className="small ghost"
     onClick={logout}
    >
     Logout
    </button>

   </div>

  </header>



  {tab==='admin'&&admin

   ?<Admin
     onBack={()=>
      setTab('shop')
     }
    />

   :<>


    <nav className="tabs">

     <button
      className={
       tab==='shop'
        ?'active'
        :''
      }
      onClick={()=>
       setTab('shop')
      }
     >
      Top Up
     </button>


     <button
      className={
       tab==='orders'
        ?'active'
        :''
      }
      onClick={()=>
       setTab('orders')
      }
     >
      My Orders
     </button>

    </nav>



    {tab==='shop'

     ?<main className="grid">


       <section>

        <div className="hero">

         <h1>
          Fast Game Top-Up
         </h1>

         <p>
          Choose a game, package
          and enter your player ID.
         </p>

        </div>



        <div className="game-row">

         {games.map(g=>

          <button
           key={g.id}
           className={
            gameId===g.id
             ?'game active'
             :'game'
           }
           onClick={()=>
            setGameId(g.id)
           }
          >

           {g.logo_url

            ?<img
              src={g.logo_url}
              alt={g.name}
             />

            :<span>🎮</span>

           }


           <b>
            {g.name}
           </b>

          </button>

         )}

        </div>



        <div className="packages">

         {filtered.map(p=>

          <button
           key={p.id}
           className={
            productId===p.id
             ?'package selected'
             :'package'
           }
           onClick={()=>
            setProductId(p.id)
           }
          >

           <span>
            {p.name}
           </span>

           <strong>
            {money(p.selling_price)}
           </strong>

          </button>

         )}

        </div>

       </section>



       <aside className="card checkout">

        <h2>
         Checkout
        </h2>


        {selected

         ?<>


          <div className="summary">

           <b>
            {selected.name}
           </b>

           <strong>
            {money(
             selected.selling_price
            )}
           </strong>

          </div>



          <form onSubmit={placeOrder}>


           <label>

            Player ID

            <input
             required
             value={playerId}
             onChange={e=>
              setPlayerId(e.target.value)
             }
             placeholder="Enter Player ID"
            />

           </label>



           <label>

            Server / Zone ID

            <small>
             {' '}(optional)
            </small>

            <input
             value={serverId}
             onChange={e=>
              setServerId(e.target.value)
             }
             placeholder="If required by game"
            />

           </label>



           <label>

            Payment method

            <select
             value={gateway}
             onChange={e=>
              setGateway(e.target.value)
             }
            >

             <option value="bkash">
              bKash
             </option>

             <option value="nagad">
              Nagad
             </option>

            </select>

           </label>



           <button disabled={busy}>

            {busy
             ?'Starting payment…'
             :'Create & Pay'}

           </button>


          </form>



          <div className="paybox">

           <b>
            Secure payment
           </b>

           <p>
            After successful payment,
            your order will appear in
            My Orders as pending while
            the top-up is being delivered.
            Once the diamonds reach your
            Player ID, it will show
            Success.
           </p>

          </div>

         </>

         :<p>
          Select a package.
         </p>

        }



        {msg&&
         <div className="notice">
          {msg}
         </div>
        }

       </aside>

      </main>


     :<Orders orders={orders}/>

    }

   </>

  }

 </div>;
}



function Orders({orders}){

 return <main className="content">

  <h1>
   My Orders
  </h1>


  {!orders.length

   ?<div className="card empty">

     No paid orders yet.

    </div>


   :<div className="order-list">

    {orders.map(o=>{

     const success=
      o.fulfillment_status==='completed';


     return <div
      className="card order"
      key={o.id}
     >


      <div>

       <b>
        Order #{o.id.slice(0,8)}
       </b>


       <p>
        Player: {o.player_id}
       </p>


       <small>
        {new Date(
         o.created_at
        ).toLocaleString()}
       </small>

      </div>



      <div className="right">


       <strong>
        {money(o.total)}
       </strong>



       <span className="pill">
        Payment: Paid
       </span>



       <span className="pill">

        {success

         ?'Success ✅'

         :'Top-up pending ⏳'

        }

       </span>


      </div>


     </div>;

    })}

   </div>

  }

 </main>;
}



function Admin({onBack}){

 const [orders,setOrders]=useState([]);
 const [games,setGames]=useState([]);
 const [products,setProducts]=useState([]);

 const [tab,setTab]=useState('orders');
 const [msg,setMsg]=useState('');


 async function load(){

  const [
   {data:o,error:oe},
   {data:g},
   {data:p}
  ]=await Promise.all([

   supabase
    .from('orders')
    .select('*')
    .order('created_at',{
     ascending:false
    })
    .limit(100),

   supabase
    .from('games')
    .select('*')
    .order('sort_order'),

   supabase
    .from('game_products')
    .select('*')
    .order('sort_order')

  ]);


  if(oe){
   setMsg(oe.message);
  }


  setOrders(o||[]);
  setGames(g||[]);
  setProducts(p||[]);

 }


 useEffect(()=>{

  load();

 },[]);


 async function update(
  id,
  field,
  value
 ){

  setMsg('');


  const {error}=
   await supabase
    .from('orders')
    .update({
     [field]:value
    })
    .eq('id',id);


  if(error){

   setMsg(error.message);

  }else{

   load();

  }

 }


 return <main className="admin">


  <div className="admin-head">


   <div>

    <button
     className="link"
     onClick={onBack}
    >
     ← Shop
    </button>


    <h1>
     Admin Dashboard
    </h1>

   </div>



   <div className="stats">

    <span>
     {orders.length} orders
    </span>

    <span>
     {games.length} games
    </span>

    <span>
     {products.length} products
    </span>

   </div>


  </div>



  <nav className="tabs">


   <button
    className={
     tab==='orders'
      ?'active'
      :''
    }
    onClick={()=>
     setTab('orders')
    }
   >
    Orders
   </button>



   <button
    className={
     tab==='games'
      ?'active'
      :''
    }
    onClick={()=>
     setTab('games')
    }
   >
    Games
   </button>



   <button
    className={
     tab==='products'
      ?'active'
      :''
    }
    onClick={()=>
     setTab('products')
    }
   >
    Products
   </button>


  </nav>



  {msg&&
   <div className="notice">
    {msg}
   </div>
  }



  {tab==='orders'&&

   <div className="table-wrap">

    <table>

     <thead>

      <tr>

       <th>
        Order
       </th>

       <th>
        Player
       </th>

       <th>
        Total
       </th>

       <th>
        Payment
       </th>

       <th>
        Fulfillment
       </th>

       <th>
        Action
       </th>

      </tr>

     </thead>



     <tbody>

      {orders.map(o=>

       <tr key={o.id}>


        <td>
         {o.id.slice(0,8)}
        </td>


        <td>
         {o.player_id}
        </td>


        <td>
         {money(o.total)}
        </td>


        <td>
         {o.payment_status}
        </td>


        <td>
         {o.fulfillment_status}
        </td>


        <td>

         <select
          value={o.fulfillment_status}
          onChange={e=>
           update(
            o.id,
            'fulfillment_status',
            e.target.value
           )
          }
         >

          <option>
           pending
          </option>

          <option>
           processing
          </option>

          <option>
           completed
          </option>

          <option>
           failed
          </option>

          <option>
           cancelled
          </option>

         </select>

        </td>


       </tr>

      )}

     </tbody>

    </table>

   </div>

  }



  {tab==='games'&&

   <div className="cards">

    {games.map(g=>

     <div
      className="card"
      key={g.id}
     >

      <b>
       {g.name}
      </b>

      <p>
       Status: {g.status}
      </p>

     </div>

    )}

   </div>

  }



  {tab==='products'&&

   <div className="cards">

    {products.map(p=>

     <div
      className="card"
      key={p.id}
     >

      <b>
       {p.name}
      </b>

      <p>
       Cost: {money(p.cost_price)}
       {' · '}
       Sale: {money(p.selling_price)}
      </p>

     </div>

    )}

   </div>

  }


 </main>;
}



createRoot(
 document.getElementById('root')
).render(
 <App/>
);
