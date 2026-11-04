# MMM-Kolumbus

MagicMirror² module showing next Kolumbus (Rogaland) bus departures via the Entur API (no key needed). Green dot = realtime.

## Config
```js
{
  module: "MMM-Kolumbus",
  position: "top_left",
  config: {
    stopPlaceId: "NSR:StopPlace:59853", // Stavanger bussterminal
    maxDepartures: 8,
    updateInterval: 60000,
    lineFilter: [],   // e.g. ["6", "9"]; empty = all
    header: ""        // empty = stop name
  }
}
```
Find stop IDs: `https://api.entur.io/geocoder/v1/autocomplete?text=NAME&lang=no&layers=venue` (send header `ET-Client-Name`).
Requires Node 18+ (global fetch). On errors the last data stays visible with a notice.
