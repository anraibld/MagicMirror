# Kiosk-oppsett (Raspberry Pi)

## Siste oppsett
- **Oppstart:** `magicmirror.service` (systemd, brukernivå) kjører `node ./serveronly`; Chromium-kiosk mot `localhost:8080` starter fra labwc.
- **Super + M** bytter mellom speil og skrivebord (kun for feilsøking – vises ikke på skjermen). `mm-mode toggle|mirror|desktop`.
- **Oppdatering:** `mm-update.timer` (3 min etter boot, deretter hver 6. time) henter `origin/master`, oppdaterer tredjepartsmoduler (`modules.list`), installerer avhengigheter og restarter. Kommer ikke speilet opp igjen, rulles det tilbake. Logg: `~/.cache/mm/update.log`.
- **Node:** egen Node 24 i `~/.local/node` (MagicMirror ≥ 2.38 krever ≥ 22.22.2).
- **Nett:** ethernet først, WiFi som reserve → `sudo bash kiosk/net-priority.sh` (én gang).
- **Sider:** 0 buss (Kolumbus) + Cast · 1 fotball (Viking `VFK`, Man United `MAN`) · 2 nyheter (Aftenbladet) + farevarsel (fylke 11). Fast: klokke, komplimenter, vær (YR, Stavanger), WiFi-QR, Spotify.
- **Gjenstår:** Spotify-nøkler og GoogleCast-enhets-ID i `config/config.js`; riktig busstopp i `MMM-Kolumbus`.

## Installere på en ny Pi
`git clone` repoet til `~/MagicMirror`, legg Node 24 (arm64) i `~/.local/node`, kjør `bash kiosk/install.sh`, rediger `config/config.js` (lages fra `config.template.js`), logg ut/inn.

## Filer
`bin/` skript · `systemd/` units · `modules/` egne moduler (MMM-Kolumbus) · `modules.list` tredjepartsmoduler · `config.template.js` uten hemmeligheter (ekte `config.js` er gitignorert).
