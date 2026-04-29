import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { login, logout, me, type UserInfo } from "./api/auth";

function LoginForm({ onSuccess }: { onSuccess: (u: UserInfo) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      onSuccess(user);
    } catch {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>ログイン</h1>
      <div>
        <label>
          Email:{" "}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Password:{" "}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </div>
      <button type="submit" disabled={loading}>
        ログイン
      </button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}

function Home({
  user,
  onLogout,
}: {
  user: UserInfo;
  onLogout: () => void;
}) {
  return (
    <div>
      <h1>ようこそ</h1>
      <p>Email: {user.email}</p>
      <p>Name: {user.name}</p>
      <button onClick={onLogout}>ログアウト</button>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    me().then((u) => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (checking) return <div>確認中...</div>;
  if (user) return <Home user={user} onLogout={handleLogout} />;
  return <LoginForm onSuccess={setUser} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
