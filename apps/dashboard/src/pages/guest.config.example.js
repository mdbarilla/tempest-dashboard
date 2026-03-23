// guest.config.example.js — TEMPLATE. Committed to git.
// Copy this file to guest.config.js and fill in visitor details before building.
//
// guest.config.js is gitignored and should never be committed.
// This file is the safe, anonymous reference.
//
// VISIT_ID format: <guestname>-<YYYY-MM-DD> (use arrival date)
// This ID tags all guestbook entries for this visit.

export const VISIT_ID = 'guest-YYYY-MM-DD';

export const VISIT = {

  // ── Guest ───────────────────────────────────────────────────────────────────
  guest: 'Guest Name',

  // ── Visit window ────────────────────────────────────────────────────────────
  arrival:   'YYYY-MM-DD',   // ISO date string — used to filter weather forecast
  departure: 'YYYY-MM-DD',   // inclusive last day
  dates:    { nl: 'DD – DD maand', en: 'Month DD – DD' },
  greeting: { nl: 'voel je thuis.', en: 'make yourself at home.' },

  // ── Guest's home city (shown on weather comparison card) ────────────────────
  homeCity: {
    label:    'City Name',
    country:  { nl: 'Land', en: 'Country' },
    lat:      0.0000,
    lon:      0.0000,
    timezone: 'Europe/London',    // IANA timezone string
  },

  // ── Home network ─────────────────────────────────────────────────────────────
  wifi: {
    network:  'network-name',
    password: 'password',
  },

  // ── Smart home ───────────────────────────────────────────────────────────────
  googleHomeUrl: 'https://home.google.com',

  // ── Day-by-day schedule ──────────────────────────────────────────────────────
  // Add one object per day. Fields:
  //   day, date, subtitle, note  — bilingual { nl, en }
  //   image                      — path under /guest-images/
  //   entries[]                  — { time: {nl,en}, text: {nl,en} }
  //   links[]                    — { label, href }  (shown below the day card)
  //   options[]                  — (Friday-style pick-your-own) { title:{nl,en}, note:{nl,en}, href }
  schedule: [
    {
      day:      { nl: 'Maandag',  en: 'Monday'   },
      date:     { nl: 'DD mrt',   en: 'Mon DD'   },
      subtitle: { nl: 'Aankomst', en: 'Arrival'  },
      note:     { nl: '', en: '' },
      image: '/guest-images/monday-placeholder.jpg',
      entries: [
        {
          time: { nl: 'Ochtend', en: 'Morning' },
          text: { nl: '', en: '' },
        },
        {
          time: { nl: 'Middag', en: 'Afternoon' },
          text: { nl: '', en: '' },
        },
        {
          time: { nl: 'Avond', en: 'Evening' },
          text: { nl: '', en: '' },
        },
      ],
      links: [],
    },
    // Add more days as needed...
    {
      day:      { nl: 'Zondag',     en: 'Sunday'        },
      date:     { nl: 'DD mrt',     en: 'Mon DD'        },
      subtitle: { nl: 'Vertrekdag', en: 'Departure Day' },
      note:     { nl: '', en: '' },
      image: '/guest-images/sunday-placeholder.jpg',
      entries: [
        {
          time: { nl: 'Ochtend', en: 'Morning' },
          text: { nl: '', en: '' },
        },
      ],
      links: [],
    },
  ],

  // ── Nearby things to do ──────────────────────────────────────────────────────
  thingsToDo: [
    {
      label: { nl: 'Place Name', en: 'Place Name' },
      note:  { nl: 'Beschrijving.', en: 'Description.' },
      href: 'https://example.com',
    },
  ],

  // ── About Tower Hill (history section intro) ─────────────────────────────────
  about: {
    nl: 'Introductietekst over Tower Hill...',
    en: 'Intro text about Tower Hill...',
  },

  // ── UI strings — translate if guest speaks another language ─────────────────
  ui: {
    quickWeather:  { nl: 'Buiten',               en: 'Outside'              },
    thisWeek:      { nl: 'Dit bezoek',            en: 'This visit'           },
    fullForecast:  { nl: 'Volledig weerbericht',  en: 'Full forecast'        },
    viewWeather:   { nl: 'Bekijk weer',           en: 'View weather'         },
    wifiLabel:     { nl: 'WIFI',                  en: 'WIFI'                 },
    passwordLabel: { nl: 'WACHTWOORD',            en: 'PASSWORD'             },
    homeLabel:     { nl: 'Verlichting en Thuis',  en: 'Lights and Home'      },
    homeNote:      { nl: 'Vraag ons, of tik hieronder voor verlichting, muziek en de thermostaat.', en: 'Ask us, or tap below to control lights, music, and the thermostat.' },
    openHome:      { nl: 'Bedien via Google Home', en: 'Control on Google Home' },
    thePlan:       { nl: 'Het plan',              en: 'The plan'             },
    seeDay:        { nl: 'Bekijk dag',            en: 'See the plan'         },
    whileHere:     { nl: 'Rond Tower Hill',       en: 'Around Tower Hill'    },
    aboutTitle:    { nl: 'Over Tower Hill',       en: 'About Tower Hill'     },
    viewHistory:   { nl: 'Lees de geschiedenis →', en: 'Read the history →'  },
    backHome:      { nl: 'Thuis',                 en: 'Back home'            },
    leaveNote:     { nl: 'Laat een berichtje achter', en: 'Leave a note'     },
    guestbook:     { nl: 'GASTENBOEK',            en: 'GUESTBOOK'            },
    namePlaceholder:  { nl: 'Jouw naam',          en: 'Your name'            },
    notePlaceholder:  { nl: 'Een berichtje (optioneel)', en: 'Leave a note (optional)' },
    signBtn:       { nl: 'Schrijf je in',         en: 'Sign the Guestbook'   },
    thanks:        { nl: 'Bedankt!',              en: 'Thanks for signing!'  },
    back:          { nl: 'Terug',                 en: 'Back'                 },
    places:        { nl: 'Plekken',               en: 'Places'               },
    morning:       { nl: 'Ochtend',               en: 'Morning'              },
    weather:       { nl: 'Weer',                  en: 'Weather'              },
    aarhusIn:      { nl: 'Thuis in',              en: 'Back home in'         },
  },
};
