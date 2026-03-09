"""
Weather bridge: UDP listener for Tempest (50222) + Ollama LLM → Flask /weather on :5000.
Node ai-bridge hits /weather; optional ?nws=EventName and ?nws_headline=... are used in the
LLM prompt for factual, condition-focused summaries that include NWS watches/warnings.
"""
import json
import re
import socket
import threading
import time
from datetime import datetime

import ollama
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

weather_store = {
    "temp": 0,
    "humidity": 0,
    "pressure": 0,
    "lux": 0,
    "precip": 0,
    "wind": 0,
    "condition": "Waiting for Station...",
    "ai_prompt": "Initializing art engine...",
    "ai_prompt_generated_at": None,  # Unix timestamp when ai_prompt was last set
}

nws_for_prompt = None      # set by get_weather() when Node sends ?nws=
nws_headline_for_prompt = None  # set when Node sends ?nws_headline=; used in generate_ai_prompt
corrected_condition_for_prompt = None  # set when Node sends ?corrected_condition= (user-corrected, e.g. Snow)
manual_precip_in_for_prompt = None  # set when Node sends ?manual_precip_in= (manual precip today, inches)
request_hour_for_prompt = None  # optional ?hour= from backend (0–23) so period is correct if Pi clock/TZ is off
bad_examples_for_prompt = []   # set when Node sends ?bad_examples= JSON array of thumbs-down descriptions
good_examples_for_prompt = []  # set when Node sends ?good_examples= JSON array of user rewrites
data_ready_event = threading.Event()
# (timestamp, pressure_mb) for trend; keep last 30. UDP appends; generate_ai_prompt reads.
_pressure_history = []
# (timestamp, temp_c) for temperature trend; keep last 10 readings (last ~10 minutes)
_temp_history = []
# Recent ai_prompt phrases to avoid repetition (last 5, normalized for comparison)
_recent_phrases = []  # List of normalized strings (lowercase, punctuation removed)
last_ai_error = None       # last Ollama/LLM exception message, for debugging

# Use 270m for now (reliable on Pi); switch to gemma3:1b after: ollama pull gemma3:1b
OLLAMA_MODEL = "gemma3:270m"

# Ollama options to reduce repetition and limit output length
OLLAMA_OPTIONS_BASE = {"temperature": 0.5, "repeat_penalty": 1.15, "num_predict": 50}
OLLAMA_OPTIONS_RETRY = {"temperature": 0.6, "repeat_penalty": 1.2, "num_predict": 50}

def calculate_condition(lux, precip, temp, humidity):
    if temp <= 2 and humidity > 85:
        return "Snow Possible"
    if precip > 0:
        return "Snowing" if temp <= 1 else "Raining"
    if lux > 40000:
        return "Sunny"
    if lux > 10000:
        return "Partly Cloudy"
    if lux > 1000:
        return "Overcast"
    return "Night" if lux < 500 else "Cloudy"


def udp_listener():
    global weather_store
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(5)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.bind(("", 50222))
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print("UDP 50222 in use (another bridge or service). /weather will work; no live Tempest UDP.")
            data_ready_event.set()
            return
        raise
    try:
        while True:
            try:
                data, _ = s.recvfrom(1024)
                packet = json.loads(data)
                if packet.get("type") == "obs_st":
                    obs = packet["obs"][0]
                    weather_store.update({
                        "pressure": obs[6],
                        "temp": obs[7],
                        "humidity": obs[8],
                        "lux": obs[9],
                        "precip": obs[12],
                        "wind": obs[2],
                        "condition": calculate_condition(obs[9], obs[12], obs[7], obs[8]),
                    })
                    _pressure_history.append((time.time(), float(obs[6])))
                    _pressure_history[:] = _pressure_history[-30:]
                    _temp_history.append((time.time(), float(obs[7])))
                    _temp_history[:] = _temp_history[-10:]  # Keep last 10 temp readings
                    data_ready_event.set()
            except Exception:
                continue
    finally:
        s.close()


def _is_condition_only(text, condition):
    """True if text is only the condition name (e.g. 'Night.' or 'Sunny')."""
    if not text or not condition:
        return False
    t = text.rstrip(".").strip().lower()
    c = (condition or "").lower()
    return t == c


def _has_numbers(text):
    """True if text contains digits or % (forbidden in output)."""
    if not text:
        return False
    return any(c.isdigit() for c in text) or "%" in text


def _starts_with_weather_is(text):
    """True if text starts with 'The weather is' or 'Weather is' (forbidden)."""
    if not text or not isinstance(text, str):
        return False
    t = text.strip().lower()
    return t.startswith("the weather is ") or t.startswith("weather is ")


def _has_humid(text):
    """True if text contains 'humid' (forbidden; use 'damp', 'moist', or 'soggy' for cold/wet)."""
    if not text or not isinstance(text, str):
        return False
    return bool(re.search(r"\bhumid\b", text.lower()))


def _has_calm(text):
    """True if text contains calm/peaceful/gentle/quiet (forbidden; too vague)."""
    if not text or not isinstance(text, str):
        return False
    return bool(re.search(r"\b(calm|peaceful|gentle|quiet)\b", text.lower()))


def _has_wrong_time_phrase(text, current_hour):
    """True if text contains 'this morning/afternoon/evening' at the wrong time of day."""
    if not text or not isinstance(text, str) or not isinstance(current_hour, int):
        return False
    t = text.lower()
    has_morning = bool(re.search(r"\bthis morning\b", t))
    has_afternoon = bool(re.search(r"\bthis afternoon\b", t))
    has_evening = bool(re.search(r"\bthis evening\b", t))
    if not (has_morning or has_afternoon or has_evening):
        return False
    # Morning: 0-11 (midnight to 11:59 AM)
    if has_morning and not (0 <= current_hour < 12):
        return True
    # Afternoon: 12-16 (noon to 4:59 PM)
    if has_afternoon and not (12 <= current_hour < 17):
        return True
    # Evening: 17-20 (5 PM to 8:59 PM)
    if has_evening and not (17 <= current_hour < 21):
        return True
    return False


def _normalize_phrase(text):
    """Normalize phrase for repetition detection: lowercase, remove punctuation, extra spaces."""
    if not text or not isinstance(text, str):
        return ""
    # Remove punctuation, normalize spaces, lowercase
    normalized = re.sub(r'[^\w\s]', '', text.lower())
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized


def _strip_quotes(text):
    """Remove surrounding quotes (single or double) from text if present."""
    if not text or not isinstance(text, str):
        return text
    text = text.strip()
    # Remove surrounding double quotes
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        text = text[1:-1].strip()
    # Remove surrounding single quotes
    if len(text) >= 2 and text[0] == "'" and text[-1] == "'":
        text = text[1:-1].strip()
    return text


def _clean_llm_response(text):
    """Clean LLM response by removing meta-commentary and extracting the actual phrase."""
    if not text or not isinstance(text, str):
        return text
    
    text = text.strip()
    
    # Remove common LLM meta-commentary prefixes (expanded to catch more variants)
    prefixes_to_remove = [
        r"^Here's a vivid, memorable phrase.*?:",
        r"^Here is a.*?:",
        r"^A vivid phrase.*?:",
        r"^The phrase.*?:",
        r"^Here's a revised response.*?:",
        r"^Here's a descriptive.*?:",
        r"^Here's.*?:",
        r"^Revised response.*?:",
        r"^Adhering to.*?:",
    ]
    for pattern in prefixes_to_remove:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()
    
    # If response contains a colon, take everything after the last colon (the actual phrase)
    if ":" in text:
        parts = text.split(":")
        if len(parts) > 1:
            # Take the last part after colon, which is usually the actual phrase
            text = parts[-1].strip()
    
    # Strip quotes after cleaning
    text = _strip_quotes(text)
    
    return text


def _has_meta_commentary(text):
    """True if text looks like meta-commentary (instructions/explanations) rather than a weather phrase."""
    if not text or not isinstance(text, str) or len(text) < 10:
        return False
    t = text.strip().lower()
    # Phrases that indicate the LLM is explaining or instructing instead of outputting the phrase
    meta_patterns = [
        r"^here'?s?\s+(a\s+)?(revised|descriptive|vivid|short)",
        r"^here\s+is\s+(a\s+)?",
        r"^a\s+vivid\s+phrase",
        r"^the\s+phrase\s+(is|would\s+be)",
        r"adhering\s+to\s+(the\s+)?(specified\s+)?requirements",
        r"^revised\s+response",
        r"^following\s+(your\s+)?(instructions|requirements)",
    ]
    return any(re.search(p, t) for p in meta_patterns)


def _is_too_similar_to_recent(text, threshold=0.7):
    """True if text is too similar (≥threshold) to any recent phrase. Uses simple word overlap."""
    if not text or not _recent_phrases:
        return False
    normalized = _normalize_phrase(text)
    if not normalized:
        return False
    words = set(normalized.split())
    if not words:
        return False
    for recent in _recent_phrases:
        if not recent:
            continue
        recent_words = set(recent.split())
        if not recent_words:
            continue
        # Jaccard similarity (intersection over union)
        intersection = len(words & recent_words)
        union = len(words | recent_words)
        if union == 0:
            continue
        similarity = intersection / union
        if similarity >= threshold:
            return True
    return False


def _contradicts_nws(text, nws_active):
    """True if NWS is active and output uses calm/peaceful/gentle/quiet (contradicts severity)."""
    if not nws_active or not text or not isinstance(text, str):
        return False
    return bool(re.search(r"\b(calm|peaceful|gentle|quiet)\b", text.lower()))


def generate_ai_prompt():
    global weather_store, nws_for_prompt, nws_headline_for_prompt, corrected_condition_for_prompt, manual_precip_in_for_prompt, request_hour_for_prompt, bad_examples_for_prompt, good_examples_for_prompt, last_ai_error
    data_ready_event.wait()
    while True:
        try:
            s_msg = (
                "You are an avid weather watcher and meteorologist. Write a vivid, memorable phrase that captures the feel and atmosphere—not a recap of data. "
                "Output exactly ONE sentence. Maximum 15 words. "
                "Forbidden: numbers, percentages, measurements (no °F, °C, %, mm, m/s). The data are for context only. "
                "Forbidden: replying with only the condition name (e.g. 'Night.' 'Sunny.' 'Partly Cloudy.'). "
                "PREFERRED STYLE: Start directly with descriptive language rather than 'The weather is' or 'Weather is'. Examples: 'Raw, numbing cold under leaden skies.' or 'Dreary, bone-chilling damp.' not 'The weather is cold and clear.' "
                "However, if you must use 'The weather is', ensure the rest of the phrase is vivid and evocative—not generic. "
                "IMPORTANT: Do NOT wrap your response in quotes. Do NOT include explanatory text like 'Here's a phrase:', 'Here's a revised response', 'The phrase is:', or any meta-commentary. Output ONLY the weather phrase itself, nothing else. "
                "Forbidden: the word 'humid' — it describes warm, moist air. For cold and wet use 'damp', 'moist', or 'soggy'. For warm and wet use 'muggy' or 'sticky'. Never use 'humid'. "
                "Forbidden: 'calm', 'peaceful', 'gentle', or 'quiet' — these are too vague. Use specific descriptors like 'still', 'breezy', 'windy', 'gusty', or describe the actual conditions. "
                "STYLE: Use evocative, sensory language. Avoid generic recaps. Instead of 'cold and overcast', try 'raw, numbing cold' or 'dreary, bone-chilling damp'. "
                "Instead of 'hot and wet', try 'sticky, oppressive heat' or 'muggy, sweltering'. Instead of 'cold, rain, and fog', try 'dreary, bone-chilling damp' or 'raw, misty cold'. "
                "Temperature descriptors: Very cold (≤32°F/0°C): 'bitterly arctic', 'bone-chilling', 'frigid', 'raw'. Cold (33-50°F/1-10°C): 'chilly', 'brisk', 'crisp', 'sharp'. "
                "Cool (51-65°F/11-18°C): 'mild', 'temperate', 'pleasant'. Warm (66-80°F/19-27°C): 'warm', 'balmy', 'mild'. Hot (81-95°F/28-35°C): 'sticky', 'muggy', 'sweltering', 'oppressive'. "
                "Very hot (≥96°F/36°C): 'scorching', 'blistering', 'oppressive heat'. "
                "If user-corrected condition OR sensor condition is Snow, Snowing, or Snow Possible, you MUST mention snow; never say partly cloudy or clear in that case. "
                "When NWS alert, pressure trend, or user-corrected condition are given, weave them in briefly; interpret, don't just repeat. "
                "CRITICAL: When an NWS watch, warning, or advisory is active, your phrase MUST reflect that severity. Use active, descriptive language that matches the alert's intensity."
            )
            now = datetime.now()
            # Use ?hour= from last /weather request if present (backend sends it); else Pi local
            h = request_hour_for_prompt if isinstance(request_hour_for_prompt, int) and 0 <= request_hour_for_prompt <= 23 else now.hour
            is_daytime = 6 <= h < 18  # 6 AM–6 PM
            # Explicit period so the LLM does not default to "this morning" in afternoon/evening
            # Morning: 0-11 (midnight to 11:59 AM), Afternoon: 12-16 (noon to 4:59 PM), Evening: 17-20 (5 PM to 8:59 PM), Night: 21-23 (9 PM to 11:59 PM)
            if 0 <= h < 12:
                period = "morning (midnight to 11:59 AM)"
            elif 12 <= h < 17:
                period = "afternoon (noon to 4:59 PM)"
            elif 17 <= h < 21:
                period = "evening (5 PM to 8:59 PM)"
            else:
                period = "night (9 PM to 11:59 PM)"
            time_phrase = "Local time: {}. It is {} — {}.".format(
                now.strftime("%I:%M %p").lstrip("0"),
                "daytime" if is_daytime else "nighttime",
                period,
            )
            # Time-of-day instruction: be very explicit about when to use phrases
            if 0 <= h < 12:
                time_instruction = " You MAY use 'this morning' ONLY because it is morning (midnight to 11:59 AM). Do NOT use 'this afternoon' or 'this evening'. Do NOT say 'at night' or 'nighttime'."
            elif 12 <= h < 17:
                time_instruction = " You MAY use 'this afternoon' ONLY because it is afternoon (noon to 4:59 PM). Do NOT use 'this morning' or 'this evening'. Do NOT say 'at night' or 'nighttime'."
            elif 17 <= h < 21:
                time_instruction = " You MAY use 'this evening' ONLY because it is evening (5 PM to 8:59 PM). Do NOT use 'this morning' or 'this afternoon'. Do NOT say 'at night' or 'nighttime'."
            else:
                time_instruction = " It is nighttime (9 PM to 11:59 PM). Do NOT use 'this morning', 'this afternoon', or 'this evening'. You MAY say 'at night' or 'tonight' if relevant, but prefer describing conditions directly without time phrases."
            # Pressure trend from recent UDP readings (need 5+ min span)
            pressure_trend = None
            if len(_pressure_history) >= 2 and (_pressure_history[-1][0] - _pressure_history[0][0]) >= 300:
                delta = _pressure_history[-1][1] - _pressure_history[0][1]
                pressure_trend = "falling" if delta < -0.5 else ("rising" if delta > 0.5 else "steady")
            
            # Temperature trend (warming/cooling over last 10 minutes)
            temp_trend = None
            if len(_temp_history) >= 3 and (_temp_history[-1][0] - _temp_history[0][0]) >= 300:
                delta_temp = _temp_history[-1][1] - _temp_history[0][1]
                temp_trend = "warming" if delta_temp > 0.5 else ("cooling" if delta_temp < -0.5 else "stable")
            
            temp_c = weather_store.get("temp") or 0
            temp_f = (temp_c * 9/5) + 32
            hum = weather_store.get("humidity") or 0
            wind = weather_store.get("wind") or 0
            precip = weather_store.get("precip") or 0
            lux_val = weather_store.get("lux") or 0
            
            # Time-of-day context (dawn, midday, dusk, deep night)
            time_context = ""
            if 5 <= h < 7:
                time_context = "Dawn/early morning: 'first light', 'breaking dawn', 'early morning'. "
            elif 7 <= h < 10:
                time_context = "Morning: 'morning light', 'daybreak', 'morning'. "
            elif 10 <= h < 12:
                time_context = "Late morning: 'late morning', 'approaching noon'. "
            elif 12 <= h < 14:
                time_context = "Midday: 'midday', 'noon', 'peak sun'. "
            elif 14 <= h < 17:
                time_context = "Afternoon: 'afternoon', 'mid-afternoon'. "
            elif 17 <= h < 19:
                time_context = "Dusk/evening: 'dusk', 'evening light', 'golden hour', 'twilight'. "
            elif 19 <= h < 22:
                time_context = "Evening: 'evening', 'nightfall'. "
            elif 22 <= h < 24 or 0 <= h < 5:
                time_context = "Deep night: 'deep night', 'late night', 'night', 'dark'. "
            
            # Light quality descriptors
            light_quality = ""
            if lux_val >= 80000:
                light_quality = "Intense sunlight: 'harsh', 'bright', 'brilliant', 'intense'. "
            elif lux_val >= 40000:
                light_quality = "Strong sunlight: 'bright', 'clear', 'sunny', 'strong light'. "
            elif lux_val >= 10000:
                light_quality = "Moderate light: 'soft light', 'filtered', 'diffuse'. "
            elif lux_val >= 1000:
                light_quality = "Dim light: 'dim', 'muted', 'gray light'. "
            elif lux_val >= 100:
                light_quality = "Very dim: 'dusky', 'shadowy', 'low light'. "
            else:
                light_quality = "Dark: 'dark', 'black', 'pitch dark'. "
            
            # Seasonal context (month-based, approximate)
            month = now.month
            if month in (12, 1, 2):
                seasonal = "Winter season. "
            elif month in (3, 4, 5):
                seasonal = "Spring season. "
            elif month in (6, 7, 8):
                seasonal = "Summer season. "
            else:
                seasonal = "Fall season. "
            
            # Temperature-based guidance
            if temp_f <= 32:
                temp_guidance = "Very cold (≤32°F): Use 'bitterly arctic', 'bone-chilling', 'frigid', 'raw', 'numbing cold'. "
            elif temp_f <= 50:
                temp_guidance = "Cold (33-50°F): Use 'chilly', 'brisk', 'crisp', 'sharp', 'cool'. "
            elif temp_f <= 65:
                temp_guidance = "Cool (51-65°F): Use 'mild', 'temperate', 'pleasant', 'moderate'. "
            elif temp_f <= 80:
                temp_guidance = "Warm (66-80°F): Use 'warm', 'balmy', 'mild', 'pleasant'. "
            elif temp_f <= 95:
                temp_guidance = "Hot (81-95°F): Use 'sticky', 'muggy', 'sweltering', 'oppressive', 'sultry'. "
            else:
                temp_guidance = "Very hot (≥96°F): Use 'scorching', 'blistering', 'oppressive heat', 'searing'. "
            
            # Humidity + temperature combinations
            if hum >= 85:
                if temp_f <= 50:
                    hum_guidance = "High humidity + cold = 'damp', 'soggy', 'raw', 'bone-chilling damp', 'dreary'. "
                elif temp_f >= 75:
                    hum_guidance = "High humidity + warm = 'sticky', 'muggy', 'oppressive', 'sultry', 'sweltering'. "
                else:
                    hum_guidance = "High humidity = 'damp', 'moist', 'muggy'. "
            else:
                hum_guidance = ""
            
            # Wind descriptors
            if wind < 1:
                wind_guidance = "No wind: 'still', 'dead calm', 'airless'. "
            elif wind < 3:
                wind_guidance = "Light wind: 'gentle breeze', 'slight breeze', 'barely stirring'. "
            elif wind < 7:
                wind_guidance = "Moderate wind: 'breezy', 'stirring', 'moving air'. "
            elif wind < 12:
                wind_guidance = "Strong wind: 'windy', 'gusty', 'blowing'. "
            else:
                wind_guidance = "Very strong wind: 'howling', 'blustery', 'fierce winds'. "
            
            # Precipitation + condition combinations
            precip_guidance = ""
            if precip > 0 or (corrected_condition_for_prompt and "snow" in str(corrected_condition_for_prompt).lower()):
                if temp_f <= 32:
                    precip_guidance = "Cold + precip: 'snow', 'wintry mix', 'freezing rain', 'sleet'. "
                elif temp_f <= 50:
                    precip_guidance = "Cool + precip: 'chilly rain', 'damp', 'wet', 'drizzle'. "
                else:
                    precip_guidance = "Warm + precip: 'rain', 'showers', 'wet'. "
            
            # Sky condition descriptors
            condition_lower = str(weather_store.get("condition") or "").lower()
            if "overcast" in condition_lower or lux_val < 1000:
                sky_guidance = "Overcast/dark: 'gray', 'dreary', 'leaden', 'gloomy', 'dull'. "
            elif "partly" in condition_lower or (1000 <= lux_val < 10000):
                sky_guidance = "Partly cloudy: 'patchy clouds', 'mixed skies', 'variable'. "
            elif lux_val >= 40000:
                sky_guidance = "Sunny: 'bright', 'clear', 'sunny', 'brilliant'. "
            else:
                sky_guidance = ""
            
            hum_note = " Humidity is very high." if hum >= 95 else (" Humidity is high." if hum >= 85 else "")
            pt = f" Pressure trend: {pressure_trend}." if pressure_trend else ""
            cc = f" User-corrected condition: {corrected_condition_for_prompt}. Prefer this over the sensor condition for precipitation or sky." if corrected_condition_for_prompt else ""
            mp = f" Manual precip today: {manual_precip_in_for_prompt} in." if manual_precip_in_for_prompt is not None else ""
            
            # Recent phrases context (to avoid repetition)
            recent_context = ""
            if _recent_phrases:
                recent_context = f" Recent phrases to AVOID repeating (vary your language): {', '.join(_recent_phrases[-3:])}. "
            
            # Temperature trend context
            temp_trend_context = ""
            if temp_trend == "warming":
                temp_trend_context = "Temperature is rising (warming trend). "
            elif temp_trend == "cooling":
                temp_trend_context = "Temperature is falling (cooling trend). "
            
            # Pressure feeling descriptors
            pressure_feeling = ""
            if pressure_trend == "falling":
                pressure_feeling = "Pressure falling: can feel 'heavy', 'oppressive', 'building', 'tense'. "
            elif pressure_trend == "rising":
                pressure_feeling = "Pressure rising: can feel 'lighter', 'clearing', 'lifting'. "
            
            # Diverse example pool (rotate through different styles)
            import random
            example_pool = [
                "Good examples: 'Bitterly arctic air, still and clear.' 'Sticky, oppressive heat with no breeze.' 'Dreary, bone-chilling damp and gray.' 'Crisp, breezy morning with patchy clouds.' ",
                "Good examples: 'Raw, numbing cold under leaden skies.' 'Muggy, sweltering stillness before the storm.' 'Sharp, brisk air with gusty winds.' 'Golden hour warmth fading to cool evening.' ",
                "Good examples: 'Frigid, airless dark with falling pressure.' 'Sultry, oppressive heat, no relief in sight.' 'Chilly, damp mist clinging to everything.' 'Brilliant, clear sky with crisp morning air.' ",
                "Good examples: 'Bone-chilling damp, gray and dreary.' 'Scorching heat, still and airless.' 'Brisk, stirring wind under patchy clouds.' 'Deep night cold, clear and still.' "
            ]
            examples = random.choice(example_pool)
            is_snowy = (corrected_condition_for_prompt and "snow" in (corrected_condition_for_prompt or "").lower()) or (condition_lower in ("snow", "snowing", "snow possible"))
            
            # Bad examples from thumbs-down feedback (passed via ?bad_examples= from backend)
            bad_from_feedback = bad_examples_for_prompt or []
            bad_examples_str = ""
            if bad_from_feedback:
                unique_bad = list(dict.fromkeys(str(x).strip() for x in bad_from_feedback if x and len(str(x).strip()) > 5))[:5]
                if unique_bad:
                    bad_examples_str = " Additional bad examples from user feedback (DO NOT repeat): " + " ".join(f"'{b}'" for b in unique_bad) + ". "
            # Good examples from user rewrites (passed via ?good_examples= from backend)
            good_from_feedback = good_examples_for_prompt or []
            good_examples_str = ""
            if good_from_feedback:
                unique_good = list(dict.fromkeys(str(x).strip() for x in good_from_feedback if x and 5 < len(str(x).strip()) <= 200))[:3]
                if unique_good:
                    good_examples_str = " User-preferred examples from feedback: " + " ".join(f"'{g}'" for g in unique_good) + ". "
            
            # Diverse example pool — avoid overusing any single phrase; rotate styles
            import random
            example_pool = [
                "Good examples: 'Raw, numbing cold under leaden skies.' 'Sticky, oppressive heat with no breeze.' 'Dreary, bone-chilling damp and gray.' 'Crisp, breezy morning with patchy clouds.' ",
                "Good examples: 'Frigid, airless dark with falling pressure.' 'Muggy, sweltering stillness before the storm.' 'Sharp, brisk air with gusty winds.' 'Golden hour warmth fading to cool evening.' ",
                "Good examples: 'Chilly, damp mist clinging to everything.' 'Sultry, oppressive heat, no relief in sight.' 'Brilliant, clear sky with crisp morning air.' 'Bone-chilling damp, gray and dreary.' ",
                "Good examples: 'Scorching heat, still and airless.' 'Brisk, stirring wind under patchy clouds.' 'Deep night cold, clear and still.' 'Gray, dreary damp with a raw edge.' "
            ]
            examples = random.choice(example_pool)
            
            parts = [
                f"Sensor condition: {weather_store['condition']}. "
                f"Temp {temp_c}°C ({temp_f:.1f}°F), humidity {hum}%.{hum_note} "
                f"Wind {wind} m/s, precip {precip} mm. Lux (solar): {lux_val}.{pt}{cc}{mp} "
                f"{time_phrase}{time_instruction} "
                f"{seasonal}{time_context}{light_quality}{temp_trend_context}{pressure_feeling}"
                f"{temp_guidance}{hum_guidance}{wind_guidance}{precip_guidance}{sky_guidance}"
                f"{recent_context}"
                "One sentence, max 15 words, words only — no numbers or percentages. "
                f"{examples}"
                "Bad examples (DO NOT repeat): 'The weather is overcast and humid with light wind.' 'The weather is cold and calm this morning.' (when it's not morning). "
                f"{bad_examples_str}"
                f"{good_examples_str}"
                "Bad: 'The weather is...' (forbidden start). Bad: 'humid' (forbidden word). Bad: 'calm' (forbidden word). Bad: generic recaps like 'cold and overcast' — use evocative language instead. "
                "CRITICAL: Vary your language. Do NOT repeat recent phrases. Use different descriptors, synonyms, and sentence structures. "
                "If you use a time phrase like 'this morning/afternoon/evening', it MUST match the current time period exactly."
            ]
            nws_active = bool(nws_for_prompt or nws_headline_for_prompt)
            if nws_for_prompt:
                parts.append(f" ACTIVE NWS: {nws_for_prompt}. This overrides any calm reading—match the alert's severity.")
            if nws_headline_for_prompt:
                parts.append(f" NWS headline: {nws_headline_for_prompt}")
            if nws_active:
                if is_snowy:
                    parts.append(" Good: 'Snow, damp, and falling pressure with a winter storm warning.' Or: 'Heavy snow and wind.'")
                else:
                    parts.append(" Good: 'Wind building. Winter storm warning in effect.' Or: 'Bracing. Watching an incoming winter storm.'")
            u_msg = "".join(parts)

            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": s_msg},
                    {"role": "user", "content": u_msg},
                ],
                options=OLLAMA_OPTIONS_BASE,
            )
            raw = (response.get("message") or {}).get("content") or ""
            text = raw.strip()
            lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
            value = _clean_llm_response((lines[0] if lines else text) or "")

            # Reject condition-only (e.g. 'Night.') and retry once
            cond = weather_store.get("condition") or ""
            did_condition_only_retry = False
            if value and _is_condition_only(value, cond):
                did_condition_only_retry = True
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": s_msg},
                        {"role": "user", "content": u_msg},
                        {"role": "user", "content": "Your last reply was only the condition name. Wrong. One sentence, max 15 words, words only — no numbers. Do not start with 'The weather is' or 'Weather is'. Do not use 'humid' or 'calm'. Do not use time phrases like 'this morning' unless it's actually morning (0-11 AM). Use evocative language, not generic recaps. Example: 'Raw, numbing cold under leaden skies.' or 'Dreary, bone-chilling damp.'"},
                    ],
                    options=OLLAMA_OPTIONS_RETRY,
                )
                raw = (response.get("message") or {}).get("content") or ""
                text = raw.strip()
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                value = _clean_llm_response((lines[0] if lines else text) or "")

            # If LLM returned empty, retry once with a shorter, more explicit prompt
            from_empty_retry = False
            if not value:
                from_empty_retry = True
                r2 = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": "One short weather phrase, 5–12 words. Words only — no numbers. Do not start with 'The weather is' or 'Weather is'. Forbidden: 'humid' (use 'damp', 'moist', 'soggy', 'muggy', or 'sticky'). Forbidden: 'calm', 'peaceful', 'gentle', 'quiet' (use 'still', 'breezy', 'windy', or specific descriptors). Do not use time phrases unless they match the current hour exactly. Use evocative language. Example: 'Raw, numbing cold under leaden skies.' or 'Dreary, bone-chilling damp.'"},
                        {"role": "user", "content": f"Condition: {cond}. One phrase, words only."},
                    ],
                    options=OLLAMA_OPTIONS_RETRY,
                )
                raw2 = (r2.get("message") or {}).get("content") or ""
                value = _clean_llm_response((raw2.strip().split("\n")[0] if raw2.strip() else "").strip() or "")

            # If output contains 'humid', retry once
            did_humid_retry = False
            if value and _has_humid(value):
                did_humid_retry = True
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": s_msg},
                        {"role": "user", "content": u_msg},
                        {"role": "user", "content": "Your last reply used 'humid'. Wrong. Forbidden word. For cold and wet use 'damp', 'moist', or 'soggy'. For warm and wet use 'muggy' or 'sticky'. Never use 'humid'. Example: 'Gray, damp, and breezy.' or 'Muggy and overcast.'"},
                    ],
                    options=OLLAMA_OPTIONS_BASE,
                )
                raw = (response.get("message") or {}).get("content") or ""
                text = raw.strip()
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                value = _clean_llm_response((lines[0] if lines else text) or "")

            # If output contains 'calm' (always forbidden, not just with NWS), retry once
            did_calm_retry = False
            if value and _has_calm(value):
                did_calm_retry = True
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": s_msg},
                        {"role": "user", "content": u_msg},
                        {"role": "user", "content": "Your last reply used 'calm', 'peaceful', 'gentle', or 'quiet'. Wrong. These words are forbidden—too vague. Use specific descriptors: 'still' (no wind), 'breezy', 'windy', 'gusty', or describe actual conditions. Example: 'Cold and still.' or 'Gray, damp, and breezy.'"},
                    ],
                    options=OLLAMA_OPTIONS_BASE,
                )
                raw = (response.get("message") or {}).get("content") or ""
                text = raw.strip()
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                value = _clean_llm_response((lines[0] if lines else text) or "")

            # Removed: "The weather is" retry - now allowed but discouraged via prompt refinement
            did_weather_is_retry = False

            # If output has wrong time phrase (e.g. "this morning" at 8 PM), retry once
            did_time_phrase_retry = False
            if value and _has_wrong_time_phrase(value, h):
                did_time_phrase_retry = True
                period_desc = "morning (midnight-11:59 AM)" if 0 <= h < 12 else ("afternoon (noon-4:59 PM)" if 12 <= h < 17 else ("evening (5-8:59 PM)" if 17 <= h < 21 else "nighttime (9 PM-11:59 PM)"))
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": s_msg},
                        {"role": "user", "content": u_msg},
                        {"role": "user", "content": f"Your last reply used a wrong time phrase. It is currently {period_desc} (hour {h}). Do NOT use 'this morning' unless it's 0-11 AM. Do NOT use 'this afternoon' unless it's 12-4 PM. Do NOT use 'this evening' unless it's 5-8 PM. If it's nighttime (9 PM-11:59 PM), omit time phrases entirely or use 'tonight'/'at night' only if relevant. Prefer describing conditions directly without time phrases. Use different language than recent phrases. Example: 'Raw, numbing cold under leaden skies.' or 'Dreary, bone-chilling damp.'"},
                    ],
                    options=OLLAMA_OPTIONS_BASE,
                )
                raw = (response.get("message") or {}).get("content") or ""
                text = raw.strip()
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                value = _clean_llm_response((lines[0] if lines else text) or "")

            # If output is too similar to recent phrases, retry once
            did_repetition_retry = False
            if value and _is_too_similar_to_recent(value, threshold=0.7):
                did_repetition_retry = True
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": s_msg},
                        {"role": "user", "content": u_msg},
                        {"role": "user", "content": f"Your last reply was too similar to recent phrases. Vary your language! Use different words, synonyms, and sentence structure. Recent phrases to avoid: {', '.join(_recent_phrases[-3:])}. Be creative and unique. Example: 'Raw, numbing cold under leaden skies.' or 'Muggy, sweltering stillness before the storm.'"},
                    ],
                    options=OLLAMA_OPTIONS_RETRY,
                )
                raw = (response.get("message") or {}).get("content") or ""
                text = raw.strip()
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                value = _clean_llm_response((lines[0] if lines else text) or "")

            # If NWS is active and output says calm/peaceful/gentle/quiet, retry once (redundant but kept for NWS-specific messaging)
            did_contradict_retry = False
            if value and _contradicts_nws(value, nws_active):
                did_contradict_retry = True
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": s_msg},
                        {"role": "user", "content": u_msg},
                        {"role": "user", "content": "Your last reply used 'calm' or similar. An NWS alert is active—that overrides calm. Wrong. The phrase must reflect the alert's severity. Use evocative, intense language. Example: 'Raw, numbing cold with heavy snow and wind.' or 'Dreary, bone-chilling damp with falling pressure.' Do not use calm, peaceful, gentle, or quiet."},
                    ],
                    options=OLLAMA_OPTIONS_BASE,
                )
                raw = (response.get("message") or {}).get("content") or ""
                text = raw.strip()
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
                value = _clean_llm_response((lines[0] if lines else text) or "")

            contradicts = _contradicts_nws(value, nws_active) if value else False
            has_humid_word = _has_humid(value) if value else False
            has_calm_word = _has_calm(value) if value else False
            has_wrong_time = _has_wrong_time_phrase(value, h) if value else False
            is_repetitive = _is_too_similar_to_recent(value, threshold=0.7) if value else False
            has_meta = _has_meta_commentary(value) if value else False
            # Loosened: removed _starts_with_weather_is check - now allowed but discouraged via prompt
            if value and len(value) >= 2 and not _is_condition_only(value, cond) and not _has_numbers(value) and not has_humid_word and not has_calm_word and not has_wrong_time and not is_repetitive and not contradicts and not has_meta:
                weather_store["ai_prompt"] = value
                weather_store["ai_prompt_generated_at"] = int(time.time())
                # Add to recent phrases (keep last 5)
                normalized = _normalize_phrase(value)
                if normalized:
                    _recent_phrases.append(normalized)
                    _recent_phrases[:] = _recent_phrases[-5:]  # Keep last 5
                last_ai_error = None
            else:
                prev = (weather_store.get("ai_prompt") or "").strip()
                reason = "meta-commentary" if has_meta else ("calm/peaceful despite NWS" if contradicts else ("contains 'humid'" if has_humid_word else ("contains 'calm'/forbidden words" if has_calm_word else ("wrong time phrase" if has_wrong_time else ("too similar to recent phrases" if is_repetitive else "empty, too short, condition-only, or contains numbers")))))
                print(f"AI returned {reason}; keeping previous ai_prompt.")
                if not prev or prev == "Initializing art engine...":
                    weather_store["ai_prompt"] = "Condition summary unavailable."
        except Exception as e:
            last_ai_error = str(e)
            print(f"AI Error: {e}")
            prev = (weather_store.get("ai_prompt") or "").strip()
            if not prev or prev == "Initializing art engine...":
                weather_store["ai_prompt"] = "Condition summary unavailable."
        threading.Event().wait(600)


@app.route("/weather")
def get_weather():
    global nws_for_prompt, nws_headline_for_prompt, corrected_condition_for_prompt, manual_precip_in_for_prompt, request_hour_for_prompt, bad_examples_for_prompt, good_examples_for_prompt, last_ai_error
    nws_for_prompt = request.args.get("nws")
    nws_headline_for_prompt = request.args.get("nws_headline")
    corrected_condition_for_prompt = request.args.get("corrected_condition") or None
    raw_bad = request.args.get("bad_examples")
    try:
        bad_examples_for_prompt = json.loads(raw_bad) if raw_bad else []
        if not isinstance(bad_examples_for_prompt, list):
            bad_examples_for_prompt = []
    except (TypeError, ValueError):
        bad_examples_for_prompt = []
    raw_good = request.args.get("good_examples")
    try:
        good_examples_for_prompt = json.loads(raw_good) if raw_good else []
        if not isinstance(good_examples_for_prompt, list):
            good_examples_for_prompt = []
    except (TypeError, ValueError):
        good_examples_for_prompt = []
    rh = request.args.get("hour")
    try:
        request_hour_for_prompt = int(rh) if rh is not None and str(rh).isdigit() and 0 <= int(rh) <= 23 else None
    except (TypeError, ValueError):
        request_hour_for_prompt = None
    raw = request.args.get("manual_precip_in")
    try:
        manual_precip_in_for_prompt = float(raw) if raw not in (None, "") else None
    except (TypeError, ValueError):
        manual_precip_in_for_prompt = None
    out = dict(weather_store)
    out["art_engine_status"] = "waiting_udp" if not data_ready_event.is_set() else "running"
    out["last_ai_error"] = last_ai_error
    out["ollama_model"] = OLLAMA_MODEL
    return jsonify(out)


def _init_mock_obs():
    """For local dev without Pi: populate store and unblock LLM loop so /weather returns real descriptions."""
    import os
    if os.environ.get("USE_MOCK_OBS") != "1":
        return
    global weather_store, _pressure_history, _temp_history
    weather_store.update({
        "temp": 5,
        "humidity": 72,
        "pressure": 1013,
        "lux": 500,
        "precip": 0,
        "wind": 2.5,
        "condition": calculate_condition(500, 0, 5, 72),
    })
    t = time.time()
    for i in range(30):
        _pressure_history.append((t - (30 - i) * 60, 1010 + i * 0.2))
    for i in range(10):
        _temp_history.append((t - (10 - i) * 60, 4 + i * 0.5))
    data_ready_event.set()
    print("USE_MOCK_OBS=1: mock observation loaded; LLM will run without UDP.")


if __name__ == "__main__":
    _init_mock_obs()
    threading.Thread(target=udp_listener, daemon=True).start()
    threading.Thread(target=generate_ai_prompt, daemon=True).start()
    app.run(host="0.0.0.0", port=5000, threaded=True)
