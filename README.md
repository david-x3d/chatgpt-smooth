<div align="center">

<img src="icons/icon-128.png" width="88" alt="">

# Claude Smooth

**Weiche, federnde Animationen für claude.ai – ohne das Aussehen zu verändern.**

[![Release](https://img.shields.io/github/v/release/david-x3d/claude-smooth?label=Release&color=d97757)](https://github.com/david-x3d/claude-smooth/releases/latest)
[![Firefox](https://img.shields.io/badge/Firefox-142%2B-FF7139?logo=firefoxbrowser&logoColor=white)](#firefox--floorp--zen--librewolf)
[![Chromium](https://img.shields.io/badge/Chromium-117%2B-4285F4?logo=googlechrome&logoColor=white)](#chrome--edge--brave--vivaldi--helium)
[![Lizenz](https://img.shields.io/github/license/david-x3d/claude-smooth?label=Lizenz)](LICENSE)

<img src="docs/demo.svg" width="720" alt="Eine Nachricht hebt ab, die Antwort blendet Zeile für Zeile ein, die Sidebar gleitet raus und wieder rein">

</div>

claude.ai springt an vielen Stellen: Antworten erscheinen in Brocken, Menüs ploppen auf, die Sidebar klappt in einem einzigen Frame zu. Claude Smooth legt eine Bewegungsschicht darüber – mit echter Federphysik statt starrer Übergänge. Farben, Schriften und Layout bleiben genau so, wie sie sind.

## Was sich ändert

| | Ohne | Mit Claude Smooth |
|---|---|---|
| **Antworten** | Text erscheint in Brocken, die Seite springt Zeile für Zeile | Wörter blenden nacheinander ein und werden scharf, neue Zeilen gleiten nach oben |
| **Nachrichten** | tauchen einfach auf | deine Nachricht hebt vom Eingabefeld ab, Claudes Antwort steigt auf |
| **Menüs & Dialoge** | ploppen auf | wachsen aus ihrem Button heraus, Einträge kaskadieren, beim Schließen schrumpfen sie zurück |
| **Seitenwechsel** | harter Schnitt | neuer Inhalt gleitet herein, was bleibt, bleibt stehen |
| **Sidebar** | springt zu | gleitet raus, der Chat fährt im selben Tempo hinterher |
| **Klicks** | – | Buttons federn beim Drücken, Icons verwandeln sich (Kopieren → Haken) |
| **Maus** | – | ein weiches Licht folgt dem Zeiger über Buttons, Puls beim Klick |

Alles lässt sich einzeln abschalten, das Tempo ist einstellbar. Ist im System „Bewegung reduzieren“ aktiv, bleibt claude.ai unverändert.

## Installation

Die Dateien liegen beim [neuesten Release](https://github.com/david-x3d/claude-smooth/releases/latest).

### Firefox · Floorp · Zen · LibreWolf

1. `claude-smooth-…-firefox.xpi` herunterladen.
2. `about:addons` öffnen → Zahnrad → **Add-on aus Datei installieren…** und die Datei wählen (oder sie einfach ins Browserfenster ziehen).

Die Datei ist von Mozilla signiert: dauerhaft installiert, kein Entwicklermodus, Updates kommen automatisch.

### Chrome · Edge · Brave · Vivaldi · Helium

Chromium-Browser installieren Erweiterungen von außerhalb des Chrome Web Store nur, wenn eine Browser-Richtlinie es erlaubt. Unter **Linux** richtet das ein kleines Skript ein:

```bash
curl -fsSLO https://raw.githubusercontent.com/david-x3d/claude-smooth/main/install/chromium-linux.sh
sudo bash chromium-linux.sh
```

Danach den Browser neu starten. Das Skript erkennt Chrome, Chromium, Helium, Brave, Edge und Vivaldi. Der Browser lädt die signierte Erweiterung selbst aus den Releases und hält sie aktuell – kein Entwicklermodus. Er zeigt dann „Von deiner Organisation verwaltet“; das bezieht sich nur auf diese eine Regel.

Wieder entfernen: `sudo bash chromium-linux.sh --uninstall`

<details>
<summary><b>Windows, macOS oder ohne Root-Rechte</b></summary>

Dort lassen Chrome & Co. Erweiterungen von außerhalb des Web Store nur im Entwicklermodus zu:

1. `claude-smooth-…-chromium.zip` herunterladen und entpacken.
2. `chrome://extensions` öffnen (Edge: `edge://extensions`) und den **Entwicklermodus** einschalten.
3. **Entpackt laden** → den entpackten Ordner wählen.

Updates gibt es auf diesem Weg nicht automatisch – für eine neue Version den Ordner ersetzen und auf ⟳ klicken.

</details>

## Einstellungen

Ein Klick auf das Symbol in der Symbolleiste öffnet die Einstellungen. Sie gelten sofort, ohne Neuladen.

| Schalter | Wirkung | Standard |
|---|---|:---:|
| Text-Streaming | Wörter blenden ein, Text gleitet beim Mitscrollen | an |
| Menüs & Dialoge | Weich auf- und zuklappen | an |
| Seiten & Nachrichten | Einstellungen, Chats, neue Nachrichten | an |
| Sidebar & Layout | Ein-/Ausklappen gleitet statt springt | an |
| Alles einblenden | Jedes neue Element blendet weich ein | an |
| Weichzeichnen | Blur-Fokus beim Einblenden (braucht etwas GPU) | an |
| Klick-Federung | Alles gibt beim Drücken nach, Icons verwandeln sich | an |
| Glanz & Licht-Puls | Licht folgt der Maus, Puls beim Klick | an |
| Hover-Übergänge | Farben, Pfeile, Schalter | an |
| Weiches Scrollen | Programmatisches Scrollen wird weich (kann beim Mitscrollen nachziehen) | aus |
| **Tempo** | von schnell (0,5×) bis sanft (1,8×) | 1× |

## Wie es funktioniert

- **Echte Federn.** Die Bewegungen sind gedämpfte Federn wie in SwiftUI (`smooth`, `snappy`, `bouncy`). Sie werden einmal berechnet und als CSS-`linear()`-Kurven abgelegt – mit natürlichem Nachschwingen statt starrer Bézier-Kurven.
- **Vor dem ersten Bild.** Neue Inhalte werden im `MutationObserver` erkannt, bevor der Browser sie zeichnet. Nichts blitzt erst auf und springt dann zurück.
- **Das Streaming bleibt unangetastet.** Das Wort-für-Wort-Einblenden nutzt die [CSS Custom Highlight API](https://developer.mozilla.org/docs/Web/API/CSS_Custom_Highlight_API) – claude.ais Text wird nicht umgebaut, Kopieren und Markieren funktionieren wie immer.
- **Günstige Eigenschaften.** Bewegt werden fast nur `translate`, `scale` und `opacity`; Weichzeichner nur auf kleinen Flächen.

## Datenschutz

Claude Smooth sendet nichts und sammelt nichts – keine Telemetrie, keine Netzwerkanfragen. Die Erweiterung läuft ausschließlich auf `claude.ai` und braucht nur eine Berechtigung: `storage`, für deine Einstellungen, lokal im Browser. Updates lädt der Browser selbst aus den GitHub-Releases.

## Entwicklung

```
manifest.json          Firefox-Manifest – der Ordner lässt sich direkt laden
smooth.js, smooth.css  die Erweiterung
popup.html, popup.js   Einstellungen
scripts/build.mjs      baut dist/firefox und dist/chromium (+ ZIPs)
install/               Linux-Installer für Chromium-Browser
```

- **Ausprobieren in Firefox:** `about:debugging#/runtime/this-firefox` → *Temporäres Add-on laden…* → `manifest.json`
- **Ausprobieren in Chromium:** `node scripts/build.mjs`, dann `dist/chromium` entpackt laden
- **Prüfen:** `npx web-ext lint --self-hosted --source-dir dist/firefox`

Gebaut wird ohne Abhängigkeiten – nur Node ≥ 18 und `zip`.

### Neue Version veröffentlichen

1. Version in `manifest.json` erhöhen und `CHANGELOG.md` ergänzen.
2. Taggen und pushen: `git tag v3.2.0 && git push origin main --tags`
3. GitHub Actions baut, signiert beide Varianten und veröffentlicht das Release samt Update-Dateien.

Zum Signieren braucht das Repository drei Secrets:

| Secret | Wofür | Woher |
|---|---|---|
| `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` | Firefox-Signatur (unlisted) | [addons.mozilla.org → API-Schlüssel](https://addons.mozilla.org/developers/addon/api/key/) |
| `CRX_PRIVATE_KEY` | Chromium-Signatur, feste Erweiterungs-ID | eigener RSA-Schlüssel (PEM) |

## Hinweis

Inoffizielles Community-Projekt, nicht mit Anthropic verbunden. „Claude“ ist eine Marke von Anthropic.

## Lizenz

[MIT](LICENSE)
