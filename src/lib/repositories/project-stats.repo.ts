// Aggregation stats for a project.
// Issues are now embedded inside the project document:
//   project.backlog[]            (sprintId = null)
//   project.sprints[].issues[]   (sprintId = the parent sprint's _id)
//
// The pipeline below flattens both locations into a single stream before grouping.

import { ObjectId } from 'mongodb';
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

export const ProjectStatsRepo = {
  async getStats(projectId: string): Promise<ProjectStats> {
    const db = await getDb();

    // 1. Match the single project document.
    // 2. Build a unified `allIssues` array by concatenating backlog issues
    //    (tagged with sprintId: null) and every sprint's issues (tagged with
    //    the sprint's _id string).
    // 3. Unwind that array so each issue becomes its own pipeline document.
    // 4. Run $facet groupings in parallel – identical to the old per-collection
    //    approach but now operating on the flattened embedded documents.
    const results = await db.collection('projects').aggregate([
      { $match: { _id: new ObjectId(projectId) } },
      {
        $project: {
          allIssues: {
            $concatArrays: [
              // Backlog issues: inject a null sprintId field
              {
                $map: {
                  input: { $ifNull: ['$backlog', []] },
                  as: 'issue',
                  in: { $mergeObjects: ['$$issue', { _sprintId: null }] }
                }
              },
              // Sprint issues: inject the parent sprint's _id as sprintId
              {
                $reduce: {
                  input: { $ifNull: ['$sprints', []] },
                  initialValue: [],
                  in: {
                    $concatArrays: [
                      '$$value',
                      {
                        $map: {
                          input: { $ifNull: ['$$this.issues', []] },
                          as: 'issue',
                          in: { $mergeObjects: ['$$issue', { _sprintId: '$$this._id' }] }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      },
      { $unwind: { path: '$allIssues', preserveNullAndEmptyArrays: false } },
      { $replaceRoot: { newRoot: '$allIssues' } },
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
            { $group: { _id: '$_sprintId', count: { $sum: 1 } } },
            {
              $project: {
                _id: 0,
                sprintId: { $cond: { if: { $eq: ['$_id', null] }, then: null, else: { $toString: '$_id' } } },
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
