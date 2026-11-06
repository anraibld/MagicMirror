# Kiosk-oppsett (Raspberry Pi)

## Siste oppsett
- **Oppstart:** `magicmirror.service` (systemd, brukernivå) kjører `node ./serveronly`; Chromium-kiosk mot `localhost:8080` starter fra labwc.
- **Super + M** bytter mellom speil og skrivebord (kun for feilsøking – vises ikke på skjermen). `mm-mode toggle|mirror|desktop`.
- **Sense HAT-debug:** `mm-sensehat.service`. Joystick: **trykk** = debug av/på (LED-matrisen er ellers slukket), **venstre/høyre** = side (status · Pi-vitaler · sensorer), **opp/ned** = lysstyrke. Fargekode og rader: se toppen av `bin/mm-sensehat`. `mm-sensehat --selftest` skriver alt som tekst. Påskeegg: ↑ ↑ ↓ ↓ ← → ← → + trykk (A) = regnbue i 5 s.
- **Oppdatering:** `mm-update.timer` sjekker `origin/master` hvert 3. min (kun `ls-remote`, gjør ingenting uten endringer) og tredjepartsmoduler (`modules.list`) hver 6. time; ved endringer installeres avhengigheter og speilet restartes. Kommer ikke speilet opp igjen, rulles det tilbake, og den commiten hoppes over til en nyere kommer. Endres kun `greetings.md`, hentes den uten omstart (modulen leser filen live). Etter en omstart laster kiosken siden på nytt selv (`reloadAfterServerRestart`). Logg: `~/.cache/mm/update.log`.
- **Node:** egen Node 24 i `~/.local/node` (MagicMirror ≥ 2.38 krever ≥ 22.22.2).
- **Nett:** ethernet først, WiFi som reserve → `sudo bash kiosk/net-priority.sh` (én gang).
- **Sider:** 0 buss (Kolumbus) + Cast · 1 fotball (Viking `VFK`, Man United `MAN`) · 2 nyheter (Aftenbladet) + farevarsel (fylke 11). Fast: klokke, hilsener (`MMM-Greetings` fra `greetings.md`), vær (YR, Stavanger), WiFi-QR, Spotify.
- **Gjeste-WiFi:** vises kun på hjemmesiden (side 0), dempet mot innbrenning.
- **Gjenstår:** Spotify-nøkler og GoogleCast-enhets-ID i `config/config.js`; riktig busstopp i `MMM-Kolumbus`.

## Installere på en ny Pi
`git clone` repoet til `~/MagicMirror`, legg Node 24 (arm64) i `~/.local/node`, kjør `bash kiosk/install.sh`, rediger `config/config.js` (lages fra `config.template.js`), logg ut/inn.

## Hilsener
Rediger `greetings.md` i repoet og push til `master`. Neste oppdateringsrunde (innen ca. 3 min) henter filen, og speilet viser de nye hilsenene uten omstart.

## Filer
`bin/` skript · `systemd/` units · `modules/` egne moduler (MMM-Kolumbus, MMM-Greetings) · `modules.list` tredjepartsmoduler · `custom.css` auto-skalering (kopieres til config/ ved install) · `config.template.js` uten hemmeligheter (ekte `config.js` er gitignorert).
