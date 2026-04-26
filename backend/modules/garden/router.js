/**
 * Garden module router
 * Mounts all garden sub-routes under /api/garden
 *
 * Existing routes (v1):
 *   seeds, activities, plantings, whats-growing, images
 *
 * New routes added here as Steps 1–5 are implemented:
 *   gardens, zones, plants, plant-activities, tasks, sourcing, dashboard
 */
const express = require('express');
const router = express.Router();

router.use('/', require('./routes/seeds'));
router.use('/', require('./routes/activities'));
router.use('/', require('./routes/plantings'));

// v2 routes
router.use('/', require('./routes/gardens'));
router.use('/', require('./routes/zones'));
router.use('/', require('./routes/plants'));
router.use('/', require('./routes/tasks'));
router.use('/', require('./routes/sourcing'));
router.use('/', require('./routes/dashboard'));

module.exports = router;
