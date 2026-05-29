import type { APIRoute } from "astro";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { UserService } from "../../../../lib/services/user.service";

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const sessionData = await getSessionFromRequest(cookies);
  if (!sessionData) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    await UserService.changePassword(sessionData.user._id.toString(), {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to update password" }), { status: 400 });
  }
};
