/**
 * Garden dashboard route
 * GET /garden/dashboard  — cross-garden summary for the home screen widget and garden index
 *
 * Returns:
 *   - gardens array with per-garden plant/zone counts and open task counts
 *   - global stats: total plants, plants in ground, open tasks, sourcing pipeline
 *   - open_tasks: urgent + soon tasks (not completed), ordered by priority
 *   - sourcing_pipeline: active items (researching + ordered)
 *   - recent_activities: last 10 plant activities across all gardens
 *   - planting_guidance: safe-to-plant + frost risk + warming trend (from weather module)
 */

const express          = require('express');
const router           = express.Router();
const db               = require('../db');
const plantingGuidance = require('../../weather/services/planting-guidance');

router.get('/dashboard', async (req, res) => {
  try {
    const [
      gardens,
      stats,
      openTasks,
      sourcingPipeline,
      recentActivities,
      planting_guidance,
    ] = await Promise.all([

      // Per-garden summary
      db.all(`
        SELECT g.id, g.name, g.slug,
               COUNT(DISTINCT z.id)                                     AS zone_count,
               COUNT(DISTINCT p.id)                                     AS plant_count,
               SUM(CASE WHEN p.quantity_in_ground > 0 THEN p.quantity_in_ground ELSE 0 END) AS in_ground_count,
               COUNT(DISTINCT CASE WHEN t.completed = 0 THEN t.id END) AS open_task_count
          FROM gardens g
          LEFT JOIN zones  z ON z.garden_id = g.id
          LEFT JOIN plants p ON p.garden_id = g.id
          LEFT JOIN tasks  t ON t.garden_id = g.id
         GROUP BY g.id
         ORDER BY g.name
      `),

      // Global stats
      db.get(`
        SELECT
          COUNT(*)                                                        AS total_plants,
          SUM(CASE WHEN quantity_in_ground > 0 THEN quantity_in_ground ELSE 0 END) AS total_in_ground,
          SUM(CASE WHEN status = 'planned'    THEN 1 ELSE 0 END)        AS planned_count,
          SUM(CASE WHEN status = 'purchased'  THEN 1 ELSE 0 END)        AS purchased_count,
          SUM(CASE WHEN status = 'planted'    THEN 1 ELSE 0 END)        AS planted_count,
          SUM(CASE WHEN status = 'established' THEN 1 ELSE 0 END)       AS established_count
        FROM plants
      `),

      // Open tasks (urgent + soon, not completed)
      db.all(`
        SELECT t.*,
               g.name AS garden_name,
               z.name AS zone_name
          FROM tasks t
          LEFT JOIN gardens g ON g.id = t.garden_id
          LEFT JOIN zones   z ON z.id = t.zone_id
         WHERE t.completed = 0
           AND t.priority IN ('urgent', 'soon')
         ORDER BY
           CASE t.priority WHEN 'urgent' THEN 0 ELSE 1 END,
           t.due_date NULLS LAST
         LIMIT 20
      `),

      // Active sourcing pipeline
      db.all(`
        SELECT s.*,
               p.name AS plant_name
          FROM sourcing_items s
          LEFT JOIN plants p ON p.id = s.plant_id
         WHERE s.status IN ('researching', 'ordered')
         ORDER BY
           CASE s.priority WHEN 'urgent' THEN 0 WHEN 'soon' THEN 1 ELSE 2 END,
           CASE s.status WHEN 'ordered' THEN 0 ELSE 1 END,
           s.item_name
         LIMIT 20
      `),

      // Recent plant activities
      db.all(`
        SELECT pa.*,
               p.name        AS plant_name,
               g.name        AS garden_name,
               z.name        AS zone_name
          FROM plant_activities pa
          JOIN plants  p ON p.id = pa.plant_id
          JOIN gardens g ON g.id = p.garden_id
          LEFT JOIN zones z ON z.id = p.zone_id
         ORDER BY pa.occurred_at DESC
         LIMIT 10
      `),

      plantingGuidance.getSnapshot().catch((err) => {
        console.warn('[garden/dashboard] planting guidance:', err.message);
        return null;
      }),
    ]);

    res.json({
      gardens,
      stats,
      open_tasks:         openTasks,
      sourcing_pipeline:  sourcingPipeline,
      recent_activities:  recentActivities,
      planting_guidance: planting_guidance || null,
      /** @deprecated use planting_guidance */
      frost_safe_to_plant: planting_guidance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
