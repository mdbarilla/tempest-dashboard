import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import WeatherIcon from '../components/WeatherIcon';
import './GuestPage.css';

// ─── VISIT CONFIG ──────────────────────────────────────────────────────────────
// Each text field that needs translation is { nl: '...', en: '...' }.
// $ helper (below) picks the right language.
// ──────────────────────────────────────────────────────────────────────────────

const VISIT_ID = 'terry-2026-03-23';

const VISIT = {
  guest: 'Terry',
  dates:    { nl: '23 – 29 maart', en: 'March 23 – 29' },
  greeting: { nl: 'voel je thuis.', en: 'make yourself at home.' },

  homeCity: {
    label: 'Aarhus', country: { nl: 'Denemarken', en: 'Denmark' },
    lat: 56.1567, lon: 10.2108, timezone: 'Europe/Copenhagen',
  },

  wifi: { network: '142plain', password: 'Sophia0505' },
  googleHomeUrl: 'https://home.google.com',

  schedule: [
    {
      day:      { nl: 'Maandag',  en: 'Monday'   },
      date:     { nl: '23 mrt',   en: 'Mar 23'   },
      subtitle: { nl: 'Aankomst', en: 'Arrival'  },
      note:     {
        nl: 'Grote reisdag. We houden het rustig.',
        en: 'Big travel day. We will keep it easy.',
      },
      image: '/guest-images/monday-boston-common.jpg',
      entries: [
        {
          time: { nl: 'Ochtend',  en: 'Morning'   },
          text: {
            nl: 'We staan vroeg op om je van het vliegveld te halen. Brian heeft een tandarts in Copley om 8 uur. We zoeken ergens in de buurt ontbijt in de tussentijd.',
            en: "We'll be up early to grab you from the airport. Brian has a dentist appointment in Copley at 8. We'll grab breakfast somewhere nearby in the meantime.",
          },
        },
        {
          time: { nl: 'Middag',  en: 'Afternoon' },
          text: {
            nl: 'Terug naar Tower Hill om uit te pakken en bij te komen van de vlucht.',
            en: 'Back home to unpack and decompress from the overnight.',
          },
        },
        {
          time: { nl: 'Avond', en: 'Evening' },
          text: {
            nl: 'Rustige avond thuis of ergens vlakbij. Gewoon ontspannen.',
            en: 'Low-key night at home or somewhere close. Just relax.',
          },
        },
      ],
      links: [],
    },
    {
      day:      { nl: 'Dinsdag',  en: 'Tuesday'  },
      date:     { nl: '24 mrt',   en: 'Mar 24'   },
      subtitle: { nl: 'Dag Weg',  en: 'Day Out'  },
      note:     {
        nl: 'Het huis is de hele dag bezet voor schimmelrenovatie. Een goed excuus voor een uitje met Sophia.',
        en: 'The house is off-limits all day for mold abatement. A good excuse for an adventure with Sophia.',
      },
      image: '/guest-images/tuesday-duxbury.jpg',
      entries: [
        {
          time: { nl: 'Ochtend', en: 'Morning' },
          text: {
            nl: 'Vroeg weg. Koffie en ontbijt ergens waar honden welkom zijn.',
            en: 'Out early. Coffee and breakfast somewhere dog-friendly.',
          },
        },
        {
          time: { nl: 'Middag', en: 'Afternoon' },
          text: {
            nl: 'Bay Farm in Duxbury. 80 hectare reservaat op Kingston Bay met zoutmoerassen, cedar grove, rotsachtige richels en 2 km paden. Spectaculair uitzicht. Daarna oesters bij Island Creek Oyster Raw Bar, direct aan het water waar ze worden gekweekt.',
            en: 'Bay Farm in Duxbury. 80 acres on Kingston Bay with salt marsh, cedar grove, rocky ledges, and 2 miles of trails. Spectacular bay views. Then oysters at Island Creek Oyster Raw Bar, right at the water where they grow them.',
          },
        },
        {
          time: { nl: 'Avond', en: 'Evening' },
          text: {
            nl: 'Terug thuis zodra het klaar is. Avondeten nader te bepalen.',
            en: 'Back home once the crew wraps up. Dinner to be decided.',
          },
        },
      ],
      links: [
        { label: 'Bay Farm', href: 'https://sites.google.com/view/kingstonconservation/bay-farm' },
        { label: 'Island Creek Oyster Bar', href: 'https://shop.islandcreekoysters.com/pages/the-raw-bar-at-island-creek-oyster-farm' },
      ],
    },
    {
      day:      { nl: 'Woensdag', en: 'Wednesday' },
      date:     { nl: '25 mrt',   en: 'Mar 25'    },
      subtitle: { nl: 'Lego Dag', en: 'Lego Day'  },
      note:     {
        nl: 'Terry heeft een werkvergadering bij Lego HQ in Boston. De ochtend past zich aan jouw schema aan.',
        en: "Terry has a work meeting at Lego HQ in Boston. Morning is built around your schedule.",
      },
      image: '/guest-images/wednesday-lego.avif',
      entries: [
        {
          time: { nl: 'Ochtend', en: 'Morning' },
          text: {
            nl: 'Flexibel. We kijken wanneer je bij Lego moet zijn.',
            en: 'Flex. We will time it around when you need to be at Lego.',
          },
        },
        {
          time: { nl: 'Middag', en: 'Afternoon' },
          text: {
            nl: 'Jij bent bij Lego HQ. Mark en Brian redden zich. Of we spreken daarna af.',
            en: 'You are at Lego HQ. Mark and Brian will hold it down. Or we meet up after.',
          },
        },
        {
          time: { nl: 'Avond', en: 'Evening' },
          text: {
            nl: "Diner bij Dudley's Chateau in Wayland. Prima buurtrestaurant.",
            en: "Dinner at Dudley's Chateau in Wayland. Great neighborhood spot.",
          },
        },
      ],
      links: [
        { label: 'Lyrik Back Bay', href: 'https://lyrikbackbay.com/about/' },
      ],
    },
    {
      day:      { nl: 'Donderdag',    en: 'Thursday'    },
      date:     { nl: '26 mrt',       en: 'Mar 26'      },
      subtitle: { nl: 'ManRay Nacht', en: 'ManRay Night' },
      note:     {
        nl: 'Brian werkt overdag. De avond staat al vast.',
        en: 'Brian is working during the day. The night is already sorted.',
      },
      image: '/guest-images/thursday-manray-2026.png',
      entries: [
        {
          time: { nl: 'Ochtend', en: 'Morning' },
          text: {
            nl: 'Koffie en een ochtendwandeling met Sophia.',
            en: 'Coffee and a morning walk with Sophia.',
          },
        },
        {
          time: { nl: 'Middag', en: 'Afternoon' },
          text: {
            nl: 'Lokaal winkelen of iets anders dat aanspreekt.',
            en: 'Local shopping or whatever sounds good.',
          },
        },
        {
          time: { nl: 'Avond', en: 'Evening' },
          text: {
            nl: 'Avondeten buiten, dan Daddy-O bij ManRay in Cambridge. Begint om 22:00.',
            en: 'Dinner out, then Daddy-O at ManRay in Cambridge. Starts 10pm.',
          },
        },
      ],
      links: [
        { label: 'ManRay', href: 'https://www.manraynightclub.com' },
      ],
    },
    {
      day:      { nl: 'Vrijdag',    en: 'Friday'    },
      date:     { nl: '27 mrt',     en: 'Mar 27'    },
      subtitle: { nl: 'Jouw keuze', en: 'Your call' },
      note:     {
        nl: 'Brian werkt. Mark en Terry, kies jullie avontuur.',
        en: 'Brian is working. Mark and Terry, pick your adventure.',
      },
      image: '/guest-images/friday-beacon-hill.webp',
      options: [
        {
          title: { nl: 'Bradley Estate',  en: 'Bradley Estate' },
          note:  {
            nl: 'Canton. 30 min. 90 hectare Trustees-landgoed met Italiaanse tuinmuren en bospaden.',
            en: 'Canton. 30 min. 90-acre Trustees property with walled Italian gardens and woodland trails.',
          },
          href: 'https://thetrustees.org/place/eleanor-cabot-bradley-estate/',
        },
        {
          title: { nl: 'Crane Beach',  en: 'Crane Beach' },
          note:  {
            nl: 'Ipswich. 1 uur 15. 8 km strand en duinen. Honden welkom tot eind maart.',
            en: 'Ipswich. 1h 15. Five miles of beach and dunes. Dogs allowed through March.',
          },
          href: 'https://thetrustees.org/place/crane-beach/',
        },
        {
          title: { nl: 'deCordova Sculpture Park', en: 'deCordova Sculpture Park' },
          note:  {
            nl: 'Lincoln. 20 min. Buitenmuseum met hedendaagse sculpturen op 35 hectare terrein langs Sandy Pond.',
            en: 'Lincoln. 20 min. Outdoor museum with contemporary sculptures across 35 acres along Sandy Pond.',
          },
          href: 'https://thetrustees.org/place/decordova/',
        },
        {
          title: { nl: 'Dag in de stad', en: 'City day' },
          note:  {
            nl: 'Boston of Cambridge. Wat er nog op de lijst staat.',
            en: 'Boston or Cambridge. Whatever is still on the list.',
          },
          href: null,
        },
      ],
      entries: [
        {
          time: { nl: 'Avond', en: 'Evening' },
          text: {
            nl: 'Diner buiten of thuis. Afhankelijk van de dag.',
            en: 'Dinner out or at home. Depends on the day.',
          },
        },
      ],
      links: [],
    },
    {
      day:      { nl: 'Zaterdag',      en: 'Saturday'    },
      date:     { nl: '28 mrt',        en: 'Mar 28'      },
      subtitle: { nl: 'Dag in Lincoln', en: 'Lincoln Day' },
      note:     {
        nl: 'Met zijn drieën. Vrije dag, geen agenda.',
        en: 'All three of us. Full day, no agenda.',
      },
      image: '/guest-images/saturday-lamb.jpg',
      entries: [
        {
          time: { nl: 'Ochtend', en: 'Morning' },
          text: {
            nl: 'Brunch bij Twisted Tree Café in Lincoln. Fijn buurtcafé, altijd goed.',
            en: 'Brunch at Twisted Tree Café in Lincoln. Neighborhood spot, always good.',
          },
        },
        {
          time: { nl: 'Middag', en: 'Afternoon' },
          text: {
            nl: 'Drumlin Farm van Mass Audubon: 291 hectare werkende boerderij met schapen, geiten, varkens, koeien en kippens. Wildlife exhibit met uilen, haviken en vossen. 6 km paden. Let op: geen honden. Sophia blijft thuis. Daarna Codman Estate of Gropius House, alles op loopafstand van elkaar.',
            en: 'Drumlin Farm by Mass Audubon. 291 acres, working farm with sheep, goats, pigs, cows, chickens, and a wildlife exhibit with owls, hawks, and foxes. Four miles of trails. No dogs — Sophia sits this one out. Then Codman Estate or Gropius House, all within a mile of each other.',
          },
        },
        {
          time: { nl: 'Avond', en: 'Evening' },
          text: {
            nl: 'Jij kiest. Grote avond uit of een goed diner thuis.',
            en: 'Your call. Big night out or a good dinner at home.',
          },
        },
      ],
      links: [
        { label: 'Drumlin Farm',   href: 'https://www.massaudubon.org/get-outdoors/wildlife-sanctuaries/drumlin-farm' },
        { label: 'Codman Estate',  href: 'https://historicnewengland.org/historic-properties/homes/codman-estate/' },
        { label: 'Gropius House',  href: 'https://historicnewengland.org/historic-properties/homes/gropius-house/' },
      ],
    },
    {
      day:      { nl: 'Zondag',      en: 'Sunday'       },
      date:     { nl: '29 mrt',      en: 'Mar 29'       },
      subtitle: { nl: 'Vertrekdag',  en: 'Departure Day' },
      note:     {
        nl: 'We houden het los rond je vlucht.',
        en: 'We will keep it loose around your flight.',
      },
      image: '/guest-images/sunday-logan-terminal-e.jpg',
      entries: [
        {
          time: { nl: 'Ochtend', en: 'Morning' },
          text: {
            nl: 'Nader te bepalen op basis van vluchttijd.',
            en: 'To be decided based on flight time.',
          },
        },
        {
          time: { nl: 'Middag', en: 'Afternoon' },
          text: {
            nl: 'Goede reis. Tot snel.',
            en: 'Safe travels. Come back soon.',
          },
        },
      ],
      links: [],
    },
  ],

  thingsToDo: [
    {
      label: { nl: 'Mass Central Rail Trail', en: 'Mass Central Rail Trail' },
      note:  { nl: 'Direct voor het huis. Loopt door Wayland en verder, Boston tot Northampton.', en: 'Right out the front door. Runs through Wayland and beyond, Boston to Northampton.' },
      href: 'https://masscentralrailtrail.org',
    },
    {
      label: { nl: "Russel's Garden Center", en: "Russel's Garden Center" },
      note:  { nl: 'Wayland. 5 min. Groot tuincentrum, mooi om doorheen te lopen.', en: 'Wayland. 5 min. Great garden center, worth a wander.' },
      href: 'https://www.russelsgardencenter.com',
    },
    {
      label: { nl: 'Wayland Depot', en: 'Wayland Depot' },
      note:  { nl: 'Wayland. 5 min. Vrijwilligerswinkel in het oude station van 1881 langs het Rail Trail.', en: 'Wayland. 5 min. Volunteer gift shop inside the restored 1881 station building on the Rail Trail.' },
      href: 'http://thewaylanddepot.com/',
    },
    {
      label: { nl: 'Lands Sake Farm', en: 'Lands Sake Farm' },
      note:  { nl: 'Weston. 15 min. Gemeenschapsboerderij met seizoensproducten.', en: 'Weston. 15 min. Community farm with seasonal produce.' },
      href: 'https://www.landssake.org',
    },
  ],

  about: {
    nl: 'Tower Hill is vernoemd naar het oude Tower Hill treinstation en de spoorlijn, nu het Mass Central Rail Trail dat direct voor het huis loopt. Het verbindt Wayland met de naburige plaatsen Weston en Sudbury, en loopt uiteindelijk van Boston tot Northampton in de Berkshires. Wayland is al een actieve gemeenschap sinds de jaren 1600, rijk aan boerderijen, molenvijvers en natuurgebieden.',
    en: 'Tower Hill is named after the old Tower Hill Train Station and railroad corridor, now the Mass Central Rail Trail that runs directly in front of the house. It connects Wayland to neighboring towns of Weston and Sudbury, and will eventually run all the way from Boston to Northampton in the Berkshires. Wayland has been an active community since the 1600s, rich with farms, mill ponds, and conservation land.',
  },

  ui: {
    quickWeather:  { nl: 'Buiten',            en: 'Outside'           },
    thisWeek:      { nl: 'Dit bezoek',        en: 'This visit'        },
    fullForecast:  { nl: 'Volledig weerbericht', en: 'Full forecast'  },
    viewWeather:   { nl: 'Bekijk weer',       en: 'View weather'      },
    wifiLabel:     { nl: 'WIFI',              en: 'WIFI'              },
    passwordLabel: { nl: 'WACHTWOORD',        en: 'PASSWORD'          },
    homeLabel:     { nl: 'Verlichting en Thuis', en: 'Lights and Home' },
    homeNote:      { nl: 'Vraag ons, of tik hieronder voor verlichting, muziek en de thermostaat.', en: 'Ask us, or tap below to control lights, music, and the thermostat.' },
    openHome:      { nl: 'Bedien via Google Home', en: 'Control on Google Home' },
    thePlan:       { nl: 'Het plan',          en: 'The plan'          },
    seeDay:        { nl: 'Bekijk dag',        en: 'See the plan'      },
    whileHere:     { nl: 'Rond Tower Hill', en: 'Around Tower Hill' },
    aboutTitle:    { nl: 'Over Tower Hill',   en: 'About Tower Hill'  },
    viewHistory:   { nl: 'Lees de geschiedenis →', en: 'Read the history →' },
    backHome:      { nl: 'Thuis',             en: 'Back home'         },
    leaveNote:     { nl: 'Laat een berichtje achter', en: 'Leave a note' },
    guestbook:     { nl: 'GASTENBOEK',        en: 'GUESTBOOK'         },
    namePlaceholder:  { nl: 'Jouw naam',      en: 'Your name'         },
    notePlaceholder:  { nl: 'Een berichtje (optioneel)', en: 'Leave a note (optional)' },
    signBtn:       { nl: 'Schrijf je in',     en: 'Sign the Guestbook' },
    thanks:        { nl: 'Bedankt! We zijn zo blij dat je er bent. We kunnen niet wachten om je snel weer te zien.', en: 'Thanks for signing. We are so happy to host you — can\'t wait to see you again soon!' },
    back:          { nl: 'Terug',             en: 'Back'              },
    places:        { nl: 'Plekken',           en: 'Places'            },
    morning:       { nl: 'Ochtend',           en: 'Morning'           },
    weather:       { nl: 'Weer',              en: 'Weather'           },
    aarhusIn:      { nl: 'Thuis in',          en: 'Back home in'      },
  },
};

// ─────────────────────────────────────────────────────────────────────────────


// ─── WMO weather codes for Open-Meteo ────────────────────────────────────────
const WMO = {
  0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 51: 'Drizzle', 61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Snow', 80: 'Showers', 95: 'Thunderstorm',
};

function useHomeWeather(city) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=${city.timezone}`)
      .then(r => r.json())
      .then(json => setData({
        temp: Math.round(json.current.temperature_2m),
        condition: WMO[json.current.weather_code] ?? 'Clear',
      }))
      .catch(() => {});
  }, [city.lat, city.lon, city.timezone]);
  return data;
}

function useHomeTime(timezone) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(
      new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true })
    );
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [timezone]);
  return time;
}


// ─── Sub-components ────────────────────────────────────────────────────────────

// Translate helper — picks lang from a bilingual field
function makeT(lang) {
  return function $(field) {
    if (field && typeof field === 'object' && ('nl' in field || 'en' in field)) {
      return field[lang] ?? field.en ?? '';
    }
    return field ?? '';
  };
}

// Temperature conversion
const toC = (f) => Math.round((f - 32) * 5 / 9);
const displayTemp = (f, useCelsius) => useCelsius ? toC(f) : Math.round(f);


// Weather quick card ────────────────────────────────────────────────────────────

// Visit window: March 23–29, 2026 (midnight local → midnight +1 day)
const VISIT_START_MS = new Date(2026, 2, 23).getTime();
const VISIT_END_MS   = new Date(2026, 2, 30).getTime(); // exclusive upper bound

function WeatherQuickCard({ weatherData, lang, $, useCelsius }) {
  const current  = weatherData?.current;
  const forecast = weatherData?.forecast;
  const tempF     = current ? (current.temperature?.fahrenheit ?? 0) : null;
  const condition = forecast?.current?.conditions || current?.conditions || '';
  // Show only the 7 visit days (Mar 23–29), not just the next 5 from today
  const daily = (forecast?.daily ?? []).filter(d => {
    const ms = d.date * 1000;
    return ms >= VISIT_START_MS && ms < VISIT_END_MS;
  });

  const getDayLabel = (ts) => {
    const date = new Date(ts * 1000);
    const abbr = date.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'short' })
      .toUpperCase().replace(/\./g, '');
    const dayNum = date.getDate();
    return { abbr, dayNum };
  };

  return (
    <div className="quick-item quick-item--weather">
      <WeatherIcon condition={condition || 'Clear'} size={48} className="quick-item-icon quick-item-icon--weather" />
      <div className="quick-item-label">{$(VISIT.ui.quickWeather)}</div>
      {tempF !== null ? (
        <>
          <div className="quick-temp-row">
            <span className="quick-temp">{displayTemp(tempF, useCelsius)}°</span>
            <span className="quick-condition">{condition}</span>
          </div>
          {daily.length > 0 && (
            <>
              <div className="quick-forecast-header">{$(VISIT.ui.thisWeek)}</div>
              <div className="quick-forecast">
                {daily.map((day, i) => {
                  const { abbr, dayNum } = getDayLabel(day.date);
                  return (
                  <div key={i} className="quick-forecast-day">
                    <div className="qf-name">{abbr}</div>
                    <div className="qf-date">{dayNum}</div>
                    <WeatherIcon condition={day.conditions || 'Clear'} size={24} />
                    <div className="qf-temps">
                      <span className="qf-high">{displayTemp(day.temperature.high.fahrenheit, useCelsius)}°</span>
                      <span className="qf-sep">/</span>
                      <span className="qf-low">{displayTemp(day.temperature.low.fahrenheit, useCelsius)}°</span>
                    </div>
                    <div className={`qf-rain${day.precipProbability === 0 ? ' qf-rain--zero' : ''}`}>{day.precipProbability}%</div>
                  </div>
                  );
                })}
              </div>
            </>
          )}
          <Link to="/" className="quick-link">{$(VISIT.ui.fullForecast)} →</Link>
        </>
      ) : (
        <Link to="/" className="quick-link">{$(VISIT.ui.viewWeather)} →</Link>
      )}
    </div>
  );
}


// Day card (grid tile) ─────────────────────────────────────────────────────────

function DayCard({ day, onClick, forecastDay, $, useCelsius }) {
  return (
    <button className="day-card" onClick={onClick} aria-label={`Open ${$(day.day)}`}>
      <div
        className="day-card-image"
        style={{ backgroundImage: `url(${day.image})` }}
        aria-hidden
      >
        <div className="day-card-image-overlay" />
      </div>
      <div className="day-card-body">
        <div className="day-card-meta">
          {$(day.day)} <span className="day-card-date">{$(day.date)}</span>
        </div>
        <div className="day-card-subtitle">{$(day.subtitle)}</div>
        <p className="day-card-note">{$(day.note)}</p>
        <span className="day-card-cta">{$(VISIT.ui.seeDay)} →</span>
        {forecastDay && (
          <div className="day-card-weather">
            <WeatherIcon condition={forecastDay.conditions || 'Clear'} size={16} />
            <span className="day-card-hi">{displayTemp(forecastDay.temperature.high.fahrenheit, useCelsius)}°</span>
            <span className="day-card-weather-sep">/</span>
            <span className="day-card-lo">{displayTemp(forecastDay.temperature.low.fahrenheit, useCelsius)}°</span>
          </div>
        )}
      </div>
    </button>
  );
}


// Day modal (detail view) ─────────────────────────────────────────────────────

function DayModal({ day, isOpen, onClose, lang, $ }) {
  if (!day) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" fullScreenOnMobile ariaLabelledBy="day-modal-title">
      <div className="day-modal">
        <div
          className="day-modal-image"
          style={{ backgroundImage: `url(${day.image})` }}
          aria-hidden
        />

        <button className="day-modal-back" onClick={onClose} aria-label={$(VISIT.ui.back)}>
          ← {$(VISIT.ui.back)}
        </button>

        <div className="day-modal-content">
          <div className="day-modal-meta">
            {$(day.day)} · {$(day.date)}
          </div>
          <h2 id="day-modal-title" className="day-modal-title">{$(day.subtitle)}</h2>
          {day.note && <p className="day-modal-note">{$(day.note)}</p>}

          {/* Options carousel */}
          {day.options && day.options.length > 0 && (
            <div className="day-modal-options">
              <div className="day-modal-options-scroll">
                {day.options.map((opt, i) => (
                  <div key={i} className="day-option-card">
                    <div className="day-option-title">{$(opt.title)}</div>
                    <p className="day-option-note">{$(opt.note)}</p>
                    {opt.href && (
                      <a href={opt.href} target="_blank" rel="noopener noreferrer" className="day-option-link">
                        {lang === 'nl' ? 'Meer info' : 'Learn more'} →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time entries */}
          {day.entries && day.entries.length > 0 && (
            <ul className="day-modal-entries">
              {day.entries.map((entry, i) => (
                <li key={i} className="day-modal-entry">
                  <span className="day-modal-time">{$(entry.time)}</span>
                  <span className="day-modal-text">{$(entry.text)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Places / links */}
          {day.links && day.links.length > 0 && (
            <div className="day-modal-links">
              <div className="day-modal-links-label">{$(VISIT.ui.places)}</div>
              <div className="day-modal-links-list">
                {day.links.map((link, i) => (
                  <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" className="day-modal-link">
                    {link.label} →
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}


// Guestbook ────────────────────────────────────────────────────────────────────

function GuestbookSection({ visitId, $ }) {
  const storageKey = `guestbook_${visitId}`;
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; }
  });
  const [name,      setName]      = useState('');
  const [message,   setMessage]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const entry = {
      name: name.trim(),
      message: message.trim(),
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    };
    const updated = [...entries, entry];
    setEntries(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    setName(''); setMessage('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  return (
    <div className="guestbook-card">
      <div className="guestbook-label">{$(VISIT.ui.guestbook)}</div>

      {entries.length > 0 && (
        <div className="guestbook-entries">
          {entries.map((e, i) => (
            <div key={i} className="guestbook-entry">
              <div className="guestbook-entry-meta">
                <span className="guestbook-entry-name">{e.name}</span>
                <span className="guestbook-entry-date">{e.date}</span>
              </div>
              {e.message && <p className="guestbook-entry-msg">{e.message}</p>}
            </div>
          ))}
        </div>
      )}

      {submitted ? (
        <p className="guestbook-thanks">{$(VISIT.ui.thanks)}</p>
      ) : (
        <form className="guestbook-form" onSubmit={handleSubmit}>
          <input
            className="guestbook-input"
            type="text"
            placeholder={$(VISIT.ui.namePlaceholder)}
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <textarea
            className="guestbook-textarea"
            placeholder={$(VISIT.ui.notePlaceholder)}
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
          />
          <button type="submit" className="guestbook-btn">{$(VISIT.ui.signBtn)}</button>
        </form>
      )}
    </div>
  );
}


// ─── History Modal ──────────────────────────────────────────────────────────────

const HISTORY_SECTIONS = [
  {
    heading: 'The Origin of Tower Hill Station',
    body: 'Across Plain Road, where the parking lot is now, is the site of Tower Hill railroad station, established when the Massachusetts Central Railroad opened through Wayland in 1881. Its name came from a two-story wooden tower built by Boston lawyer and poet Richard Frederick Fuller about 1860 at the top of the hill on his farmland, which he called Tower Hill. The wooden tower burned and in 1929 was replaced with a stone tower that still stands today as part of the house at 157 Plain Road.',
    photos: [
      { src: '/guest-images/history/train-boarding-1956.jpg', caption: 'Steam locomotive arriving at Tower Hill station, April 1956 · Photo by Donald S. Robinson' },
    ],
  },
  {
    heading: 'The Second Station & The Flag Stop',
    body: 'The original small wooden station burned in 1892 and was replaced with a larger station building by the Boston & Maine Railroad, which by then was operating this line. The station agent sold tickets, handled baggage, and lowered the crossing gates when trains approached. For most trains this was a "flag stop" — trains would only stop when the agent or a passenger set the signal, signaling the approaching engineer to stop. As ridership declined, the agent\'s job was abolished in 1920, but the station remained open as a shelter.',
    photos: [
      { src: '/guest-images/history/station-open-shelter.jpg', caption: 'Tower Hill station building from the trackside · Walker Transportation Collection' },
      { src: '/guest-images/history/ticket-1919.jpg', caption: 'A half-fare (student) ticket from Tower Hill to Weston cost 8 cents in 1919 · United States Railroad Administration — Boston & Maine Railroad' },
    ],
  },
  {
    heading: 'The Commuter Era',
    body: 'Steam locomotives carried commuters from Wayland to Boston through the mid-twentieth century. By April 1956, steam was replaced by diesels — one of the last acts of a dwindling line.',
    photos: [
      { src: '/guest-images/history/train-steam-1956.jpeg', caption: 'The 8:27 morning commuter train from Clinton to Boston approaches Tower Hill station, Spring 1956 · Photo by Donald S. Robinson' },
    ],
  },
  {
    heading: 'The Station\'s Final Decades',
    body: 'In April 1955 the old station building was boarded up and replaced by a small open shelter. In 1944 the railroad sold the building to Joseph H. Decatur, a local farmer. The town acquired the land in 1960 and demolished the station building that same year. The last passenger train ran in 1971. The open shelter was torn down in 1996.',
    photos: [
      { src: '/guest-images/history/station-boarded-1955.jpg', caption: 'The old station building boarded up, April 1955 · Photo by William H. Higginbotham, Walker Transportation Collection, Historic Beverly' },
      { src: '/guest-images/history/last-train-1968.jpeg', caption: 'By December 1968, only one train a day ran to Boston — a self-propelled Buddliner rail diesel car · Photo by Richard Conard' },
    ],
  },
  {
    heading: 'The Only Remaining Reminder',
    body: 'The sign at the intersection of Plain Road and Route 20 is the only remaining physical reminder of the name "Tower Hill."',
    photos: [
      { src: '/guest-images/history/stone-marker.jpeg', caption: 'Street sign on stone marker at Plain Road and Route 20 — the only remaining physical reminder of the name Tower Hill' },
    ],
  },
  {
    heading: 'The Mass Central Rail Trail',
    body: 'The B&M Railroad\'s Central Mass Branch once stretched from North Station, Boston, to Northampton. Governor Calvin Coolidge rode this train daily to the State House just after World War I. The Hurricane of 1938 broke the railroad in the center of the state. Now, almost a century later, the old railroad property is being transformed into a shared-use path by dedicated volunteers, municipalities, and land trusts across 26 communities — 104 miles, Boston to Northampton.',
    photos: [
      { src: '/guest-images/history/mcrt-sign.jpeg', caption: 'Mass Central Rail Trail interpretive sign — Boston to Northampton, 104 miles through 26 communities' },
      { src: '/guest-images/history/bm-emblem.jpg', caption: 'Boston and Maine Railroad Historical Society emblem, affixed to the interpretive sign cabinet at the Tower Hill station site' },
    ],
  },
];

function HistoryModal({ isOpen, onClose, $ }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" fullScreenOnMobile ariaLabelledBy="history-modal-title">
      <div className="history-modal">
        <button className="day-modal-back" onClick={onClose} aria-label={$(VISIT.ui.back)}>
          ← {$(VISIT.ui.back)}
        </button>

        <div className="history-modal-hero">
          <div className="history-modal-eyebrow">Tower Hill · Wayland, MA</div>
          <h2 id="history-modal-title" className="history-modal-title">Tower Hill Railroad Station</h2>
          <p className="history-modal-subtitle">Est. 1881 · Massachusetts Central Railroad</p>
        </div>

        <div className="history-modal-content">
          {HISTORY_SECTIONS.map((section, i) => (
            <div key={i} className="history-section">
              <h3 className="history-section-heading">{section.heading}</h3>
              <p className="history-section-body">{section.body}</p>
              {section.photos.map((photo, j) => (
                <figure key={j} className="history-figure">
                  <img src={photo.src} alt={photo.caption} className="history-img" loading="lazy" />
                  <figcaption className="history-caption">{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          ))}
          <p className="history-source">Source: Wayland Historical Society. Signage photographed at the Tower Hill railroad station site, Plain Road, Wayland, Massachusetts.</p>
        </div>
      </div>
    </Modal>
  );
}


// ─── Main page ─────────────────────────────────────────────────────────────────

export default function GuestPage({ weatherData }) {
  const [lang, setLang]           = useState('nl');
  const [openDay,   setOpenDay]   = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [homeInstructionsOpen, setHomeInstructionsOpen] = useState(false);

  const $ = useCallback(makeT(lang), [lang]);
  const useCelsius = lang === 'nl';

  const onChangeTheme = useCallback(() => {
    const current = localStorage.getItem('themeOverride');
    const next = current === 'light' ? 'dark' : 'light';
    localStorage.setItem('themeOverride', next);
    document.body.classList.toggle('theme-dark', next === 'dark');
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = `Tower Hill · Hey ${VISIT.guest}!`;
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    document.body.classList.add('guest-canvas');
    return () => document.body.classList.remove('guest-canvas');
  }, []);

  const openModal  = useCallback((day) => { setOpenDay(day); setModalOpen(true);  }, []);
  const closeModal = useCallback(()    => { setModalOpen(false); },                  []);

  const aarhusWeather = useHomeWeather(VISIT.homeCity);
  const aarhusTime    = useHomeTime(VISIT.homeCity.timezone);

  const { wifi, thingsToDo, about, googleHomeUrl } = VISIT;

  return (
    <div className="guest-page">

      {/* Header */}
      <header className="guest-header">
        <div className="guest-header-inner">
          <div className="guest-header-eyebrow">Tower Hill · Wayland, MA</div>
          <h1 className="guest-header-title">Hey {VISIT.guest}!</h1>
          <div className="guest-header-bottom-row">
            <p className="guest-header-greeting">{$(VISIT.greeting)}</p>
            <p className="guest-header-dates">{$(VISIT.dates)}</p>
          </div>
        </div>
        <div className="guest-lang-toggle">
          <button
            className={`guest-lang-btn${lang === 'nl' ? ' active' : ''}`}
            onClick={() => setLang('nl')}
          >NL</button>
          <span className="guest-lang-sep">·</span>
          <button
            className={`guest-lang-btn${lang === 'en' ? ' active' : ''}`}
            onClick={() => setLang('en')}
          >US</button>
        </div>
      </header>

      {/* Quick info strip */}
      <div className="guest-quick-strip">
        <WeatherQuickCard weatherData={weatherData} lang={lang} $={$} useCelsius={useCelsius} />

        <div className="quick-right-col">
          <div className="quick-item quick-item--wifi">
            <svg className="quick-item-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <circle cx="12" cy="20" r="1" fill="currentColor"/>
            </svg>
            <div className="quick-item-label">{$(VISIT.ui.wifiLabel)}</div>
            <div className="quick-wifi-bottom">
              <div className="quick-wifi-network">{wifi.network}</div>
              <div className="quick-wifi-row">
                <span className="quick-wifi-sublabel">{$(VISIT.ui.passwordLabel)}</span>
                <span className="quick-wifi-password">{wifi.password}</span>
              </div>
            </div>
          </div>

          <div className="quick-item quick-item--home">
            <svg className="quick-item-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="9" y1="18" x2="15" y2="18"/>
              <line x1="10" y1="22" x2="14" y2="22"/>
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
            </svg>
            <div className="quick-item-label">{$(VISIT.ui.homeLabel)}</div>
            <button className="quick-link home-instructions-link" onClick={() => setHomeInstructionsOpen(true)}>
              {lang === 'nl' ? 'Zie instructies →' : 'See instructions →'}
            </button>
            <a href={googleHomeUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
              {$(VISIT.ui.openHome)} →
            </a>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <section className="guest-section">
        <h2 className="guest-section-title">{$(VISIT.ui.thePlan)}</h2>
        <div className="day-grid">
          {VISIT.schedule.map((day, i) => {
            const target = new Date(2026, 2, 23 + i); // March 23 + offset
            const forecastDay = weatherData?.forecast?.daily?.find(d => {
              const fd = new Date(d.date * 1000);
              return fd.getFullYear() === target.getFullYear() &&
                     fd.getMonth()    === target.getMonth()    &&
                     fd.getDate()     === target.getDate();
            });
            return (
              <DayCard
                key={$(day.day)}
                day={day}
                onClick={() => openModal(day)}
                forecastDay={forecastDay}
                $={$}
                useCelsius={useCelsius}
              />
            );
          })}
        </div>
      </section>

      {/* Explore */}
      <section className="guest-section">
        <h2 className="guest-section-title">{$(VISIT.ui.whileHere)}</h2>
        <ul className="explore-list">
          {thingsToDo.map((item, i) => (
            <li key={i} className="explore-item">
              <div className="explore-item-inner">
                <span className="explore-label">
                  {item.href
                    ? <a href={item.href} target="_blank" rel="noopener noreferrer" className="explore-link">{$(item.label)}</a>
                    : $(item.label)
                  }
                </span>
                <span className="explore-note">{$(item.note)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* About */}
      <section className="guest-section">
        <h2 className="guest-section-title">{$(VISIT.ui.aboutTitle)}</h2>
        <div className="about-card">
          <img
            src="/guest-images/history/train-boarding-1956.jpg"
            alt="Train arriving at Tower Hill station, April 1956"
            className="about-card-img"
            loading="lazy"
          />
          <div className="about-card-body">
            <p className="guest-about">{$(about)}</p>
            <button className="history-trigger" onClick={() => setHistoryOpen(true)}>
              {$(VISIT.ui.viewHistory)}
            </button>
          </div>
        </div>
      </section>

      {/* Back Home */}
      <section className="guest-section">
        <h2 className="guest-section-title">{$(VISIT.ui.aarhusIn)} {VISIT.homeCity.label}</h2>
        <div className="backhome-card">
          <div className="backhome-time">{aarhusTime || '—'}</div>
          {aarhusWeather && (
            <>
              <div className="backhome-divider" aria-hidden="true" />
              <div className="backhome-right">
                <div className="backhome-weather-label">{$(VISIT.ui.weather)}</div>
                <div className="backhome-weather">
                  <WeatherIcon condition={aarhusWeather.condition || 'Clear'} size={20} />
                  <span className="backhome-temp">{displayTemp(aarhusWeather.temp, useCelsius)}°</span>
                  <span className="backhome-condition">{aarhusWeather.condition}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Guestbook */}
      <section className="guest-section">
        <h2 className="guest-section-title">{$(VISIT.ui.leaveNote)}</h2>
        <GuestbookSection visitId={VISIT_ID} $={$} />
      </section>

      <footer className="guest-footer">
        <Link to="/guest" className="guest-footer-link">
          {lang === 'nl' ? 'Jouw bezoek' : 'Your Visit'}
        </Link>
        <span className="guest-footer-sep" aria-hidden>•</span>
        <Link to="/" className="guest-footer-link">
          {lang === 'nl' ? 'Weer' : 'Weather'}
        </Link>
        <span className="guest-footer-sep" aria-hidden>•</span>
        <Link to="/garden" className="guest-footer-link">
          {lang === 'nl' ? 'Tuin' : 'Garden'}
        </Link>
        <button className="theme-toggle guest-theme-toggle" onClick={onChangeTheme} aria-label="Toggle theme" title="Toggle theme">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </footer>

      {/* Day detail modal */}
      <DayModal
        day={openDay}
        isOpen={modalOpen}
        onClose={closeModal}
        lang={lang}
        $={$}
      />

      {/* History modal */}
      <HistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        $={$}
      />

      {/* Home instructions modal */}
      <Modal isOpen={homeInstructionsOpen} onClose={() => setHomeInstructionsOpen(false)} size="md" fullScreenOnMobile ariaLabelledBy="home-instructions-title">
        <div className="home-instructions-modal">
          <button className="day-modal-back" onClick={() => setHomeInstructionsOpen(false)} aria-label={$(VISIT.ui.back)}>
            ← {$(VISIT.ui.back)}
          </button>
          <div className="home-instructions-content">
            <div className="home-instructions-eyebrow">Google Home</div>
            <h2 id="home-instructions-title" className="home-instructions-title">
              {lang === 'nl' ? 'Welkom thuis!' : 'Welcome to Our Home!'}
            </h2>
            <p className="home-instructions-intro">
              {lang === 'nl'
                ? 'We zijn zo blij dat je er bent. Om je verblijf comfortabeler te maken, hebben we de verlichting via Google Home geautomatiseerd. Je kunt bijna alle lampen bedienen met je stem of via de Google Home-app.'
                : "We're so glad to have you. To make your stay more comfortable, we've automated the lighting through Google Home. You can control almost all the lights using your voice or the Google Home app."}
            </p>
            <div className="home-instructions-section">
              <div className="home-instructions-label">
                {lang === 'nl' ? 'Snel starten: spraakopdrachten' : 'Quick Start: Voice Commands'}
              </div>
              <p className="home-instructions-body">
                {lang === 'nl'
                  ? 'Zeg "Hey Google..." gevolgd door:'
                  : 'To adjust the lights, just say, "Hey Google..." followed by:'}
              </p>
              <ul className="home-instructions-list">
                <li>{lang === 'nl' ? '"Zet de gastenkamelverlichting aan."' : '"Turn on the Guest Room lights."'}</li>
                <li>{lang === 'nl' ? '"Dim de chroomplamp naar 30%."' : '"Dim the Chrome lamps to 30%."'}</li>
                <li>{lang === 'nl' ? '"Zet de hoekladenlamp aan."' : '"Turn on corner light."'}</li>
                <li>{lang === 'nl' ? '"Zet de logeerkamer uit."' : '"Turn off Guest Room." — Perfect for when you\'re heading out or going to bed.'}</li>
              </ul>
            </div>
            <a href={googleHomeUrl} target="_blank" rel="noopener noreferrer" className="home-instructions-cta">
              {$(VISIT.ui.openHome)} →
            </a>
          </div>
        </div>
      </Modal>

    </div>
  );
}
