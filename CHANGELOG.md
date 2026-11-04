# Changelog

Alle nennenswerten Änderungen an Claude Smooth.

## [3.1.1] – 2026-11-04

### Neu
- **Sidebar gleitet:** Beim Einklappen fährt die Sidebar nach links raus und der Chat folgt im selben Tempo, beim Ausklappen schiebt sie sich wieder herein. Die Titelzeile rutscht mit, statt zu springen.
- **Chromium-Browser:** Läuft jetzt auch in Chrome, Edge, Brave, Vivaldi, Helium und Co.
- **Signierte Releases:** Firefox-Version von Mozilla signiert, Chromium-Version als signierte CRX – beide dauerhaft installierbar und mit automatischen Updates.
- Linux-Installer für Chromium-Browser (`install/chromium-linux.sh`), ganz ohne Entwicklermodus.

### Geändert
- Firefox ab Version 142.

## [3.1.0] – 2026-11-04

### Verbessert
- **Menüs** wachsen aus ihrem Button heraus und öffnen in die richtige Richtung (das Profilmenü nach oben). Die Animation startet erst, wenn das Menü an seinem Platz ist, und läuft nicht mehr doppelt.
- **Neue Inhalte** blenden sauber ein, statt verspätet aufzuploppen.
- **Seitenwechsel** ohne Aufblitzen. In den Einstellungen gleitet beim Tab-Wechsel nur der neue Inhalt, die Tab-Leiste bleibt stehen.
- **Streaming:** Wenn die Antwort mitscrollt, gleitet der Text Zeile für Zeile nach oben, statt zu springen. Am Ende der Antwort blendet nichts mehr ein zweites Mal ein.
- **Gesendete Nachrichten** heben ruhiger vom Eingabefeld ab – und nur noch beim Senden, nicht beim Öffnen alter Chats.
- Die erste Nachricht in einem neuen Chat wird jetzt auch animiert.
- Hinter Dialogen wird die Seite nicht mehr weichgezeichnet (spart Frames).

## [3.0.0]

- Federphysik (smooth / snappy / bouncy), Wort-für-Wort-Streaming, Menüs und Dialoge, Seitenübergänge, Klick-Federung, Icon-Morphing, Glanz und Licht-Puls, Einstellungs-Popup.
