import type { APIRoute } from "astro";
import { requireApiUser } from "../../../lib/auth/guards";
import { searchUsers } from "../../../lib/repositories/user.repo";

export const GET: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const url = new URL(context.request.url);
  const q = url.searchParams.get("q") || "";
  const limitParam = Number(url.searchParams.get("limit") || "10");
  const limit = Number.isFinite(limitParam) ? limitParam : 10;

  try {
    const users = await searchUsers(q, limit);
    return new Response(JSON.stringify({ ok: true, data: users }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to search users" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
