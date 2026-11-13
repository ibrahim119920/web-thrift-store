import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../../components/auth/AuthShell";
import { PasswordField } from "../../components/auth/PasswordField";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../services/api";

interface RegisterFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

const initialFields: RegisterFields = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
};

export function RegisterPage() {
  const { register, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;

  const update = (key: keyof RegisterFields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await register({
        name: [fields.firstName.trim(), fields.lastName.trim()].filter(Boolean).join(" "),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        password: fields.password,
      });
      showToast("Akunmu berhasil dibuat.", "success");
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors((current) => ({ ...current, ...error.errors }));
        setFormError(error.status === 409 ? "" : error.message);
      } else {
        setFormError("Tidak dapat membuat akun. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell tone="pink">
      <div className="text-center">
        <h1 className="font-['Inter:Extra_Bold'] text-2xl font-extrabold leading-8">Sign Up</h1>
        <p className="mt-1.5 font-['Inter:Regular'] text-[15px] leading-5 text-[#4b4b4b]">
          Sign up to start thrifting at WantToSell
        </p>
      </div>
      <form onSubmit={submit} className="mt-[45px]" noValidate>
        <div className="space-y-[19px]">
          <div className="grid grid-cols-2 gap-[13px]">
            <Input
              label="First Name"
              value={fields.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              placeholder="eg. John"
              autoComplete="given-name"
              error={errors.firstName || errors.name}
              className="text-[13px]"
              labelClassName="text-[13px]"
            />
            <Input
              label="Last Name"
              value={fields.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              placeholder="eg. Francisco"
              autoComplete="family-name"
              error={errors.lastName}
              className="text-[13px]"
              labelClassName="text-[13px]"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={fields.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="eg. johnfrans@gmail.com"
            autoComplete="email"
            error={errors.email}
            className="text-[13px]"
            labelClassName="text-[13px]"
          />
          <Input
            label="Phone Number"
            type="tel"
            value={fields.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="eg. 0812345678"
            autoComplete="tel"
            error={errors.phone}
            className="text-[13px]"
            labelClassName="text-[13px]"
          />
          <PasswordField
            value={fields.password}
            onChange={(value) => update("password", value)}
            error={errors.password}
            helper="Must be at least 6 characters."
            autoComplete="new-password"
          />
        </div>
        {formError && (
          <p role="alert" className="mt-4 text-center text-xs text-red-600">
            {formError}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="mt-[26px] w-full rounded-[10px]">
          {submitting ? "Signing up..." : "Sign Up"}
        </Button>
        <p className="mt-[22px] text-center text-[13px] text-[#4b4b4b]">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[#111]">
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function validate(fields: RegisterFields) {
  const errors: Record<string, string> = {};
  if (fields.firstName.trim().length < 2) errors.firstName = "Nama minimal 2 karakter";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = "Masukkan alamat email yang valid";
  if (!/^(?:08|\+62)\d{8,13}$/.test(fields.phone.replace(/[\s-]/g, "")))
    errors.phone = "Gunakan nomor Indonesia dengan format 08... atau +62...";
  if (fields.password.length < 6) errors.password = "Kata sandi minimal 6 karakter";
  return errors;
}
