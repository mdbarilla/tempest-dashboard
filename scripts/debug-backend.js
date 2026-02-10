const axios = require('axios');

// Debug script - use TEMPEST_API_TOKEN and TEMPEST_STATION_ID from env
const apiToken = process.env.TEMPEST_API_TOKEN || '';
const stationId = process.env.TEMPEST_STATION_ID || '';
const url = `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${apiToken}`;

axios.get(url)
  .then(response => {
    console.log('API Response:');
    console.log('Has obs?', !!response.data.obs);
    console.log('obs length:', response.data.obs ? response.data.obs.length : 0);
    if (response.data.obs && response.data.obs.length > 0) {
      console.log('First observation:', JSON.stringify(response.data.obs[0], null, 2));
    } else {
      console.log('Full response:', JSON.stringify(response.data, null, 2));
    }
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
