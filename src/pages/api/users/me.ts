import type { APIRoute } from "astro";
import { getSessionFromRequest } from "../../../lib/auth/session";
import { UserService } from "../../../lib/services/user.service";

export const GET: APIRoute = async ({ cookies }) => {
  const sessionData = await getSessionFromRequest(cookies);
  if (!sessionData) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const user = await UserService.getUserProfile(sessionData.user._id.toString());
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  return new Response(JSON.stringify({ 
    ok: true, 
    data: { 
      id: user._id, 
      name: user.name, 
      email: user.email 
    } 
  }), { status: 200 });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const sessionData = await getSessionFromRequest(cookies);
  if (!sessionData) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), { status: 400 });
    }

    await UserService.updateProfile(sessionData.user._id.toString(), { name });
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to update profile" }), { status: 500 });
  }
};
