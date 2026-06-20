# 🐦 LAPIE Studio

> Studio de transformation d'image **100% self-hosted, gratuit et illimité**.
> Un seul `docker-compose up` et vous disposez de votre propre infrastructure de traitement d'image.

![Stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Stack](https://img.shields.io/badge/Next.js_14-000000?style=flat&logo=nextdotjs&logoColor=white)
![Stack](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

---

## 🚀 Démarrage rapide

```bash
# 1. Cloner / télécharger le projet
cd lapie-studio

# 2. Copier la configuration
cp .env.example .env

# 3. Lancer le studio (premier lancement ~3-5 min pour télécharger le modèle AI)
docker-compose up --build

# 4. Ouvrir dans votre navigateur
open http://localhost:3000
```

---

## 🏗️ Architecture

```
Browser :3000
    │
    ▼
Next.js Frontend (Tailwind + Framer Motion)
    │
    ▼
FastAPI Backend :8000
    ├── rembg (RMBG-1.4 / u2net) ─── Suppression de fond
    ├── potrace (CLI)              ─── Vectorisation PNG→SVG
    └── asyncio.Queue              ─── File d'attente + SSE stream
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Dashboard Next.js |
| Backend | 8000 | API FastAPI |

---

## ⚙️ Configuration

Éditer `.env` pour changer le modèle de détourage :

| Valeur | Qualité | Vitesse | Description |
|--------|---------|---------|-------------|
| `u2net` | ★★★☆ | ★★★★ | Défaut, bon équilibre |
| `u2netp` | ★★☆☆ | ★★★★★ | Ultra-rapide, qualité réduite |
| `isnet-general-use` | ★★★★ | ★★★☆ | Haute qualité générale |
| `birefnet-general` | ★★★★★ | ★★☆☆ | RMBG-1.4 like, qualité maximale |

---

## 📦 Fonctionnalités

- **Suppression de fond** : Modèle RMBG-1.4 open source via `rembg`
- **Vectorisation** : PNG → SVG via `potrace` (qualité professionnelle)
- **File d'attente** : Traitement sérialisé avec progression SSE temps réel
- **Téléchargement** : PNG transparent ou SVG directement depuis le dashboard
- **Comparaison** : Slider avant/après pour voir le résultat

---

## 🛠️ Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24.x
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.x
- Connexion internet (premier lancement uniquement, pour télécharger le modèle AI ~180 MB)

---

## 📁 Structure

```
lapie-studio/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── models/
│   ├── services/
│   └── routers/
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
```

---

## 🔧 Commandes utiles

```bash
# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down

# Arrêter + supprimer le cache modèle (forcer re-téléchargement)
docker-compose down -v

# Rebuild après modification du code
docker-compose up --build
```

---

*Construit avec ❤️ — 100% open source, aucune API payante, aucune limite.*
