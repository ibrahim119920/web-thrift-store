import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../../components/auth/AuthShell";
import { PasswordField } from "../../components/auth/PasswordField";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../services/api";

export function LoginPage() {
  const { login, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!isEmail(email)) nextErrors.email = "Masukkan alamat email yang valid";
    if (!password) nextErrors.password = "Kata sandi wajib diisi";
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const nextUser = await login(email.trim(), password);
      showToast("Berhasil masuk ke akunmu.", "success");
      const requestedPath = (location.state as { from?: string } | null)?.from;
      navigate(nextUser.role === "admin" ? "/admin" : requestedPath || "/", {
        replace: true,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors);
        setFormError(error.status === 401 ? "Email atau kata sandi salah" : error.message);
      } else {
        setFormError("Tidak dapat masuk. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell tone="lime">
      <div className="text-center">
        <h1 className="font-['Inter:Extra_Bold'] text-2xl font-extrabold leading-8">Log In</h1>
        <p className="mt-1.5 font-['Inter:Regular'] text-[15px] leading-5 text-[#4b4b4b]">
          Please log in to continue to your account
        </p>
      </div>
      <form onSubmit={submit} className="mt-[45px]" noValidate>
        <div className="space-y-[19px]">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="eg. johnfrans@gmail.com"
            autoComplete="email"
            error={errors.email}
            className="text-[13px]"
            labelClassName="text-[13px]"
          />
          <PasswordField
            value={password}
            onChange={setPassword}
            error={errors.password}
            autoComplete="current-password"
          />
        </div>
        {formError && (
          <p role="alert" className="mt-4 text-center text-xs text-red-600">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="mt-[26px] w-full rounded-[10px]">
          {submitting ? "Logging in..." : "Log In"}
        </Button>
        <p className="mt-[22px] text-center text-[13px] text-[#4b4b4b]">
          Don’t have an account?{" "}
          <Link to="/register" className="font-semibold text-[#111]">
            Sign up
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
