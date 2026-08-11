# Parkolóhely kezelő rendszer

## Rendszerterv

A parkolóhely kezelő rendszer feladatát egy Node.JS Express szerveroldal látja el, mely JSON formátumú REST API-ként működik. HTTP kéréseken keresztül kommunikál. Az adatbázis szerepét pedig egy relációs adatbázis tölti be(MySQL). A phpMyAdmin az adatbázis adminisztrációját és az adatok manuális kezelését és ellenőrzését szolgálja.

A könnyű telepíthetőség érdekében Docker containerekben futnak az alkalmazás különböző részei. 3 konténert tartalmaz:

- A node.js futtatására alkalmas környezetet
- A MySQL szerver konténere
- A phpMyAdmin felület konténere

A szerveroldal a kliensalkalmazásoktól kapott kéréseket dolgozza fel és ad rá választ. Kiemelten fontos, hogy egy parkolóhelyre lévő foglalásoknál időbeli fedés ne történjen meg. A kliensek a foglalásaik le is tudják mondani, amennyiben arra van szükségük. A kliensek rendszám alapján azonosítják maguk, nincs egyéb autentikációs folyamat.
Beépítésre került több típusú parkolóhely. Lehet családi parkoló, mozgássérült parkoló, fenntartott parkoló és normál parkoló. Ezeket a kliensoldal közli a szerverrel, hogy mire jogosult a felhasználó. Ez később bővíthető egyéb megerősítésekkel is. (Pl. rokkantság hivatalos dokumentummal való igazolása)

Az adatbázisban tárolásra kerülnek a létező parkolóhelyek és azok típusai (id, number, type), illetve a parkolóhely foglalások adatai. (id, slot_id, plate, park_start_date, park_end_date, created_at, deleted)

## API-leírás

Az alábbi endpointok az `index.js` alapján érhetők el.

### 1. Parkolóhelyek lekérdezése

**GET** `/v1/getParkingSlots`

Az összes parkolóhely információjának lekérdezése a jelenleg ott parkoló jármű információival.

| Paraméter  | Típus                              | Kötelező | Leírás                                                                                                                          |
| ---------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `reserved` | `string` (`'true'` vagy `'false'`) | Nem      | Ha `true`, csak az aktuálisan foglalt helyeket adja vissza. Ha `false` vagy nincs megadva, az összes parkolóhelyet adja vissza. |

### 2. Egy parkolóhely lekérdezése

Egy adott parkolóhely lekérdezése akár azonosítió szám, akár rendszám alapján.

**GET** `/v1/getParkingSlot`

| Paraméter     | Típus                  | Kötelező | Leírás                                |
| ------------- | ---------------------- | -------- | ------------------------------------- |
| `parkingSlot` | `string` vagy `number` | Nem\*    | A parkolóhely azonosítója.            |
| `plate`       | `string`               | Nem\*    | A rendszám alapján keresett foglalás. |

\* A két paraméter közül legalább az egyik kötelező, de egyszerre nem adhatók meg.

### 3. Parkolóhely lefoglalása

Egy parkolóhely lefoglalása.

**POST** `/v1/reserveParkingSlot`

| Paraméter         | Típus                  | Kötelező | Leírás                                                                        |
| ----------------- | ---------------------- | -------- | ----------------------------------------------------------------------------- |
| `slot_id`         | `number` vagy `string` | Igen     | A foglalni kívánt parkolóhely azonosítója.                                    |
| `plate`           | `string`               | Igen     | A jármű rendszáma.                                                            |
| `park_start_time` | `string` (dátum/idő)   | Igen     | A foglalás kezdete, például ISO 8601 formátumban. MOST < IDŐ \|\| MOST >= IDŐ |
| `park_end_time`   | `string` (dátum/idő)   | Igen     | A foglalás vége, például ISO 8601 formátumban. MOST < IDŐ                     |
| `is_family`       | `boolean`              | Nem      | Családi parkolóhelyre jogosultságot jelez.                                    |
| `is_accessible`   | `boolean`              | Nem      | Akadálymentes parkolóhelyre jogosultságot jelez.                              |

### 4. Foglalás lemondása

**DELETE** `/v1/cancelReservation`

| Paraméter | Típus    | Kötelező | Leírás                                                         |
| --------- | -------- | -------- | -------------------------------------------------------------- |
| `plate`   | `string` | Igen     | Annak a foglalásnak a rendszáma, amelyet le szeretnél mondani. |

### Általános megjegyzések

- Az API JSON választ ad vissza.
- A `park_start_time` és `park_end_time` időpontoknál a backend időbeli átfedést is ellenőriz.
- A `is_family` és `is_accessible` értékek alapján a rendszer a jogosult parkolóhelytípusokat szűri.
- A lekérdezésekben a törölt foglalások `deleted = 1` jelölést kapnak, és nem jelennek meg aktív foglalásként.

## Felhasználói kézikönyv

Szükséges környezet: Docker

A projekt elindításának metódusa: `docker compose up -d`

A containerek elindulását követően a következő útvonalakon elérhetőek a szolgáltatások:

- http://localhost:5000/ - Node.JS szerveroldal
- http://localhost:8080/ - phpMyAdmin kezelőfelület
