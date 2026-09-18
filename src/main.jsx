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

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const money = (value) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortCode = (value) => {
  const text = String(value || "");
  return text.length > 14
    ? `${text.slice(0, 10)}…`
    : text;
};

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [games, setGames] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [wallet, setWallet] = useState({
    balance: 0,
  });

  const [walletTx, setWalletTx] = useState([]);

  const [tab, setTab] = useState("shop");

  const [selectedGame, setSelectedGame] =
    useState(null);

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [playerId, setPlayerId] = useState("");
  const [serverId, setServerId] = useState("");
  const [gateway, setGateway] =
    useState("bkash");

  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [name, setName] = useState("");

  const [profileForm, setProfileForm] =
    useState({
      full_name: "",
      phone: "",
    });

  const [message, setMessage] = useState("");
  const [profileMsg, setProfileMsg] =
    useState("");

  const [busy, setBusy] = useState(false);

  const admin =
    profile?.role === "admin" &&
    profile?.status === "active";

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(
          currentSession || null
        );

        if (!currentSession) {
          setProfile(null);
          setOrders([]);
          setWallet({ balance: 0 });
          setWalletTx([]);
          setTab("shop");
        }
      }
    );

    return () =>
      subscription.unsubscribe();
  }, []);

  async function loadSession() {
    const { data } =
      await supabase.auth.getSession();

    setSession(data.session || null);
  }

  useEffect(() => {
    if (session?.user?.id) {
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
        .order("created_at", {
          ascending: false,
        })
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
        .order("created_at", {
          ascending: false,
        })
        .limit(30),
    ]);

    if (profileResult.error) {
      setMessage(
        profileResult.error.message
      );
      return;
    }

    const userProfile =
      profileResult.data;

    if (!userProfile) {
      setMessage(
        "Profile not found."
      );
      return;
    }

    /*
      BLOCKED USER CHECK
    */
    if (
      userProfile.status ===
      "blocked"
    ) {
      await supabase.auth.signOut();

      setMessage(
        "Your account has been blocked by admin."
      );

      return;
    }

    setProfile(userProfile);

    setProfileForm({
      full_name:
        userProfile.full_name || "",
      phone:
        userProfile.phone || "",
    });

    setGames(
      gamesResult.data || []
    );

    setProducts(
      productsResult.data || []
    );

    setOrders(
      ordersResult.data || []
    );

    setWallet(
      walletResult.data || {
        balance: 0,
      }
    );

    setWalletTx(
      transactionsResult.data || []
    );
  }

  async function login(event) {
    event.preventDefault();

    setMessage("");
    setBusy(true);

    const { error } =
      await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        }
      );

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

    const { error } =
      await supabase.auth.signUp({
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
      await supabase.auth.signInWithOAuth(
        {
          provider,
          options: {
            redirectTo:
              window.location.origin,
          },
        }
      );

    if (error) {
      setMessage(error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    setProfileMsg("");

    const { error } =
      await supabase
        .from("profiles")
        .update({
          full_name:
            profileForm.full_name.trim() ||
            null,

          phone:
            profileForm.phone.trim() ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          session.user.id
        );

    if (error) {
      setProfileMsg(error.message);
      return;
    }

    setProfileMsg(
      "Profile saved successfully."
    );

    await load();
  }

  async function signout() {
    await supabase.auth.signOut();

    setProfile(null);
    setSession(null);
    setTab("shop");
  }

  const currentProducts =
    useMemo(() => {
      if (!selectedGame) return [];

      return products.filter(
        (product) =>
          product.game_id ===
          selectedGame.id
      );
    }, [
      products,
      selectedGame,
    ]);

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
      setMessage(
        "Select a game."
      );
      return;
    }

    if (!selectedProduct) {
      setMessage(
        "Select a package."
      );
      return;
    }

    if (!playerId.trim()) {
      setMessage(
        "Enter Player ID."
      );
      return;
    }

    if (
      selectedGame.slug ===
        "pubg-mobile" &&
      !serverId.trim()
    ) {
      setMessage(
        "Enter Server ID."
      );
      return;
    }

    if (
      gateway === "wallet" &&
      Number(wallet.balance || 0) <
        Number(
          selectedProduct.selling_price ||
            0
        )
    ) {
      setMessage(
        "Insufficient wallet balance."
      );
      return;
    }

    setBusy(true);

    const { data: order, error } =
      await supabase
        .from("orders")
        .insert({
          user_id:
            session.user.id,

          game_id:
            selectedGame.id,

          product_id:
            selectedProduct.id,

          player_id:
            playerId.trim(),

          server_id:
            serverId.trim() || null,

          amount:
            selectedProduct.amount,

          total:
            selectedProduct.selling_price,

          payment_status:
            "pending",

          fulfillment_status:
            "pending",
        })
        .select("*")
        .single();

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    /*
      WALLET PAYMENT
    */
    if (gateway === "wallet") {
      const {
        error: walletError,
      } = await supabase.rpc(
        "pay_order_with_wallet",
        {
          p_order_id: order.id,
        }
      );

      setBusy(false);

      if (walletError) {
        setMessage(
          walletError.message
        );

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

    /*
      BKASH / NAGAD
    */
    const {
      data: payment,
      error: paymentError,
    } = await supabase.functions.invoke(
      "payment-init",
      {
        body: {
          order_id: order.id,
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
      window.location.href =
        payment.payment_url;

      return;
    }

    setMessage(
      payment?.error ||
        "Payment gateway is not configured yet."
    );

    await load();
  }

  /*
    NOT LOGGED IN
  */
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

  /*
    MAIN APP
  */
  return (
    <div className="app">
      <header className="topbar">
        <div
          className="brand"
          onClick={() =>
            setTab("shop")
          }
        >
          <div className="brand-logo">
            G
          </div>

          <div>
            <strong>
              GameON
            </strong>

            <span>
              Game Top-Up BD
            </span>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="small"
            onClick={() =>
              setTab("profile")
            }
          >
            Profile
          </button>

          <button
            className="small"
            onClick={() =>
              setTab("wallet")
            }
          >
            Wallet{" "}
            {money(
              wallet.balance
            )}
          </button>

          {admin && (
            <button
              className="small"
              onClick={() =>
                setTab("admin")
              }
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
          className={
            tab === "shop"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("shop")
          }
        >
          🛒 Shop
        </button>

        <button
          className={
            tab === "orders"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("orders")
          }
        >
          📦 My Orders
        </button>

        <button
          className={
            tab === "profile"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("profile")
          }
        >
          👤 Profile
        </button>

        <button
          className={
            tab === "wallet"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("wallet")
          }
        >
          💰 Wallet
        </button>

        {admin && (
          <button
            className={
              tab === "admin"
                ? "active"
                : ""
            }
            onClick={() =>
              setTab("admin")
            }
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

      {/*
        SHOP
      */}
      {tab === "shop" && (
        <main className="content">
          <section className="hero">
            <div>
              <p className="eyebrow">
                FAST • SECURE • BD
              </p>

              <h1>
                GameON Top-Up
              </h1>

              <p>
                Buy Free Fire Diamonds
                and PUBG Mobile UC
                quickly.
              </p>
            </div>
          </section>

          <section className="card">
            <h2>
              Select Game
            </h2>

            <div className="game-grid">
              {games.map((game) => (
                <button
                  key={game.id}
                  className={
                    selectedGame?.id ===
                    game.id
                      ? "game-card selected"
                      : "game-card"
                  }
                  onClick={() =>
                    chooseGame(game)
                  }
                >
                  {game.logo_url && (
                    <img
                      src={
                        game.logo_url
                      }
                      alt=""
                    />
                  )}

                  <strong>
                    {game.name}
                  </strong>

                  <small>
                    {game.slug}
                  </small>
                </button>
              ))}
            </div>
          </section>

          {selectedGame && (
            <section className="card">
              <h2>
                {selectedGame.name}
              </h2>

              <div className="product-grid">
                {currentProducts.map(
                  (product) => (
                    <button
                      key={product.id}
                      className={
                        selectedProduct?.id ===
                        product.id
                          ? "product-card selected"
                          : "product-card"
                      }
                      onClick={() =>
                        chooseProduct(
                          product
                        )
                      }
                    >
                      <span className="package-name">
                        <b>
                          {
                            product.name
                          }
                        </b>

                        <small>
                          SKU:{" "}
                          {
                            product.sku
                          }
                        </small>
                      </span>

                      <strong>
                        {money(
                          product.selling_price
                        )}
                      </strong>
                    </button>
                  )
                )}
              </div>
            </section>
          )}

          {selectedGame &&
            selectedProduct && (
              <form
                className="card checkout"
                onSubmit={
                  placeOrder
                }
              >
                <div className="section-title">
                  <div>
                    <h2>
                      Buy{" "}
                      {
                        selectedProduct.name
                      }
                    </h2>

                    <p className="muted">
                      Package Code:{" "}
                      {
                        selectedProduct.sku
                      }
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
                      setPlayerId(
                        e.target.value
                      )
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
                        setServerId(
                          e.target.value
                        )
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
                      setGateway(
                        e.target.value
                      )
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
                      {money(
                        wallet.balance
                      )}
                    </option>
                  </select>
                </label>

                {gateway ===
                  "wallet" && (
                  <div className="wallet-pay-box">
                    💰 Wallet Balance:{" "}
                    <strong>
                      {money(
                        wallet.balance
                      )}
                    </strong>
                  </div>
                )}

                <div className="checkout-summary">
                  <span>
                    Total
                  </span>

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

      {/*
        ORDERS
      */}
      {tab === "orders" && (
        <Orders orders={orders} />
      )}

      {/*
        PROFILE
      */}
      {tab === "profile" && (
        <Profile
          profile={profile}
          form={profileForm}
          setForm={setProfileForm}
          onSave={saveProfile}
          msg={profileMsg}
          email={
            session.user.email
          }
        />
      )}

      {/*
        WALLET
      */}
      {tab === "wallet" && (
        <Wallet
          wallet={wallet}
          transactions={
            walletTx
          }
        />
      )}

      {/*
        ADMIN
      */}
      {tab === "admin" && admin && (
        <Admin
          onBack={() =>
            setTab("shop")
          }
        />
      )}
    </div>
  );
}


/*
  AUTH
*/
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
  const signup =
    mode === "signup";

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-logo">
            G
          </div>

          <div>
            <strong>
              GameON
            </strong>

            <span>
              Game Top-Up BD
            </span>
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
            signup
              ? onSignup
              : onLogin
          }
        >
          {signup && (
            <label>
              Name

              <input
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
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
                setEmail(
                  e.target.value
                )
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
                setPassword(
                  e.target.value
                )
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
              signup
                ? "login"
                : "signup"
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


/*
  PROFILE
*/
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
            {(
              form.full_name ||
              profile?.user_code ||
              "G"
            )
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
              {profile?.plan ||
                "free"}
            </b>
          </p>

          <form
            onSubmit={onSave}
          >
            <label>
              Full Name

              <input
                value={
                  form.full_name
                }
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
                    phone:
                      e.target.value,
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
            Every account gets its
            own unique code.
          </p>

          <hr />

          <p>
            <b>Account Plan:</b>{" "}
            {profile?.plan ||
              "free"}
          </p>

          <p>
            <b>Status:</b>{" "}
            {profile?.status ||
              "active"}
          </p>

          <p>
            <b>Role:</b>{" "}
            {profile?.role ||
              "customer"}
          </p>
        </section>
      </div>
    </main>
  );
}


/*
  WALLET
*/
function Wallet({
  wallet,
  transactions,
}) {
  return (
    <main className="content">
      <div className="wallet-head">
        <div>
          <h1>
            My Wallet
          </h1>

          <p className="muted">
            Use wallet balance to buy
            diamonds and UC.
          </p>
        </div>

        <div className="wallet-balance card">
          <span>
            Available Balance
          </span>

          <strong>
            {money(
              wallet.balance
            )}
          </strong>
        </div>
      </div>

      <section className="card wallet-info">
        <h2>
          Wallet Payment
        </h2>

        <p>
          Select{" "}
          <strong>
            Wallet
          </strong>{" "}
          at checkout.
        </p>

        <p className="muted">
          Wallet balance can be used
          directly for game top-up.
        </p>
      </section>

      <h2>
        Wallet Transactions
      </h2>

      {!transactions.length ? (
        <div className="card empty">
          No wallet transactions
          yet.
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.map(
            (transaction) => (
              <div
                className="card transaction"
                key={
                  transaction.id
                }
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
                  {money(
                    transaction.amount
                  )}
                </strong>
              </div>
            )
          )}
        </div>
      )}
    </main>
  );
}


/*
  ORDERS
*/
function Orders({
  orders,
}) {
  return (
    <main className="content">
      <h1>
        My Orders
      </h1>

      <p className="muted">
        Only paid orders are shown
        here.
      </p>

      {!orders.length ? (
        <div className="card empty">
          No paid orders yet.
        </div>
      ) : (
        <div className="order-list">
          {orders.map(
            (order) => (
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
                  {money(
                    order.total
                  )}
                </strong>
              </div>
            )
          )}
        </div>
      )}
    </main>
  );
}


/*
  ADMIN PANEL
*/
function Admin({
  onBack,
}) {
  const [users, setUsers] =
    useState([]);

  const [paidOrders, setPaidOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [msg, setMsg] =
    useState("");

  const [adminTab, setAdminTab] =
    useState("users");

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
      setMsg(
        userError.message
      );
      setLoading(false);
      return;
    }

    setUsers(userData || []);

    /*
      Admin order query.

      RLS should allow this only if
      your existing admin policy permits it.
    */
    const {
      data: orderData,
      error: orderError,
    } = await supabase
      .from("orders")
      .select("*")
      .eq(
        "payment_status",
        "paid"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (!orderError) {
      setPaidOrders(
        orderData || []
      );
    }

    setLoading(false);
  }

  async function changePlan(
    userId,
    plan
  ) {
    setMsg("");

    const { error } =
      await supabase.rpc(
        "admin_set_user_plan",
        {
          p_user_id: userId,
          p_plan: plan,
        }
      );

    if (error) {
      setMsg(
        error.message
      );
      return;
    }

    setMsg(
      plan === "free"
        ? "User converted to Free version."
        : "User converted to Premium version."
    );

    await loadAdminData();
  }

  async function changeStatus(
    userId,
    status
  ) {
    const question =
      status === "blocked"
        ? "Are you sure you want to block this user?"
        : "Unblock this user?";

    if (
      !window.confirm(
        question
      )
    ) {
      return;
    }

    setMsg("");

    const { error } =
      await supabase.rpc(
        "admin_set_user_status",
        {
          p_user_id: userId,
          p_status: status,
        }
      );

    if (error) {
      setMsg(
        error.message
      );
      return;
    }

    setMsg(
      status === "blocked"
        ? "User blocked successfully."
        : "User unblocked successfully."
    );

    await loadAdminData();
  }

  async function completeOrder(
    orderId
  ) {
    const { error } =
      await supabase
        .from("orders")
        .update({
          fulfillment_status:
            "completed",

          completed_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          orderId
        );

    if (error) {
      setMsg(
        error.message
      );
      return;
    }

    setMsg(
      "Order marked as Success."
    );

    await loadAdminData();
  }

  return (
    <main className="content">
      <div className="section-title">
        <div>
          <h1>
            🛡️ Admin Panel
          </h1>

          <p className="muted">
            GameON management
            dashboard
          </p>
        </div>

        <button
          onClick={onBack}
        >
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
            adminTab === "users"
              ? "active"
              : ""
          }
          onClick={() =>
            setAdminTab(
              "users"
            )
          }
        >
          👥 Users
        </button>

        <button
          className={
            adminTab === "orders"
              ? "active"
              : ""
          }
          onClick={() =>
            setAdminTab(
              "orders"
            )
          }
        >
          📦 Orders
        </button>
      </div>

      {/*
        USERS
      */}
      {adminTab === "users" && (
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
              onClick={
                loadAdminData
              }
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="empty">
              Loading users...
            </div>
          ) : !users.length ? (
            <div className="empty">
              No users found.
            </div>
          ) : (
            <div className="admin-users">
              {users.map(
                (user) => (
                  <div
                    className="card admin-user"
                    key={
                      user.id
                    }
                  >
                    <div className="admin-user-info">
                      <div className="profile-avatar">
                        {(
                          user.full_name ||
                          user.user_code ||
                          "G"
                        )
                          .slice(
                            0,
                            1
                          )
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
                          User Code:{" "}
                          <b>
                            {
                              user.user_code
                            }
                          </b>
                        </small>

                        {user.phone && (
                          <small>
                            Phone:{" "}
                            {
                              user.phone
                            }
                          </small>
                        )}

                        <small>
                          Joined:{" "}
                          {new Date(
                            user.created_at
                          ).toLocaleDateString()}
                        </small>
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

                      <span className="status">
                        Role:{" "}
                        {user.role}
                      </span>
                    </div>

                    <div className="admin-actions">
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
                )
              )}
            </div>
          )}
        </section>
      )}

      {/*
        ORDERS
      */}
      {adminTab === "orders" && (
        <section className="card">
          <div className="section-title">
            <div>
              <h2>
                📦 Paid Orders
              </h2>

              <p className="muted">
                Paid orders waiting
                for top-up
              </p>
            </div>

            <button
              onClick={
                loadAdminData
              }
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
              {paidOrders.map(
                (order) => (
                  <div
                    className="card order-card"
                    key={
                      order.id
                    }
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
                          {
                            order.player_id
                          }
                        </b>
                      </p>

                      {order.server_id && (
                        <p>
                          Server ID:{" "}
                          <b>
                            {
                              order.server_id
                            }
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
                      "completed" && (
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
                    )}

                    {order.fulfillment_status ===
                      "completed" && (
                      <span className="success">
                        ✅ Completed
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}


/*
  START APP
*/
createRoot(
  document.getElementById(
    "root"
  )
).render(
  <App />
);
