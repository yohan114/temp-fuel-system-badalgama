import React from "react";
import { getSession } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-white tracking-wide">My Account</h1>
        <p className="text-xs text-gray-400 mt-1">
          Signed in as <span className="text-gray-200 font-semibold">{session.name}</span> (@{session.username}) ·{" "}
          <span className="capitalize">{session.role.toLowerCase().replace("_", " ")}</span>
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
