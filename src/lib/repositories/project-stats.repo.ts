import { getDb } from '../db/mongo';

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface ListCount {
  listId: string;
  count: number;
}

export interface SprintCount {
  sprintId: string | null;
  count: number;
}

export interface AssigneeCount {
  assignee: string | null;
  count: number;
}

export interface ProjectStats {
  totalIssues: number;
  byPriority: PriorityCount[];
  byList: ListCount[];
  bySprint: SprintCount[];
  byAssignee: AssigneeCount[];
}

const COLLECTION = 'issues';

export const ProjectStatsRepo = {
  async getStats(projectId: string): Promise<ProjectStats> {
    const db = await getDb();

    // Single round-trip: $match filters the project's issues, then $facet runs
    // each grouping in parallel inside MongoDB so we never load raw documents
    // into application memory.
    const results = await db.collection(COLLECTION).aggregate([
      { $match: { projectId } },
      {
        $facet: {
          total: [
            { $count: 'count' }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $project: { _id: 0, priority: '$_id', count: 1 } },
            { $sort: { count: -1 } }
          ],
          byList: [
            { $group: { _id: '$listId', count: { $sum: 1 } } },
            { $project: { _id: 0, listId: '$_id', count: 1 } },
            { $sort: { count: -1 } }
          ],
          bySprint: [
            { $group: { _id: '$sprintId', count: { $sum: 1 } } },
            {
              $project: {
                _id: 0,
                // $toString returns null when the input is null, and the hex
                // string when the input is an ObjectId.
                sprintId: { $toString: '$_id' },
                count: 1
              }
            },
            { $sort: { count: -1 } }
          ],
          byAssignee: [
            { $group: { _id: '$assignee', count: { $sum: 1 } } },
            { $project: { _id: 0, assignee: '$_id', count: 1 } },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]).toArray();

    const raw = results[0] as any;

    return {
      totalIssues: raw?.total?.[0]?.count ?? 0,
      byPriority: raw?.byPriority ?? [],
      byList: raw?.byList ?? [],
      bySprint: raw?.bySprint ?? [],
      byAssignee: raw?.byAssignee ?? [],
    };
  }
};
