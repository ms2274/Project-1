#!/usr/bin/env python3
"""
Daily morning weather email for New Jersey.
Fetches weather from Open-Meteo (free, no API key needed) and sends via Gmail SMTP.

Setup:
  1. Copy .env.example to .env and fill in your credentials
  2. For Gmail, use an App Password (not your regular password):
     https://myaccount.google.com/apppasswords
  3. Run: python weather_email.py
  4. Schedule with cron: crontab -e
     Add: 0 7 * * * /path/to/venv/bin/python /path/to/weather_email.py

Environment variables (set in .env):
  EMAIL_SENDER    - Gmail address sending the email
  EMAIL_PASSWORD  - Gmail App Password
  EMAIL_RECIPIENT - Address to receive the email
  WEATHER_CITY    - City name (default: Newark)
  WEATHER_STATE   - State abbreviation (default: NJ)
  WEATHER_LAT     - Latitude (default: 40.7282 for Newark, NJ)
  WEATHER_LON     - Longitude (default: -74.1769 for Newark, NJ)
  TIMEZONE        - Timezone string (default: America/New_York)
"""

import os
import sys
import smtplib
import requests
from datetime import datetime, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
EMAIL_SENDER = os.environ["EMAIL_SENDER"]
EMAIL_PASSWORD = os.environ["EMAIL_PASSWORD"]
EMAIL_RECIPIENT = os.getenv("EMAIL_RECIPIENT", EMAIL_SENDER)
WEATHER_CITY = os.getenv("WEATHER_CITY", "Newark")
WEATHER_STATE = os.getenv("WEATHER_STATE", "NJ")
LAT = float(os.getenv("WEATHER_LAT", "40.7282"))
LON = float(os.getenv("WEATHER_LON", "-74.1769"))
TIMEZONE = os.getenv("TIMEZONE", "America/New_York")

# WMO weather code descriptions
WMO_CODES = {
    0: ("Clear Sky", "☀️"),
    1: ("Mainly Clear", "🌤️"),
    2: ("Partly Cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Foggy", "🌫️"),
    48: ("Icy Fog", "🌫️"),
    51: ("Light Drizzle", "🌦️"),
    53: ("Moderate Drizzle", "🌦️"),
    55: ("Dense Drizzle", "🌧️"),
    61: ("Light Rain", "🌧️"),
    63: ("Moderate Rain", "🌧️"),
    65: ("Heavy Rain", "🌧️"),
    71: ("Light Snow", "🌨️"),
    73: ("Moderate Snow", "❄️"),
    75: ("Heavy Snow", "❄️"),
    77: ("Snow Grains", "🌨️"),
    80: ("Light Showers", "🌦️"),
    81: ("Moderate Showers", "🌧️"),
    82: ("Violent Showers", "⛈️"),
    85: ("Snow Showers", "🌨️"),
    86: ("Heavy Snow Showers", "❄️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm w/ Hail", "⛈️"),
    99: ("Thunderstorm w/ Heavy Hail", "⛈️"),
}


def fetch_weather() -> dict:
    """Fetch current conditions and 7-day forecast from Open-Meteo."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": LAT,
        "longitude": LON,
        "current": [
            "temperature_2m",
            "apparent_temperature",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code",
            "precipitation",
            "cloud_cover",
        ],
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max",
            "sunrise",
            "sunset",
        ],
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": TIMEZONE,
        "forecast_days": 7,
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def wind_direction(degrees: float) -> str:
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[round(degrees / 45) % 8]


def format_time(iso_str: str) -> str:
    """Format ISO datetime string like '2024-04-08T06:32' to '6:32 AM'."""
    dt = datetime.fromisoformat(iso_str)
    return dt.strftime("%-I:%M %p")


def build_html(data: dict) -> str:
    cur = data["current"]
    daily = data["daily"]
    today = date.today()
    day_name = today.strftime("%A, %B %-d, %Y")

    code = cur["weather_code"]
    desc, emoji = WMO_CODES.get(code, ("Unknown", "🌡️"))
    temp = round(cur["temperature_2m"])
    feels = round(cur["apparent_temperature"])
    humidity = cur["relative_humidity_2m"]
    wind_spd = round(cur["wind_speed_10m"])
    wind_dir = wind_direction(cur["wind_direction_10m"])
    precip = cur["precipitation"]

    sunrise = format_time(daily["sunrise"][0])
    sunset = format_time(daily["sunset"][0])
    high = round(daily["temperature_2m_max"][0])
    low = round(daily["temperature_2m_min"][0])
    rain_chance = daily["precipitation_probability_max"][0]

    # Build forecast rows (next 6 days, skip today)
    forecast_rows = ""
    day_abbrevs = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for i in range(1, 7):
        dt = datetime.strptime(daily["time"][i], "%Y-%m-%d")
        day_abbr = dt.strftime("%a")
        d_code = daily["weather_code"][i]
        d_emoji = WMO_CODES.get(d_code, ("", "🌡️"))[1]
        d_desc = WMO_CODES.get(d_code, ("Unknown", ""))[0]
        d_high = round(daily["temperature_2m_max"][i])
        d_low = round(daily["temperature_2m_min"][i])
        d_rain = daily["precipitation_probability_max"][i]
        forecast_rows += f"""
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;">{day_abbr}</td>
          <td style="padding:8px 12px;font-size:1.2em;">{d_emoji}</td>
          <td style="padding:8px 12px;color:#6b7280;">{d_desc}</td>
          <td style="padding:8px 12px;font-weight:600;color:#1f2937;">{d_high}°</td>
          <td style="padding:8px 12px;color:#6b7280;">{d_low}°</td>
          <td style="padding:8px 12px;color:#3b82f6;">💧 {d_rain}%</td>
        </tr>"""

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Weather</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 28px;color:#fff;">
      <div style="font-size:0.85em;opacity:0.85;letter-spacing:0.05em;text-transform:uppercase;">{day_name}</div>
      <div style="font-size:0.9em;opacity:0.9;margin-top:4px;">📍 {WEATHER_CITY}, {WEATHER_STATE}</div>
      <div style="display:flex;align-items:center;margin-top:16px;">
        <div style="font-size:5em;line-height:1;">{emoji}</div>
        <div style="margin-left:20px;">
          <div style="font-size:3.5em;font-weight:700;line-height:1;">{temp}°F</div>
          <div style="font-size:1em;opacity:0.9;margin-top:4px;">{desc}</div>
        </div>
      </div>
    </div>

    <!-- Today's details -->
    <div style="padding:24px 28px;">
      <h2 style="margin:0 0 16px;font-size:1em;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Today's Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;">🌡️ Feels Like</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;text-align:right;">{feels}°F</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;">📈 High / 📉 Low</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;text-align:right;">{high}° / {low}°</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;">💧 Rain Chance</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;text-align:right;">{rain_chance}%</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;">💦 Humidity</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;text-align:right;">{humidity}%</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;">💨 Wind</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;text-align:right;">{wind_spd} mph {wind_dir}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;">🌅 Sunrise</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-weight:600;color:#1f2937;text-align:right;">{sunrise}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#374151;">🌇 Sunset</td>
          <td style="padding:10px 0;font-weight:600;color:#1f2937;text-align:right;">{sunset}</td>
        </tr>
      </table>
    </div>

    <!-- 6-day forecast -->
    <div style="padding:0 28px 28px;">
      <h2 style="margin:0 0 12px;font-size:1em;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">6-Day Forecast</h2>
      <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
        <table style="width:100%;border-collapse:collapse;">
          {forecast_rows}
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 28px;text-align:center;font-size:0.75em;color:#9ca3af;border-top:1px solid #e5e7eb;">
      Weather data from <a href="https://open-meteo.com" style="color:#6b7280;">Open-Meteo</a> •
      Have a great day! 🌟
    </div>

  </div>
</body>
</html>
"""


def send_email(html_body: str, subject: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_SENDER
    msg["To"] = EMAIL_RECIPIENT
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, EMAIL_RECIPIENT, msg.as_string())


def main():
    print(f"Fetching weather for {WEATHER_CITY}, {WEATHER_STATE}...")
    try:
        data = fetch_weather()
    except requests.RequestException as e:
        print(f"Failed to fetch weather: {e}", file=sys.stderr)
        sys.exit(1)

    cur = data["current"]
    code = cur["weather_code"]
    desc, emoji = WMO_CODES.get(code, ("", "🌡️"))
    temp = round(cur["temperature_2m"])
    high = round(data["daily"]["temperature_2m_max"][0])
    low = round(data["daily"]["temperature_2m_min"][0])

    today = date.today()
    subject = f"{emoji} {WEATHER_CITY} Weather — {temp}°F, {desc} | {today.strftime('%a %b %-d')}"

    html = build_html(data)

    print(f"Sending email to {EMAIL_RECIPIENT}...")
    try:
        send_email(html, subject)
        print("Email sent successfully!")
    except smtplib.SMTPException as e:
        print(f"Failed to send email: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
