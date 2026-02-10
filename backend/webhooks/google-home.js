const express = require('express');
const router = express.Router();
const tempestAPI = require('../services/tempest-api');

/**
 * Google Home / Dialogflow Webhook Handler
 * POST /webhooks/google-home
 *
 * Handles voice queries like:
 * - "Hey Google, ask Tempest what's the weather"
 * - "Hey Google, ask Tempest for the temperature"
 * - "Hey Google, ask Tempest if it's going to rain"
 */
router.post('/', async (req, res) => {
  try {
    const intent = req.body.queryResult?.intent?.displayName;
    const parameters = req.body.queryResult?.parameters || {};

    console.log('Dialogflow Intent:', intent);
    console.log('Parameters:', parameters);

    let responseText = '';

    switch (intent) {
      case 'GetCurrentWeather':
        responseText = await handleCurrentWeather();
        break;

      case 'GetTemperature':
        responseText = await handleTemperature();
        break;

      case 'GetForecast':
        responseText = await handleForecast(parameters);
        break;

      case 'GetPrecipitation':
        responseText = await handlePrecipitation();
        break;

      case 'GetWindConditions':
        responseText = await handleWind();
        break;

      default:
        responseText = 'I can check the current weather, temperature, forecast, rain conditions, or wind. What would you like to know?';
    }

    // Send Dialogflow response
    res.json({
      fulfillmentText: responseText,
      source: 'tempest-weather-webhook'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.json({
      fulfillmentText: 'Sorry, I had trouble getting the weather data. Please try again.',
      source: 'tempest-weather-webhook'
    });
  }
});

/**
 * Handle current weather request
 */
async function handleCurrentWeather() {
  const [current, forecast] = await Promise.all([
    tempestAPI.getCurrentWeather(),
    tempestAPI.getForecast()
  ]);

  const temp = Math.round(current.temperature.fahrenheit);
  const feelsLike = Math.round(current.feelsLike.fahrenheit);
  const conditions = forecast.current?.conditions || 'partly cloudy';
  const humidity = Math.round(current.humidity);

  let response = `It's currently ${temp} degrees`;

  if (Math.abs(temp - feelsLike) > 3) {
    response += `, but feels like ${feelsLike}`;
  }

  response += ` with ${conditions} skies and ${humidity}% humidity.`;

  // Add wind info if significant
  if (current.wind.speed > 10) {
    response += ` Winds are ${Math.round(current.wind.speed)} miles per hour from the ${current.wind.directionText}.`;
  }

  return response;
}

/**
 * Handle temperature request
 */
async function handleTemperature() {
  const current = await tempestAPI.getCurrentWeather();

  const temp = Math.round(current.temperature.fahrenheit);
  const feelsLike = Math.round(current.feelsLike.fahrenheit);

  if (Math.abs(temp - feelsLike) > 3) {
    return `The temperature is ${temp} degrees, but it feels like ${feelsLike}.`;
  }

  return `The temperature is ${temp} degrees.`;
}

/**
 * Handle forecast request
 */
async function handleForecast(parameters) {
  const forecast = await tempestAPI.getForecast();

  // Default to today's forecast
  const timeframe = parameters.timeframe || 'today';

  if (timeframe === 'today' && forecast.daily && forecast.daily[0]) {
    const today = forecast.daily[0];
    const high = Math.round(today.temperature.high.fahrenheit);
    const low = Math.round(today.temperature.low.fahrenheit);
    const conditions = today.conditions || 'partly cloudy';
    const precip = today.precipProbability || 0;

    let response = `Today's forecast: ${conditions} with a high of ${high} and a low of ${low}.`;

    if (precip > 30) {
      response += ` There's a ${precip}% chance of precipitation.`;
    }

    return response;
  }

  if (timeframe === 'tomorrow' && forecast.daily && forecast.daily[1]) {
    const tomorrow = forecast.daily[1];
    const high = Math.round(tomorrow.temperature.high.fahrenheit);
    const low = Math.round(tomorrow.temperature.low.fahrenheit);
    const conditions = tomorrow.conditions || 'partly cloudy';

    return `Tomorrow: ${conditions} with a high of ${high} and a low of ${low}.`;
  }

  return 'I can give you the forecast for today or tomorrow. Which would you like?';
}

/**
 * Handle precipitation request
 */
async function handlePrecipitation() {
  const [current, forecast] = await Promise.all([
    tempestAPI.getCurrentWeather(),
    tempestAPI.getForecast()
  ]);

  const rainToday = current.precipitation.today;
  const todayForecast = forecast.daily?.[0];
  const precipChance = todayForecast?.precipProbability || 0;

  let response = '';

  if (rainToday > 0.01) {
    response = `It has rained ${rainToday.toFixed(2)} inches so far today. `;
  } else {
    response = 'It hasn\'t rained today. ';
  }

  if (precipChance > 30) {
    response += `There's a ${precipChance}% chance of rain later.`;
  } else {
    response += 'No rain is expected.';
  }

  return response;
}

/**
 * Handle wind conditions request
 */
async function handleWind() {
  const current = await tempestAPI.getCurrentWeather();

  const windSpeed = Math.round(current.wind.speed);
  const windGust = Math.round(current.wind.gust);
  const direction = current.wind.directionText;

  let response = `Winds are ${windSpeed} miles per hour from the ${direction}`;

  if (windGust > windSpeed + 5) {
    response += ` with gusts up to ${windGust}`;
  }

  response += '.';

  return response;
}

module.exports = router;
