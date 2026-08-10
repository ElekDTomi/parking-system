# Sonrisa - Docker Compose Stack

Egy teljes fejlesztési stack MySQL szerverrel, phpMyAdmin felülettel és Node.js Express backendel.

## 📋 Előfeltételek

- Docker
- Docker Compose

## 🚀 Gyors indítás

### 1. Projekt indítása

Egyetlen paranccsal indítsd el az egész alkalmazást:

```bash
docker compose up -d
```

A `-d` flag a háttérben futtatja a containereket.

### 2. Leállítás

```bash
docker compose down
```

Az adatok megmaradnak a `mysql_data` volume-ban.

### 3. Leállítás és adatok törlése

```bash
docker compose down -v
```

## 🌐 Hozzáférés az alkalmazásokhoz

- **Express Backend**: http://localhost:5000
  - Health check: http://localhost:5000/health
  - DB Status: http://localhost:5000/api/db-status
  - Users: http://localhost:5000/api/users

- **phpMyAdmin**: http://localhost:8080
  - Felhasználó: `sonrisa_user`
  - Jelszó: `sonrisa_password`
  - Root jelszó: `root_password`

- **MySQL**: `localhost:3306`
  - Host: `mysql` (Docker network-ből)
  - Felhasználó: `sonrisa_user`
  - Jelszó: `sonrisa_password`
  - Adatbázis: `sonrisa_db`

## 📝 Konfigurációs fájlok

### `docker-compose.yml`
A Docker containerek orchestrációját definiálja.

### `Dockerfile`
A Node.js Express alkalmazás Docker image-jét építi fel.

### `package.json`
A Node.js függőségek listája.

### `index.js`
Az Express szerver fő fájlja.

### `.env.example`
Az environment változók sablona. Szükség esetén másold `.env` fájlként.

## 🔧 Fejlesztés

### Valós idejű módosítások

Az Express alkalmazás módosításai automatikusan frissülnek a containerben (volume mount miatt).

### Új npm csomag telepítése

```bash
docker compose exec backend npm install új-csomag-neve
```

### Backend konténer naplói

```bash
docker compose logs -f backend
```

### MySQL konténer naplói

```bash
docker compose logs -f mysql
```

## 🗄️ Adatbázis inicializálása

Az SQL scriptek futtatásához SSH-zz be a MySQL containerbe:

```bash
docker compose exec mysql mysql -u sonrisa_user -psonrisa_password sonrisa_db < script.sql
```

## 🐛 Hibaelhárítás

### "Port already in use"
Módosítsd a `docker-compose.yml` fájlban a port mappingeket:
- MySQL: `3306:3306` → `3307:3306`
- phpMyAdmin: `8080:80` → `8081:80`
- Backend: `5000:5000` → `5001:5000`

### MySQL Connection Refused
Várd meg, amíg a MySQL healthcheck sikeressé válik:
```bash
docker compose logs mysql
```

### Backend konténer kilépett
Ellenőrizd az npm telepítést:
```bash
docker compose up backend
```

## 📦 Konténerek

- **sonrisa-mysql**: MySQL 8.0 adatbázis szerver
- **sonrisa-phpmyadmin**: phpMyAdmin webfelület
- **sonrisa-backend**: Node.js Express alkalmazás

## 📚 További információ

- [Docker Compose dokumentáció](https://docs.docker.com/compose/)
- [Express.js dokumentáció](https://expressjs.com/)
- [MySQL dokumentáció](https://dev.mysql.com/doc/)
- [phpMyAdmin dokumentáció](https://www.phpmyadmin.net/)

---

**Készen állsz!** 🎉 Az alkalmazás most elérhető a fenti URL-eken.
