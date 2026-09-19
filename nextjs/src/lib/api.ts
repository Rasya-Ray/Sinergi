"use client";

import { auth } from "@/lib/firebase";

export async function authFetch(url: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (user) {
    headers["x-firebase-uid"] = user.uid;
  }
  return fetch(url, { ...options, headers });
}
