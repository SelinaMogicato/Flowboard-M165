import type { APIRoute } from "astro";
import { ProjectMemberService } from "../../../../lib/services/project-member.service";
import { requireApiUser } from "../../../../lib/auth/guards";
import { ProjectService } from "../../../../lib/services/project.service";

export const GET: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const projectId = context.params.projectId;
  if (!projectId) return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400 });

  try {
    // Check if user has access to view members (any member can view)
    // ProjectMemberService.listMembers likely checks this or returns visible members.
    // Ideally we use ProjectService.requireProjectAccess here too.
    await ProjectService.requireProjectAccess(projectId, userOrResponse._id!.toString());
    
    // Pass userId just in case service needs it or for auditing
    const members = await ProjectMemberService.listMembers(projectId, userOrResponse._id!.toString());
    return new Response(JSON.stringify({ ok: true, data: members }), { status: 200 });
  } catch (error: any) {
    if (error.message === 'Project access denied') return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message || "Failed to list members" }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const projectId = context.params.projectId;
  if (!projectId) return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400 });

  try {
    const body = await context.request.json();
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
    }

    // Only owner can add members usually. ProjectMemberService likely checks ownership.
    // But we should ensure basic project access first.
    await ProjectService.requireProjectAccess(projectId, userOrResponse._id!.toString());
    
    await ProjectMemberService.addMemberByEmail(projectId, email, userOrResponse._id!.toString());
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error: any) {
    if (error.message.includes("Only owners")) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    if (error.message === 'User not found') return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    return new Response(JSON.stringify({ error: error.message || "Failed to add member" }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const userOrResponse = await requireApiUser(context);
  if (userOrResponse instanceof Response) return userOrResponse;

  const projectId = context.params.projectId;
  if (!projectId) return new Response(JSON.stringify({ error: "Project ID required" }), { status: 400 });

  try {
    const body = await context.request.json();
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }

    await ProjectService.requireProjectAccess(projectId, userOrResponse._id!.toString());

    await ProjectMemberService.removeMember(projectId, userId, userOrResponse._id!.toString());
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error: any) {
    if (error.message.includes("Only owners")) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    return new Response(JSON.stringify({ error: error.message || "Failed to remove member" }), { status: 500 });
  }
};
