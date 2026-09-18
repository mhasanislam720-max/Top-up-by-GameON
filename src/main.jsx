import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://bvqlobmpzufxjtxaoxad.supabase.co";

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const money = (value) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortCode = (value) => {
  const text = String(value || "");
  return text.length > 14 ? `${text.slice(0, 10)}…` : text;
};

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [games, setGames] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [wallet, setWallet] = useState({ balance: 0 });
  const [walletTx, setWalletTx] = useState([]);
  const [walletDeposits, setWalletDeposits] = useState([]);

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

  const admin =
    profile?.role === "admin" && profile?.status === "active";

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession || null);

      if (!newSession) {
        setProfile(null);
        setOrders([]);
        setWallet({ balance: 0 });
        setWalletTx([]);
        setWalletDeposits([]);
        setTab("shop");
        setSelectedGame(null);
        setSelectedProduct(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadSession() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session || null);
  }

  useEffect(() => {
    if (session?.user?.id) {
      load();
    }
  }, [session?.user?.id]);

  async function load() {
    if (!session?.user?.id) return;

    const uid = session.user.id;

    const [
      profileRes,
      gamesRes,
      productsRes,
      ordersRes,
      walletRes,
      txRes,
      depositsRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle(),

      supabase
        .from("games")
        .select("*")
        .eq("status", "active")
        .order("sort_order"),

      supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("sort_order"),

      supabase
        .from("orders")
        .select("*")
        .eq("user_id", uid)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", uid)
        .maybeSingle(),

      supabase
        .from("wallet_transactions")
        .select(
          "id,type,amount,description,status,created_at"
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("wallet_deposits")
        .select(
          "id,amount,gateway,status,created_at,paid_at"
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (profileRes.error) {
      setMessage(profileRes.error.message);
      return;
    }

    if (!profileRes.data) {
      setMessage("Profile not found.");
      return;
    }

    if (profileRes.data.status === "blocked") {
      await supabase.auth.signOut();
      setMessage("Your account has been blocked by admin.");
      return;
    }

    setProfile(profileRes.data);

    setProfileForm({
      full_name: profileRes.data.full_name || "",
      phone: profileRes.data.phone || "",
    });

    setGames(gamesRes.data || []);
    setProducts(productsRes.data || []);
    setOrders(ordersRes.data || []);

    setWallet(walletRes.data || { balance: 0 });
    setWalletTx(txRes.data || []);
    setWalletDeposits(depositsRes.data || []);
  }

  async function login(e) {
    e.preventDefault();

    setMessage("");
    setBusy(true);

    const { error } =
      await supabase.auth.signInWithPassword({
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

  async function signup(e) {
    e.preventDefault();

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
    const { error } =
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

    if (error) {
      setMessage(error.message);
    }
  }

  async function signout() {
    await supabase.auth.signOut();

    setProfile(null);
    setSession(null);
    setTab("shop");
    setSelectedGame(null);
    setSelectedProduct(null);
  }

  async function saveProfile(e) {
    e.preventDefault();

    setProfileMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name:
          profileForm.full_name.trim() || null,
        phone:
          profileForm.phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (error) {
      setProfileMsg(error.message);
      return;
    }

    setProfileMsg("Profile saved successfully.");

    await load();
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

  function backToGames() {
    setSelectedGame(null);
    setSelectedProduct(null);
    setPlayerId("");
    setServerId("");
    setMessage("");
  }

  async function placeOrder(e) {
    e.preventDefault();

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

    const needsServer =
      selectedGame.region_required ||
      selectedGame.slug === "pubg-mobile";

    if (needsServer && !serverId.trim()) {
      setMessage("Enter Server ID.");
      return;
    }

    const total = Number(
      selectedProduct.selling_price || 0
    );

    if (
      gateway === "wallet" &&
      Number(wallet.balance || 0) < total
    ) {
      setMessage(
        "Insufficient wallet balance. Add money first."
      );
      return;
    }

    setBusy(true);

    const orderId = crypto.randomUUID();

    const { error } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        user_id: session.user.id,
        game_id: selectedGame.id,
        product_id: selectedProduct.id,
        player_id: playerId.trim(),
        server_id: serverId.trim() || null,
        quantity: 1,
        subtotal: total,
        discount: 0,
        total,
        payment_status: "pending",
        fulfillment_status: "pending",
      });

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    if (gateway === "wallet") {
      const { error: walletError } =
        await supabase.rpc(
          "pay_order_with_wallet",
          {
            p_order_id: orderId,
          }
        );

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
        "Wallet payment successful. Top-up is now processing."
      );

      return;
    }

    const {
      data: payment,
      error: paymentError,
    } = await supabase.functions.invoke(
      "payment-init",
      {
        body: {
          order_id: orderId,
          gateway,
        },
      }
    );

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

  async function addMoney(amount, selectedGateway) {
    setMessage("");

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    if (value < 20) {
      setMessage("Minimum add money amount is ৳20.");
      return;
    }

    setBusy(true);

    const {
      data,
      error,
    } = await supabase.functions.invoke(
      "wallet-deposit-init",
      {
        body: {
          amount: value,
          gateway: selectedGateway,
        },
      }
    );

    setBusy(false);

    if (error) {
      setMessage(
        error.message ||
          "Wallet payment could not start."
      );
      return;
    }

    if (data?.payment_url) {
      window.location.href = data.payment_url;
      return;
    }

    setMessage(
      data?.error ||
        "Could not start wallet payment."
    );
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
              🛡️ Admin
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
          🛒 Shop
        </button>

        <button
          className={tab === "orders" ? "active" : ""}
          onClick={() => setTab("orders")}
        >
          📦 My Orders
        </button>

        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => setTab("profile")}
        >
          👤 Profile
        </button>

        <button
          className={tab === "wallet" ? "active" : ""}
          onClick={() => setTab("wallet")}
        >
          💰 Wallet
        </button>

        {admin && (
          <button
            className={tab === "admin" ? "active" : ""}
            onClick={() => setTab("admin")}
          >
            🛡️ Admin
          </button>
        )}
      </nav>

      {message && (
        <div className="notice global-notice">
          {message}
        </div>
      )}

      {tab === "shop" && (
        <Shop
          games={games}
          selectedGame={selectedGame}
          chooseGame={chooseGame}
          backToGames={backToGames}
          currentProducts={currentProducts}
          selectedProduct={selectedProduct}
          setSelectedProduct={setSelectedProduct}
          playerId={playerId}
          setPlayerId={setPlayerId}
          serverId={serverId}
          setServerId={setServerId}
          gateway={gateway}
          setGateway={setGateway}
          wallet={wallet}
          placeOrder={placeOrder}
          busy={busy}
        />
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
          deposits={walletDeposits}
          onAddMoney={addMoney}
          busy={busy}
        />
      )}

      {tab === "admin" && admin && (
        <Admin onBack={() => setTab("shop")} />
      )}
    </div>
  );
}

function Shop({
  games,
  selectedGame,
  chooseGame,
  backToGames,
  currentProducts,
  selectedProduct,
  setSelectedProduct,
  playerId,
  setPlayerId,
  serverId,
  setServerId,
  gateway,
  setGateway,
  wallet,
  placeOrder,
  busy,
}) {
  return (
    <main className="content">
      <section className="hero">
        <p className="eyebrow">
          FAST • SECURE • BD
        </p>

        <h1>GameON Top-Up</h1>

        <p>
          Free Fire Diamonds এবং PUBG Mobile UC
          দ্রুত কিনুন।
        </p>
      </section>

      {!selectedGame ? (
        <section className="card game-picker">
          <p className="eyebrow">
            CHOOSE YOUR GAME
          </p>

          <h2>Select Game</h2>

          <p className="muted">
            Game select করলে শুধু ওই game-এর
            package দেখাবে।
          </p>

          <div className="game-grid">
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                className="game-card"
                onClick={() => chooseGame(game)}
              >
                {game.logo_url && (
                  <img
                    src={game.logo_url}
                    alt={game.name}
                  />
                )}

                <div>
                  <strong>{game.name}</strong>

                  <small>
                    View Packages →
                  </small>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="card game-detail-head">
            <button
              type="button"
              className="back-game"
              onClick={backToGames}
            >
              ← All Games
            </button>

            <div className="game-detail-title">
              {selectedGame.logo_url && (
                <img
                  src={selectedGame.logo_url}
                  alt={selectedGame.name}
                />
              )}

              <div>
                <p className="eyebrow">
                  GAME TOP-UP
                </p>

                <h2>{selectedGame.name}</h2>

                <p className="muted">
                  শুধু {selectedGame.name}-এর
                  package এখানে দেখানো হচ্ছে।
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>
              {selectedGame.name} Packages
            </h2>

            <p className="muted">
              আপনার package select করুন।
            </p>

            <div className="product-grid">
              {currentProducts.length ? (
                currentProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className={
                      selectedProduct?.id === product.id
                        ? "product-card selected"
                        : "product-card"
                    }
                    onClick={() =>
                      setSelectedProduct(product)
                    }
                  >
                    <span className="package-name">
                      <b>{product.name}</b>

                      <small>
                        SKU: {product.sku}
                      </small>
                    </span>

                    <strong>
                      {money(product.selling_price)}
                    </strong>
                  </button>
                ))
              ) : (
                <div className="empty">
                  No packages available.
                </div>
              )}
            </div>
          </section>

          {selectedProduct && (
            <form
              className="card checkout"
              onSubmit={placeOrder}
            >
              <div className="section-title">
                <div>
                  <p className="eyebrow">
                    CHECKOUT
                  </p>

                  <h2>
                    Buy {selectedProduct.name}
                  </h2>

                  <p className="muted">
                    Package: {selectedProduct.sku}
                  </p>
                </div>

                <strong>
                  {money(
                    selectedProduct.selling_price
                  )}
                </strong>
              </div>

              <label>
                {selectedGame.player_id_label ||
                  "Player ID"}

                <input
                  value={playerId}
                  onChange={(e) =>
                    setPlayerId(e.target.value)
                  }
                  placeholder="Enter Player ID"
                  required
                />
              </label>

              {(selectedGame.region_required ||
                selectedGame.slug === "pubg-mobile") && (
                <label>
                  Server ID

                  <input
                    value={serverId}
                    onChange={(e) =>
                      setServerId(e.target.value)
                    }
                    placeholder="Enter Server ID"
                    required
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
                    Wallet —{" "}
                    {money(wallet.balance)}
                  </option>
                </select>
              </label>

              {gateway === "wallet" && (
                <div className="wallet-pay-box">
                  Wallet Balance:{" "}
                  <strong>
                    {money(wallet.balance)}
                  </strong>
                </div>
              )}

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
                  : `Buy ${selectedGame.name} Now`}
              </button>
            </form>
          )}
        </>
      )}
    </main>
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
                required
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
              placeholder="you@example.com"
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
              placeholder="Your password"
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
            type="button"
            onClick={() =>
              onOAuth("google")
            }
          >
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() =>
              onOAuth("facebook")
            }
          >
            Continue with Facebook
          </button>
        </div>

        <button
          type="button"
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

          <p className="muted">
            Plan:{" "}
            <b>
              {profile?.plan || "free"}
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
          <h2>
            Account Information
          </h2>

          <div className="code-box">
            {profile?.user_code ||
              "GO-XXXXXXXX"}
          </div>

          <p className="muted">
            Every account gets its own
            unique code.
          </p>

          <hr />

          <p>
            <b>Account Plan:</b>{" "}
            {profile?.plan || "free"}
          </p>

          <p>
            <b>Status:</b>{" "}
            {profile?.status || "active"}
          </p>

          <p>
            <b>Role:</b>{" "}
            {profile?.role || "customer"}
          </p>
        </section>
      </div>
    </main>
  );
}

function Wallet({
  wallet,
  transactions,
  deposits,
  onAddMoney,
  busy,
}) {
  const [amount, setAmount] = useState("");
  const [gw, setGw] = useState("bkash");

  return (
    <main className="content">
      <div className="wallet-head">
        <div>
          <h1>My Wallet</h1>

          <p className="muted">
            Wallet balance দিয়ে game top-up
            এবং নতুন balance add করতে পারবেন।
          </p>
        </div>

        <div className="wallet-balance card">
          <span>
            Available Balance
          </span>

          <strong>
            {money(wallet.balance)}
          </strong>
        </div>
      </div>

      <section className="card add-money-card">
        <p className="eyebrow">
          ADD MONEY
        </p>

        <h2>
          Wallet-এ টাকা যোগ করুন
        </h2>

        <p className="muted">
          Minimum add money: ৳20
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddMoney(amount, gw);
          }}
        >
          <label>
            Amount

            <input
              type="number"
              min="20"
              step="1"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              placeholder="Example: 500"
              required
            />
          </label>

          <label>
            Payment Gateway

            <select
              value={gw}
              onChange={(e) =>
                setGw(e.target.value)
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

          <button
            className="primary"
            disabled={busy}
          >
            {busy
              ? "Opening payment…"
              : `Add ${
                  amount
                    ? money(amount)
                    : "Money"
                }`}
          </button>
        </form>
      </section>

      <section className="card wallet-info">
        <h2>
          How Wallet Works
        </h2>

        <p>
          Amount লিখুন → bKash/Nagad select
          করুন → payment complete করুন →
          সফল payment হলে balance automatically
          যোগ হবে।
        </p>
      </section>

      <h2>Recent Add Money</h2>

      {!deposits.length ? (
        <div className="card empty">
          No wallet deposits yet.
        </div>
      ) : (
        <div className="transaction-list">
          {deposits.map((deposit) => (
            <div
              className="card transaction"
              key={deposit.id}
            >
              <div>
                <b>
                  {deposit.gateway.toUpperCase()}
                  {" — Wallet Add"}
                </b>

                <small>
                  {new Date(
                    deposit.created_at
                  ).toLocaleString()}
                </small>
              </div>

              <strong
                className={
                  deposit.status ===
                  "success"
                    ? "credit"
                    : ""
                }
              >
                {money(deposit.amount)}
                {" · "}
                {deposit.status}
              </strong>
            </div>
          ))}
        </div>
      )}

      <h2>
        Wallet Transactions
      </h2>

      {!transactions.length ? (
        <div className="card empty">
          No wallet transactions yet.
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.map((tx) => (
            <div
              className="card transaction"
              key={tx.id}
            >
              <div>
                <b>
                  {tx.description ||
                    "Wallet transaction"}
                </b>

                <small>
                  {new Date(
                    tx.created_at
                  ).toLocaleString()}
                </small>
              </div>

              <strong
                className={
                  tx.type === "credit"
                    ? "credit"
                    : "debit"
                }
              >
                {tx.type === "credit"
                  ? "+"
                  : "-"}
                {money(tx.amount)}
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
        Paid orders এবং top-up status এখানে
        দেখা যাবে।
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
                  Player ID:{" "}
                  <b>{order.player_id}</b>
                </p>

                {order.server_id && (
                  <p>
                    Server ID:{" "}
                    <b>{order.server_id}</b>
                  </p>
                )}

                <p>
                  Payment:{" "}
                  <strong className="success">
                    Paid
                  </strong>
                </p>

                <p>
                  Top-up:{" "}
                  <b>
                    {order.fulfillment_status}
                  </b>
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

function Admin({ onBack }) {
  const [users, setUsers] = useState([]);
  const [paidOrders, setPaidOrders] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] =
    useState("users");

  const [search, setSearch] =
    useState("");

  const [selectedUser, setSelectedUser] =
    useState(null);

  const [amount, setAmount] =
    useState("");

  const [reason, setReason] =
    useState("Free wallet credit");

  const [limit, setLimit] =
    useState(1000);

  const [newLimit, setNewLimit] =
    useState("1000");

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    setMsg("");

    const {
      data: userData,
      error: userError,
    } = await supabase.rpc(
      "admin_list_users"
    );

    if (userError) {
      setMsg(userError.message);
      setLoading(false);
      return;
    }

    setUsers(userData || []);

    const {
      data: orderData,
    } = await supabase.rpc(
      "admin_list_paid_orders"
    );

    setPaidOrders(orderData || []);

    const {
      data: settings,
    } = await supabase.rpc(
      "admin_get_wallet_settings"
    );

    if (settings?.length) {
      const currentLimit = Number(
        settings[0].free_credit_limit ||
          1000
      );

      setLimit(currentLimit);
      setNewLimit(
        String(currentLimit)
      );
    }

    setLoading(false);
  }

  async function changePlan(
    userId,
    plan
  ) {
    const { error } =
      await supabase.rpc(
        "admin_set_user_plan",
        {
          p_user_id: userId,
          p_plan: plan,
        }
      );

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      plan === "free"
        ? "User is now Free."
        : "User is now Premium."
    );

    loadAdminData();
  }

  async function changeStatus(
    userId,
    status
  ) {
    const confirmed = window.confirm(
      status === "blocked"
        ? "Block this user?"
        : "Unblock this user?"
    );

    if (!confirmed) return;

    const { error } =
      await supabase.rpc(
        "admin_set_user_status",
        {
          p_user_id: userId,
          p_status: status,
        }
      );

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      status === "blocked"
        ? "User blocked."
        : "User unblocked."
    );

    loadAdminData();
  }

  async function saveLimit(e) {
    e.preventDefault();

    const value = Number(newLimit);

    if (!Number.isFinite(value) || value < 1) {
      setMsg("Enter a valid credit limit.");
      return;
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_set_free_credit_limit",
      {
        p_limit: value,
      }
    );

    if (error) {
      setMsg(error.message);
      return;
    }

    setLimit(Number(data));
    setNewLimit(String(data));

    setMsg(
      `Free credit limit set to ${money(
        data
      )}.`
    );
  }

  async function giveCredit(e) {
    e.preventDefault();

    if (!selectedUser) {
      setMsg("Select a user first.");
      return;
    }

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setMsg("Enter a valid amount.");
      return;
    }

    if (value > limit) {
      setMsg(
        `Maximum allowed is ${money(
          limit
        )}.`
      );
      return;
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_credit_wallet",
      {
        p_user_id: selectedUser.id,
        p_amount: value,
        p_reason: reason,
      }
    );

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      `${money(value)} credited to ${
        selectedUser.user_code
      }. New balance: ${money(data)}`
    );

    setAmount("");

    loadAdminData();
  }

  async function completeOrder(
    orderId
  ) {
    const { error } =
      await supabase.rpc(
        "admin_complete_order",
        {
          p_order_id: orderId,
        }
      );

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      "Order marked as Success."
    );

    loadAdminData();
  }

  const searchText =
    search.trim().toLowerCase();

  const filteredUsers =
    users.filter((user) => {
      if (!searchText) return true;

      return [
        user.user_code,
        user.email,
        user.full_name,
        user.phone,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(searchText)
        );
    });

  return (
    <main className="content">
      <div className="section-title">
        <div>
          <h1>
            🛡️ Admin Panel
          </h1>

          <p className="muted">
            GameON management dashboard
          </p>
        </div>

        <button onClick={onBack}>
          Back to Shop
        </button>
      </div>

      {msg && (
        <div className="notice">
          {msg}
        </div>
      )}

      <div className="admin-tabs">
        <button
          className={
            activeTab === "users"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("users")
          }
        >
          👥 Users
        </button>

        <button
          className={
            activeTab === "wallet"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("wallet")
          }
        >
          💰 Free Credit
        </button>

        <button
          className={
            activeTab === "orders"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("orders")
          }
        >
          📦 Orders
        </button>
      </div>

      {activeTab === "users" && (
        <section className="card">
          <div className="section-title">
            <div>
              <h2>
                👥 User Management
              </h2>

              <p className="muted">
                Total Users:{" "}
                {users.length}
              </p>
            </div>

            <button
              onClick={loadAdminData}
            >
              Refresh
            </button>
          </div>

          <div className="user-search-box">
            <label>
              🔎 Search User

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="GO-ABC12345 / email / name"
              />
            </label>
          </div>

          {loading ? (
            <div className="empty">
              Loading users...
            </div>
          ) : (
            <div className="admin-users">
              {filteredUsers.map((user) => (
                <div
                  className="card admin-user"
                  key={user.id}
                >
                  <div className="admin-user-info">
                    <div className="profile-avatar">
                      {(
                        user.full_name ||
                        user.user_code ||
                        "G"
                      )
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>

                    <div>
                      <h3>
                        {user.full_name ||
                          "No Name"}
                      </h3>

                      <p>
                        {user.email ||
                          "No Email"}
                      </p>

                      <small>
                        Unique ID:{" "}
                        <b>
                          {user.user_code}
                        </b>
                      </small>

                      {user.phone && (
                        <small>
                          Phone:{" "}
                          {user.phone}
                        </small>
                      )}
                    </div>
                  </div>

                  <div className="admin-user-status">
                    <span
                      className={
                        user.status ===
                        "blocked"
                          ? "status blocked"
                          : "status active"
                      }
                    >
                      {user.status ===
                      "blocked"
                        ? "🚫 Blocked"
                        : "🟢 Active"}
                    </span>

                    <span className="status">
                      Plan:{" "}
                      {user.plan ||
                        "free"}
                    </span>
                  </div>

                  <div className="admin-actions">
                    <button
                      onClick={() => {
                        setSelectedUser(
                          user
                        );
                        setActiveTab(
                          "wallet"
                        );
                      }}
                    >
                      💰 Give Free
                    </button>

                    <button
                      onClick={() =>
                        changePlan(
                          user.id,
                          "free"
                        )
                      }
                      disabled={
                        user.plan ===
                        "free"
                      }
                    >
                      🆓 Free
                    </button>

                    <button
                      onClick={() =>
                        changePlan(
                          user.id,
                          "premium"
                        )
                      }
                      disabled={
                        user.plan ===
                        "premium"
                      }
                    >
                      ⭐ Premium
                    </button>

                    {user.status ===
                    "blocked" ? (
                      <button
                        className="success-btn"
                        onClick={() =>
                          changeStatus(
                            user.id,
                            "active"
                          )
                        }
                      >
                        🔓 Unblock
                      </button>
                    ) : (
                      <button
                        className="danger-btn"
                        onClick={() =>
                          changeStatus(
                            user.id,
                            "blocked"
                          )
                        }
                      >
                        🚫 Block
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "wallet" && (
        <section className="card">
          <p className="eyebrow">
            ADMIN WALLET CONTROL
          </p>

          <h2>
            💰 Free Credit
          </h2>

          <p className="muted">
            একবারে সর্বোচ্চ{" "}
            {money(limit)} পর্যন্ত user
            wallet-এ credit করা যাবে।
          </p>

          <form
            className="card"
            onSubmit={saveLimit}
          >
            <label>
              Maximum Free Credit Limit

              <input
                type="number"
                min="1"
                step="1"
                value={newLimit}
                onChange={(e) =>
                  setNewLimit(
                    e.target.value
                  )
                }
              />
            </label>

            <button>
              Save Limit
            </button>
          </form>

          <form
            className="card"
            onSubmit={giveCredit}
          >
            <h3>
              Give Money to User
            </h3>

            <label>
              Selected User

              <input
                value={
                  selectedUser
                    ? `${selectedUser.user_code} — ${
                        selectedUser.email ||
                        selectedUser.full_name ||
                        ""
                      }`
                    : ""
                }
                placeholder="Users tab থেকে Give Free চাপুন"
                disabled
              />
            </label>

            <label>
              Amount

              <input
                type="number"
                min="1"
                max={limit}
                step="1"
                value={amount}
                onChange={(e) =>
                  setAmount(
                    e.target.value
                  )
                }
                placeholder={`Maximum ${limit}`}
                required
              />
            </label>

            <label>
              Reason

              <input
                value={reason}
                onChange={(e) =>
                  setReason(
                    e.target.value
                  )
                }
                placeholder="Free wallet credit"
              />
            </label>

            <button
              className="primary"
              disabled={!selectedUser}
            >
              ✅ Confirm Credit
            </button>
          </form>
        </section>
      )}

      {activeTab === "orders" && (
        <section className="card">
          <div className="section-title">
            <div>
              <h2>
                📦 Paid Orders
              </h2>

              <p className="muted">
                Paid orders waiting for
                top-up.
              </p>
            </div>

            <button
              onClick={loadAdminData}
            >
              Refresh
            </button>
          </div>

          {!paidOrders.length ? (
            <div className="empty">
              No paid orders.
            </div>
          ) : (
            <div className="order-list">
              {paidOrders.map((order) => (
                <div
                  className="card order-card"
                  key={order.id}
                >
                  <div>
                    <h3>
                      Order #
                      {order.order_number ||
                        shortCode(
                          order.id
                        )}
                    </h3>

                    <p>
                      Player ID:{" "}
                      <b>
                        {order.player_id}
                      </b>
                    </p>

                    {order.server_id && (
                      <p>
                        Server ID:{" "}
                        <b>
                          {order.server_id}
                        </b>
                      </p>
                    )}

                    <p>
                      Payment:{" "}
                      <strong className="success">
                        Paid
                      </strong>
                    </p>

                    <p>
                      Fulfillment:{" "}
                      <b>
                        {
                          order.fulfillment_status
                        }
                      </b>
                    </p>

                    <p>
                      Amount:{" "}
                      <b>
                        {money(
                          order.total
                        )}
                      </b>
                    </p>
                  </div>

                  {order.fulfillment_status !==
                  "completed" ? (
                    <button
                      className="primary"
                      onClick={() =>
                        completeOrder(
                          order.id
                        )
                      }
                    >
                      ✅ Mark Success
                    </button>
                  ) : (
                    <span className="success">
                      ✅ Completed
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);
