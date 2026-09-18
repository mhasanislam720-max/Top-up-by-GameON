import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://bvqlobmpzufxjtxaoxad.supabase.co";

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_0cB3qllVtXYPnvV1XllTjA_kQq4INYG";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const money = (value) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortCode = (value) => {
  const text = String(value || "");
  return text.length > 12 ? `${text.slice(0, 8)}…` : text;
};

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [walletTx, setWalletTx] = useState([]);

  const [tab, setTab] = useState("shop");

  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [playerId, setPlayerId] = useState("");
  const [serverId, setServerId] = useState("");
  const [gateway, setGateway] = useState("bkash");

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
  });

  const [message, setMessage] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const admin = profile?.role === "admin";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession || null);

      if (!currentSession) {
        setProfile(null);
        setOrders([]);
        setWallet({ balance: 0 });
        setWalletTx([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      load();
    }
  }, [session?.user?.id]);

  async function load() {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    const [
      profileResult,
      gamesResult,
      productsResult,
      ordersResult,
      walletResult,
      transactionsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(),

      supabase
        .from("games")
        .select("*")
        .eq("status", "active")
        .order("sort_order"),

      supabase
        .from("game_products")
        .select("*")
        .order("sort_order"),

      supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle(),

      supabase
        .from("wallet_transactions")
        .select(
          "id,type,amount,description,status,created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    setProfile(profileResult.data);

    setProfileForm({
      full_name: profileResult.data?.full_name || "",
      phone: profileResult.data?.phone || "",
    });

    setGames(gamesResult.data || []);
    setProducts(productsResult.data || []);
    setOrders(ordersResult.data || []);
    setWallet(walletResult.data || { balance: 0 });
    setWalletTx(transactionsResult.data || []);
  }

  async function login(event) {
    event.preventDefault();

    setMessage("");
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTab("shop");
  }

  async function signup(event) {
    event.preventDefault();

    setMessage("");
    setBusy(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Account created. Check your email if confirmation is enabled."
    );

    setMode("login");
  }

  async function oauth(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profileForm.full_name.trim() || null,
        phone: profileForm.phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    setProfileMsg(
      error ? error.message : "Profile saved successfully."
    );

    if (!error) {
      await load();
    }
  }

  async function signout() {
    await supabase.auth.signOut();
    setTab("shop");
  }

  const currentProducts = useMemo(() => {
    if (!selectedGame) return [];

    return products.filter(
      (product) => product.game_id === selectedGame.id
    );
  }, [products, selectedGame]);

  function chooseGame(game) {
    setSelectedGame(game);
    setSelectedProduct(null);
    setPlayerId("");
    setServerId("");
    setMessage("");
  }

  function chooseProduct(product) {
    setSelectedProduct(product);
    setMessage("");
  }

  async function placeOrder(event) {
    event.preventDefault();

    setMessage("");

    if (!selectedGame) {
      setMessage("Select a game.");
      return;
    }

    if (!selectedProduct) {
      setMessage("Select a package.");
      return;
    }

    if (!playerId.trim()) {
      setMessage("Enter Player ID.");
      return;
    }

    if (
      selectedGame.slug === "pubg-mobile" &&
      !serverId.trim()
    ) {
      setMessage("Enter Server ID.");
      return;
    }

    setBusy(true);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: session.user.id,
        game_id: selectedGame.id,
        product_id: selectedProduct.id,
        player_id: playerId.trim(),
        server_id: serverId.trim() || null,
        amount: selectedProduct.amount,
        total: selectedProduct.selling_price,
        payment_status: "pending",
        fulfillment_status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    if (gateway === "wallet") {
      const { error: walletError } =
        await supabase.rpc("pay_order_with_wallet", {
          p_order_id: order.id,
        });

      setBusy(false);

      if (walletError) {
        setMessage(walletError.message);
        await load();
        return;
      }

      setPlayerId("");
      setServerId("");
      setSelectedProduct(null);

      await load();

      setTab("orders");

      setMessage(
        "Wallet payment successful. Top-up pending."
      );

      return;
    }

    const { data: payment, error: paymentError } =
      await supabase.functions.invoke("payment-init", {
        body: {
          order_id: order.id,
          gateway,
        },
      });

    setBusy(false);

    if (paymentError) {
      setMessage(
        paymentError.message ||
          "Payment initialization failed."
      );

      await load();
      return;
    }

    if (payment?.payment_url) {
      window.location.href = payment.payment_url;
      return;
    }

    setMessage(
      payment?.error ||
        "Payment gateway is not configured yet."
    );

    await load();
  }

  if (!session) {
    return (
      <Auth
        mode={mode}
        setMode={setMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        name={name}
        setName={setName}
        onLogin={login}
        onSignup={signup}
        onOAuth={oauth}
        busy={busy}
        message={message}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div
          className="brand"
          onClick={() => setTab("shop")}
        >
          <div className="brand-logo">G</div>

          <div>
            <strong>GameON</strong>
            <span>Game Top-Up BD</span>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="small"
            onClick={() => setTab("profile")}
          >
            Profile
          </button>

          <button
            className="small"
            onClick={() => setTab("wallet")}
          >
            Wallet {money(wallet.balance)}
          </button>

          {admin && (
            <button
              className="small"
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
          )}

          <button
            className="small"
            onClick={signout}
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tab === "shop" ? "active" : ""}
          onClick={() => setTab("shop")}
        >
          Shop
        </button>

        <button
          className={tab === "orders" ? "active" : ""}
          onClick={() => setTab("orders")}
        >
          My Orders
        </button>

        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => setTab("profile")}
        >
          Profile
        </button>

        <button
          className={tab === "wallet" ? "active" : ""}
          onClick={() => setTab("wallet")}
        >
          Wallet
        </button>
      </nav>

      {message && (
        <div className="notice global-notice">
          {message}
        </div>
      )}

      {tab === "shop" && (
        <main className="content">
          <section className="hero">
            <div>
              <p className="eyebrow">
                FAST • SECURE • BD
              </p>

              <h1>GameON Top-Up</h1>

              <p>
                Buy Free Fire Diamonds and PUBG Mobile UC
                quickly.
              </p>
            </div>
          </section>

          <section className="card">
            <h2>Select Game</h2>

            <div className="game-grid">
              {games.map((game) => (
                <button
                  key={game.id}
                  className={
                    selectedGame?.id === game.id
                      ? "game-card selected"
                      : "game-card"
                  }
                  onClick={() => chooseGame(game)}
                >
                  <strong>{game.name}</strong>
                  <small>{game.slug}</small>
                </button>
              ))}
            </div>
          </section>

          {selectedGame && (
            <section className="card">
              <h2>{selectedGame.name}</h2>

              <div className="product-grid">
                {currentProducts.map((product) => (
                  <button
                    key={product.id}
                    className={
                      selectedProduct?.id === product.id
                        ? "product-card selected"
                        : "product-card"
                    }
                    onClick={() =>
                      chooseProduct(product)
                    }
                  >
                    <span className="package-name">
                      <b>{product.name}</b>
                      <small>{product.sku}</small>
                    </span>

                    <strong>
                      {money(product.selling_price)}
                    </strong>
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedGame && selectedProduct && (
            <form
              className="card checkout"
              onSubmit={placeOrder}
            >
              <div className="section-title">
                <div>
                  <h2>
                    Buy {selectedProduct.name}
                  </h2>

                  <p className="muted">
                    Package code:{" "}
                    {selectedProduct.sku}
                  </p>
                </div>

                <strong>
                  {money(
                    selectedProduct.selling_price
                  )}
                </strong>
              </div>

              <label>
                Player ID

                <input
                  value={playerId}
                  onChange={(e) =>
                    setPlayerId(e.target.value)
                  }
                  placeholder="Enter Player ID"
                />
              </label>

              {selectedGame.slug ===
                "pubg-mobile" && (
                <label>
                  Server ID

                  <input
                    value={serverId}
                    onChange={(e) =>
                      setServerId(e.target.value)
                    }
                    placeholder="Enter Server ID"
                  />
                </label>
              )}

              <label>
                Payment Method

                <select
                  value={gateway}
                  onChange={(e) =>
                    setGateway(e.target.value)
                  }
                >
                  <option value="bkash">
                    bKash
                  </option>

                  <option value="nagad">
                    Nagad
                  </option>

                  <option value="wallet">
                    Wallet — {money(wallet.balance)}
                  </option>
                </select>
              </label>

              <div className="checkout-summary">
                <span>Total</span>

                <strong>
                  {money(
                    selectedProduct.selling_price
                  )}
                </strong>
              </div>

              <button
                className="primary"
                disabled={busy}
              >
                {busy
                  ? "Processing…"
                  : "Buy Now"}
              </button>
            </form>
          )}
        </main>
      )}

      {tab === "orders" && (
        <Orders orders={orders} />
      )}

      {tab === "profile" && (
        <Profile
          profile={profile}
          form={profileForm}
          setForm={setProfileForm}
          onSave={saveProfile}
          msg={profileMsg}
          email={session.user.email}
        />
      )}

      {tab === "wallet" && (
        <Wallet
          wallet={wallet}
          transactions={walletTx}
        />
      )}

      {tab === "admin" && admin && (
        <Admin
          orders={orders}
          onBack={() => setTab("shop")}
          onRefresh={load}
        />
      )}
    </div>
  );
}

function Auth({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  onLogin,
  onSignup,
  onOAuth,
  busy,
  message,
}) {
  const signup = mode === "signup";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-logo">G</div>

          <div>
            <strong>GameON</strong>
            <span>Game Top-Up BD</span>
          </div>
        </div>

        <h1>
          {signup
            ? "Create Account"
            : "Welcome Back"}
        </h1>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <form
          onSubmit={
            signup ? onSignup : onLogin
          }
        >
          {signup && (
            <label>
              Name

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Your name"
              />
            </label>
          )}

          <label>
            Email

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />
          </label>

          <label>
            Password

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />
          </label>

          <button
            className="primary"
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : signup
              ? "Create Account"
              : "Login"}
          </button>
        </form>

        <div className="oauth-row">
          <button
            onClick={() =>
              onOAuth("google")
            }
          >
            Continue with Google
          </button>

          <button
            onClick={() =>
              onOAuth("facebook")
            }
          >
            Continue with Facebook
          </button>
        </div>

        <button
          className="link-button"
          onClick={() =>
            setMode(
              signup ? "login" : "signup"
            )
          }
        >
          {signup
            ? "Already have an account? Login"
            : "New user? Create an account"}
        </button>
      </div>
    </div>
  );
}

function Profile({
  profile,
  form,
  setForm,
  onSave,
  msg,
  email,
}) {
  return (
    <main className="content">
      <div className="profile-grid">
        <section className="card profile-card">
          <div className="profile-avatar">
            {(form.full_name ||
              profile?.user_code ||
              "G")
              .slice(0, 1)
              .toUpperCase()}
          </div>

          <h1>
            {form.full_name ||
              "Your Profile"}
          </h1>

          <p className="muted">
            Unique Code:{" "}
            <b>
              {profile?.user_code ||
                "GO-XXXXXXXX"}
            </b>
          </p>

          <form onSubmit={onSave}>
            <label>
              Full Name

              <input
                value={form.full_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    full_name:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              Phone

              <input
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value,
                  })
                }
                placeholder="01XXXXXXXXX"
              />
            </label>

            <label>
              Email

              <input
                value={email || ""}
                disabled
              />
            </label>

            <button className="primary">
              Save Profile
            </button>
          </form>

          {msg && (
            <div className="notice">
              {msg}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Account Code</h2>

          <div className="code-box">
            {profile?.user_code ||
              "GO-XXXXXXXX"}
          </div>

          <p className="muted">
            Every account gets its own unique
            code.
          </p>
        </section>
      </div>
    </main>
  );
}

function Wallet({
  wallet,
  transactions,
}) {
  return (
    <main className="content">
      <div className="wallet-head">
        <div>
          <h1>My Wallet</h1>

          <p className="muted">
            Use wallet balance to buy
            diamonds and UC.
          </p>
        </div>

        <div className="wallet-balance card">
          <span>Available Balance</span>

          <strong>
            {money(wallet.balance)}
          </strong>
        </div>
      </div>

      <section className="card wallet-info">
        <h2>Wallet Payment</h2>

        <p>
          Select <strong>Wallet</strong> at
          checkout. The wallet payment is
          processed securely.
        </p>
      </section>

      <h2>Wallet Transactions</h2>

      {!transactions.length ? (
        <div className="card empty">
          No wallet transactions yet.
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <div
              className="card transaction"
              key={transaction.id}
            >
              <div>
                <b>
                  {transaction.description ||
                    "Wallet transaction"}
                </b>

                <small>
                  {new Date(
                    transaction.created_at
                  ).toLocaleString()}
                </small>
              </div>

              <strong
                className={
                  transaction.type ===
                  "credit"
                    ? "credit"
                    : "debit"
                }
              >
                {transaction.type ===
                "credit"
                  ? "+"
                  : "-"}
                {money(transaction.amount)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Orders({ orders }) {
  return (
    <main className="content">
      <h1>My Orders</h1>

      <p className="muted">
        Only paid orders are shown here.
      </p>

      {!orders.length ? (
        <div className="card empty">
          No paid orders yet.
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div
              className="card order-card"
              key={order.id}
            >
              <div>
                <h3>
                  Order #
                  {order.order_number ||
                    shortCode(order.id)}
                </h3>

                <p>
                  Payment:{" "}
                  <strong className="success">
                    Paid
                  </strong>
                </p>

                <p>
                  {order.fulfillment_status ===
                  "completed"
                    ? "Success ✅"
                    : "Top-up pending ⏳"}
                </p>

                <small>
                  {new Date(
                    order.created_at
                  ).toLocaleString()}
                </small>
              </div>

              <strong>
                {money(order.total)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Admin({
  orders,
  onBack,
  onRefresh,
}) {
  async function complete(orderId) {
    const { error } = await supabase
      .from("orders")
      .update({
        fulfillment_status:
          "completed",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      alert(error.message);
      return;
    }

    await onRefresh();
  }

  return (
    <main className="content">
      <div className="section-title">
        <div>
          <h1>Admin Dashboard</h1>

          <p className="muted">
            Manage paid orders.
          </p>
        </div>

        <button onClick={onBack}>
          Back to Shop
        </button>
      </div>

      {!orders.length ? (
        <div className="card empty">
          No paid orders.
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div
              className="card order-card"
              key={order.id}
            >
              <div>
                <h3>
                  Order #
                  {order.order_number ||
                    shortCode(order.id)}
                </h3>

                <p>
                  Player ID:{" "}
                  {order.player_id}
                </p>

                {order.server_id && (
                  <p>
                    Server ID:{" "}
                    {order.server_id}
                  </p>
                )}

                <p>
                  Payment:{" "}
                  {order.payment_status}
                </p>

                <p>
                  Fulfillment:{" "}
                  {order.fulfillment_status}
                </p>
              </div>

              {order.fulfillment_status !==
                "completed" && (
                <button
                  className="primary"
                  onClick={() =>
                    complete(order.id)
                  }
                >
                  Mark Success
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);
