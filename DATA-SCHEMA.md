# Daten-Schema — HD2 Feldhandbuch

Alle Dateien liegen in `data/`, sind **UTF-8 ohne BOM** und enthalten **gültiges JSON**
(keine Kommentare, keine Markdown-Fences). Deutsche Texte mit echten Umlauten (ä ö ü ß),
englische Eigennamen bleiben englisch. IDs sind `snake_case` und stabil.

## data/enemies.json

```json
{
  "factions": [
    {
      "id": "terminids",
      "name": "Terminiden",
      "en": "Terminids",
      "color": "#c9d94a",
      "summary": "2–3 Sätze Einstieg.",
      "playstyle": "1–2 Sätze, wie man gegen sie spielt.",
      "subfactions": [ { "name": "Predator Strain", "note": "..." } ]
    }
  ],
  "enemies": [
    {
      "id": "bile_titan",
      "name": "Bile Titan",
      "de": "Säure-Titan",
      "faction": "terminids",
      "subfaction": null,
      "class": "heavy",
      "threat": 5,
      "armor": 4,
      "armorNote": "Panzerung 4 am Körper; Kopf und Säcke darunter.",
      "weakspots": [
        { "zone": "Kopf", "note": "Panzerung 0–2, jede Waffe macht Schaden.", "armor": 1 }
      ],
      "tactics": ["...", "..."],
      "gear": ["EAT-17", "Railgun", "Orbital Railcannon Strike"],
      "imageLarge": "assets/img/enemies/icons/bile_titan.png",
      "attacks": [
        { "name": "CAUSTIC SURGE", "type": "Säurestrahl", "range": "40 m", "danger": "HOCH", "desc": "Verlangsamt · DoT · 1,5 s Vorwarnung" }
      ],
      "summary": "2–3 Sätze: Rolle, Gefahr, Erkennungsmerkmal.",
      "source": "https://helldivers.wiki.gg/wiki/Bile_Titan"
    }
  ]
}
```

- `class`: `chaff` | `light` | `medium` | `heavy` | `elite` | `air` | `structure`
- `threat`: 1 (harmlos) bis 5 (Killer)
- `armor`: gerundeter Panzerungswert 0–10 (Körper/Hauptpanzerung, geschätzt wenn nicht
  eindeutig); `weakspots[].armor` nur wenn bekannt.
- `gear`: konkrete Waffen/Stratagems gegen diesen Feind (englische Spielnamen).
- `imageLarge`: hochauflösendes Feindbild fürs Profil (1400-px-Enemy-Icon oder Voll-Render).
- `attacks` (optional): Angriffe fürs Feindprofil; Name, Typ, Reichweite, Gefahr und Kurzbeschreibung.
- Strukturen (Bug Hole, Fabrikator, Jammer, Detector Tower, Warp Ship, Gunship Facility …)
  kommen als `class: "structure"` in dieselbe Liste, `threat` 1–3, `weakspots` z. B.
  „Nur Sprengstoff (Demolition Force)“.

## data/missions.json

```json
{
  "missions": [
    {
      "id": "launch_icbm",
      "name": "Launch ICBM",
      "de": "ICBM-Start",
      "category": "main",
      "faction": "any",
      "summary": "1–2 Sätze.",
      "steps": ["...", "..."],
      "stepImages": [
        "assets/img/missions/steps/hatchery.png",
        "assets/img/missions/steps/eggs.png"
      ],
      "tips": ["...", "..."],
      "required": ["Terminal aktivieren", "Code eingeben"],
      "rewards": "500 Requisition, 100 XP",
      "time": "3–5 Min",
      "source": "https://helldivers.wiki.gg/wiki/..."
    }
  ]
}
```

- `category`: `main` | `tactical` | `event`
- `faction`: `any` | `terminids` | `automatons` | `illuminate` | `superearth`
- `stepImages`: ein Bild pro Eintrag in `steps`; die Bibliothek liegt in
  `assets/img/missions/steps/`, ICBM nutzt eigene Fotos.
- `required` = was man vor Ort tun muss (keine Stratagem-IDs nötig).

## data/weapons.json

```json
{
  "weapons": [
    {
      "id": "ar_23_liberator",
      "name": "AR-23 Liberator",
      "category": "primary",
      "type": "Sturmgewehr",
      "pen": 2,
      "mag": 45,
      "fire": "Auto / Einzelfeuer",
      "image": "assets/img/weapons/hi/ar_23_liberator.png",
      "damage": "90 Ballistic",
      "damageType": "Ballistic",
      "ap": "2 AP",
      "fireRate": "640 rpm",
      "dps": "960",
      "capacity": "45",
      "recoil": "11",
      "reload": "3s",
      "spareMags": "8",
      "firingModes": "Auto · Semi · Burst",
      "weaponType": "Assault Rifles",
      "sourceLabel": "Starter Equipment",
      "traits": ["Mittelstrecke", "Allrounder"],
      "role": "1–2 Sätze: wofür die Waffe gut ist.",
      "verdict": "1 Satz für Einsteiger.",
      "unlock": "Helldivers Mobilize, Seite 1",
      "source": "https://helldivers.wiki.gg/wiki/AR-23_Liberator"
    }
  ]
}
```

- `category`: `primary` | `secondary` | `grenade` | `support`
- `pen`: Panzerungsdurchdringung 1–10 — **2 = leicht, 3 = mittel, 4 = schwer,
  5–7 = Panzerabwehr I–III**. Wenn unbekannt: `null`.
- `mag`: Magazingröße, `null` wenn nicht zutreffend.
- `unlock`: Warbond + Seite oder Freischaltung; `"Standard"` wenn von Anfang an.
- `image`: 1200-px-Render aus der Wiki (transparent, auf das Motiv zugeschnitten).
- `damage`/`fireRate`/`dps`/`recoil`/`reload`/`spareMags`: Infobox-Werte für den Steckbrief; dürfen leer sein.
- `capacity` und `ap` werden zusätzlich zu `mag`/`pen` aus der Wiki übernommen.

## data/stratagems.json

Basis: `data/stratagems-source.json` (117 Einträge, Icons in `assets/icons/`).
Jeder Eintrag behält **alle** Felder und bekommt zusätzlich:

```json
{
  "beschreibung": "1–2 Sätze: was das Stratagem tut, wann man es wirft.",
  "rolle": "Flächenangriff",
  "staerken": ["..."],
  "schwaechen": ["..."]
}
```

`rolle` aus: `Flächenangriff`, `Panzerabwehr`, `Präzision`, `Geschütz`, `Verteidigung`,
`Unterstützung`, `Versorgung`, `Mobilität`, `Aufklärung`, `Mission`, `Verstärkung`.
Kategorien: `orbital`, `eagle`, `support`, `backpack`, `sentry`, `mine`,
`emplacement`, `vehicle`, `mission`.

## data/armor.json

```json
{
  "classes": [
    { "id": "light", "name": "Leicht", "armor": "100–150", "note": "Schnell, wenig Schutz." }
  ],
  "passives": [
    {
      "id": "engineering_kit",
      "name": "Engineering Kit",
      "effect": "1–2 Sätze, exakte Werte wenn bekannt.",
      "rating": "S",
      "note": "Für wen?"
    }
  ],
  "sets": [
    { "name": "CE-27 Ground Breaker", "passive": "Engineering Kit", "class": "medium", "unlock": "Helldivers Mobilize" }
  ]
}
```

## data/boosters.json

```json
{ "boosters": [ { "id": "...", "name": "...", "effect": "...", "rating": "A", "note": "..." } ] }
```

## data/economy.json

```json
{
  "currencies": [
    { "id": "requisition", "name": "Requisition Slips", "de": "Bereitstellungsmarken",
      "icon": "RS", "color": "#e8c33a", "earn": ["..."], "spend": ["..."],
      "cap": "50.000", "note": "..." }
  ],
  "vendors": [
    { "id": "ship_modules", "name": "Super-Destroyer-Module", "currency": "requisition",
      "where": "Schiff → Module", "what": "..." }
  ],
  "warbonds": [
    { "id": "helldivers_mobilize", "name": "Helldivers Mobilize", "type": "Standard",
      "cost": 0, "pages": 3, "theme": "...", "highlights": ["..."], "released": "2024-02" }
  ],
  "ship_modules": [
    { "id": "...", "name": "...", "category": "Hangar", "cost": 100,
      "samples": { "common": 60, "rare": 0, "super": 0 },
      "effect": "...", "requires": null }
  ],
  "progression": [ { "step": 1, "title": "...", "text": "..." } ]
}
```

## data/planets.json

```json
{
  "hazards": [ { "id": "fire_tornados", "name": "Fire Tornados", "de": "Feuertornados",
    "effect": "...", "counter": "...", "severity": "hoch" } ],
  "modifiers": [ { "id": "ion_storms", "name": "Ion Storms", "de": "Ionenstürme",
    "kind": "operation", "effect": "...", "counter": "..." } ],
  "forces": [ { "faction": "terminids", "name": "Predator Strain", "effect": "..." } ],
  "biomes": [ { "name": "Dschungel", "note": "..." } ]
}
```

- `hazards` = Environmental Conditions (Wetter/Geologie, immer aktiv)
- `modifiers` = Operation Modifiers + Operational Effects (`kind`: `operation` | `operational`)
- `forces` = Combatant Forces / Subfraktionen / Divisionen

## data/guide.json

```json
{
  "chapters": [
    { "id": "grundlagen", "number": "I", "title": "Grundausbildung",
      "intro": "...", "blocks": [ { "type": "p", "text": "..." },
        { "type": "list", "items": ["..."] },
        { "type": "callout", "title": "...", "text": "..." },
        { "type": "table", "head": ["..."], "rows": [["..."]] } ] }
  ]
}
```
