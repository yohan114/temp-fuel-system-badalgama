"use server";

import { createSession, deleteSession, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function loginAction(prevState: any, formData: FormData) {
  const username = formData.get("username")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    return { error: "Please enter both username and password" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.active) {
      return { error: "Invalid username or password" };
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return { error: "Invalid username or password" };
    }

    // Set cookie session
    await createSession(user.id, user.username, user.role, user.name, user.projectId, user.bulkTankId);
    
    // Log login in audit trail
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        summary: `User ${user.username} logged in successfully`,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return { error: "Something went wrong. Please try again." };
  }

  // Next.js redirect must be called outside the try-catch block
  redirect("/");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: "You must be signed in to change your password." };
  }

  const currentPassword = formData.get("currentPassword")?.toString() || "";
  const newPassword = formData.get("newPassword")?.toString() || "";
  const confirmPassword = formData.get("confirmPassword")?.toString() || "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Please fill in all fields." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters long." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }
  if (newPassword === currentPassword) {
    return { error: "New password must be different from your current password." };
  }

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return { error: "Your current password is incorrect." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcrypt.hashSync(newPassword, 10) },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "UPDATE",
        entity: "User",
        entityId: user.id,
        summary: `User ${user.username} changed their own password`,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("Change password error:", err);
    return { error: "Failed to update password. Please try again." };
  }
}
