# Google Home Integration Setup

This guide will help you integrate your Tempest Weather Station with Google Home, allowing you to ask questions like:

- "Hey Google, ask Tempest what's the weather"
- "Hey Google, ask Tempest for the temperature"
- "Hey Google, ask Tempest if it's going to rain"

## Prerequisites

- Google account
- Tempest backend server running and accessible via HTTPS
- Ngrok or similar tunnel service (for development) OR deployed server with public URL

## Step 1: Expose Your Backend (Development)

For testing, use ngrok to create a public URL:

```bash
# Install ngrok
# Download from https://ngrok.com/download

# Start ngrok tunnel
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

For production, deploy your backend to:
- Google Cloud Functions
- AWS Lambda
- Heroku
- Your own server with HTTPS

## Step 2: Create Dialogflow Agent

1. Go to [Dialogflow Console](https://dialogflow.cloud.google.com/)
2. Click "Create Agent"
3. Agent settings:
   - Agent name: `Tempest Weather`
   - Default language: `English`
   - Default time zone: Your timezone
4. Click "Create"

## Step 3: Configure Intents

### Intent 1: GetCurrentWeather

1. Click "Create Intent"
2. Intent name: `GetCurrentWeather`
3. Training phrases (add these):
   ```
   what's the weather
   how's the weather
   weather conditions
   current weather
   tell me the weather
   what's it like outside
   ```
4. Scroll down to "Fulfillment"
5. Enable "Webhook call for this intent"
6. Save

### Intent 2: GetTemperature

1. Create another intent: `GetTemperature`
2. Training phrases:
   ```
   what's the temperature
   how hot is it
   how cold is it
   what's the temp
   temperature outside
   ```
3. Enable webhook
4. Save

### Intent 3: GetForecast

1. Create intent: `GetForecast`
2. Training phrases:
   ```
   what's the forecast
   forecast for today
   forecast for tomorrow
   weather forecast
   what's the weather going to be like
   ```
3. Add parameter:
   - Parameter name: `timeframe`
   - Entity: `@sys.date-time`
   - Value: `$timeframe`
4. Enable webhook
5. Save

### Intent 4: GetPrecipitation

1. Create intent: `GetPrecipitation`
2. Training phrases:
   ```
   is it going to rain
   will it rain
   chance of rain
   is it raining
   precipitation
   ```
3. Enable webhook
4. Save

### Intent 5: GetWindConditions

1. Create intent: `GetWindConditions`
2. Training phrases:
   ```
   how windy is it
   wind speed
   wind conditions
   is it windy
   ```
3. Enable webhook
4. Save

## Step 4: Configure Fulfillment Webhook

1. In Dialogflow, click "Fulfillment" in left menu
2. Enable "Webhook"
3. Enter URL: `https://your-backend-url/webhooks/google-home`
   - For ngrok: `https://abc123.ngrok.io/webhooks/google-home`
4. Click "Save"

## Step 5: Test in Dialogflow

1. Click "Try it now" in the right panel
2. Type: "what's the weather"
3. You should see a response from your webhook

## Step 6: Create Actions on Google Project

1. Go to [Actions Console](https://console.actions.google.com/)
2. Click "New Project"
3. Project name: `Tempest Weather`
4. Click "Create Project"
5. Choose "Custom" → "Build your Action"

## Step 7: Link Dialogflow to Actions

1. In Actions Console, go to "Develop" → "Invocation"
2. Set Display name: `Tempest`
3. Go to "Develop" → "Actions"
4. Click "Add your first action"
5. Choose "Custom intent"
6. Add intent: `GetCurrentWeather`
7. Repeat for other intents

## Step 8: Configure Action Settings

### Invocation

Set what users say to start your action:
- Display name: `Tempest`
- Pronunciation (optional): `tem-pest`

Users will say: "Hey Google, ask Tempest what's the weather"

### Directory Information

1. Go to "Deploy" → "Directory Information"
2. Fill in required fields:
   - Short description: "Get weather from your Tempest station"
   - Full description: "Get real-time weather data from your personal Tempest Weather Station including temperature, conditions, forecast, and more."
   - Category: Weather
   - Developer name: Your name
   - Developer email: Your email
   - Privacy policy URL: Your privacy policy

### Surface Capabilities

Enable:
- Google Assistant phones
- Smart displays
- Speakers

## Step 9: Test on Google Home

### Test in Simulator

1. In Actions Console, click "Test"
2. Say: "Talk to Tempest"
3. Then: "What's the weather"

### Test on Real Device

1. Make sure you're logged in with the same Google account
2. Say to your Google Home: "Hey Google, talk to Tempest"
3. Then ask: "What's the weather"

## Deployment to Production

### Option 1: Google Cloud Functions

```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Create new project
gcloud projects create tempest-weather

# Set project
gcloud config set project tempest-weather

# Deploy function
gcloud functions deploy tempestWebhook \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point app \
  --source ./backend
```

Update Dialogflow webhook URL to Cloud Function URL.

### Option 2: Deploy to Your Server

1. Set up HTTPS on your server (use Let's Encrypt)
2. Deploy backend with PM2 or Docker
3. Update Dialogflow webhook URL
4. Ensure port 443 is open

## Maintaining Your Integration

### Update Webhook URL

If your ngrok URL changes:
1. Start new ngrok tunnel
2. Copy new HTTPS URL
3. Update in Dialogflow Fulfillment
4. Save

### Monitor Webhook

Check logs:

```bash
# If using PM2
pm2 logs tempest-backend

# If using Cloud Functions
gcloud functions logs read tempestWebhook
```

### Update Responses

Edit responses in `backend/webhooks/google-home.js`:

```javascript
// Example: Change temperature response
async function handleTemperature() {
  const current = await tempestAPI.getCurrentWeather();
  const temp = Math.round(current.temperature.fahrenheit);

  // Customize this message
  return `It's ${temp} degrees outside.`;
}
```

## Privacy & Security

### Privacy Policy Requirements

If publishing publicly, you need a privacy policy covering:
- What data you collect (weather queries, timestamps)
- How you use it (to provide weather information)
- Data retention
- User rights

### Securing Your Webhook

Add authentication:

```javascript
// In google-home.js
router.post('/', (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});
```

In Dialogflow Fulfillment, add header:
- Key: `Authorization`
- Value: `Bearer your_secret_token`

## Troubleshooting

### "I don't understand" responses

1. Check Dialogflow training phrases match what users say
2. Verify webhook is enabled for the intent
3. Check webhook URL is correct and accessible

### Webhook timeout errors

1. Ensure backend responds within 5 seconds
2. Implement caching to speed up responses
3. Check backend logs for errors

### "Tempest isn't available" error

1. Verify webhook URL is accessible publicly
2. Check webhook returns valid JSON
3. Test webhook directly with curl:

```bash
curl -X POST https://your-webhook-url/webhooks/google-home \
  -H "Content-Type: application/json" \
  -d '{
    "queryResult": {
      "intent": {
        "displayName": "GetCurrentWeather"
      }
    }
  }'
```

### Intent not triggering

1. Add more training phrases
2. Check intent is connected to webhook
3. Test in Dialogflow console first

## Example Conversations

```
User: "Hey Google, talk to Tempest"
Google: "Getting the latest from Tempest Weather..."
Assistant: "It's currently 72 degrees with clear skies and 45% humidity."

User: "What's the forecast?"
Assistant: "Today's forecast: partly cloudy with a high of 75 and a low of 62."

User: "Is it going to rain?"
Assistant: "It hasn't rained today. There's a 20% chance of rain later."
```

## Advanced Features

### Add Location Support

Support multiple stations:

```javascript
// Add parameter in Dialogflow
// Entity: @sys.location
// Parameter: location

// In webhook handler
const location = parameters.location;
// Look up station ID based on location
```

### Add Alerts

```javascript
async function handleCurrentWeather() {
  const current = await tempestAPI.getCurrentWeather();
  let response = `It's ${temp} degrees...`;

  // Add weather alerts
  if (current.uv > 7) {
    response += " UV index is high, wear sunscreen.";
  }

  if (current.wind.speed > 20) {
    response += " It's quite windy out there.";
  }

  return response;
}
```

## Publishing Your Action

To make your action available to all Google Home users:

1. Complete all Deploy requirements
2. Submit for review in Actions Console
3. Wait for approval (typically 1-2 weeks)
4. Once approved, anyone can use your action

**Note**: For personal use, you don't need to publish. Just test on devices linked to your Google account.

## Resources

- [Dialogflow Documentation](https://cloud.google.com/dialogflow/docs)
- [Actions on Google Documentation](https://developers.google.com/assistant)
- [Webhook Reference](https://cloud.google.com/dialogflow/docs/fulfillment-webhook)
- [Tempest API Docs](https://weatherflow.github.io/Tempest/api/)
