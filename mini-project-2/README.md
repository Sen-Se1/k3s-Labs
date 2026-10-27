# Task Management System - Multi-Tier Architecture

Ce projet est un laboratoire complet démontrant la conteneurisation d'une application microservices (Frontend, Backend, Database) avec des pratiques avancées de sécurité et de résilience.

## 🏗️ Architecture du Projet

L'application est composée de trois services principaux :
1.  **Frontend** : Serveur Nginx servant une application statique.
2.  **Backend** : API Node.js/Express connectée à Postgres.
3.  **Database** : Base de données PostgreSQL persistante.

---

## 📁 Structure du Répertoire

```text
Lab-Docker-Compose/
├── 📂 backend/           # Code source de l'API Node.js
│   ├── index.js          # Serveur Express et logique métier
│   └── Dockerfile        # Image multi-stage (Non-root)
├── 📂 frontend/          # Application client statique
│   ├── index.html        # Interface utilisateur
│   └── Dockerfile        # Image Nginx optimisée
├── 📂 db/                # Scripts de base de données
│   └── init.sql          # Schéma initial de la DB
├── 📂 k8s/               # Manifests Kubernetes (Production)
│   ├── 📂 namespaces/    # Isolation des ressources
│   ├── 📂 deployments/   # Deployments & StatefulSets
│   ├── 📂 services/      # Exposition réseau
│   ├── 📂 secrets/       # Données sensibles (Secret unique)
│   ├── 📂 configmaps/    # Configuration statique
│   └── 📂 volumes/       # Persistance des données (PVC)
├── docker-compose.yml    # Orchestration locale (Développement)
├── .env.example          # Modèle des variables d'environnement
└── README.md             # Documentation globale
```

---

## 🐋 Docker Compose (Development & Orchestration Simple)

Le fichier `docker-compose.yml` implémente des concepts avancés pour garantir un environnement de développement robuste.

### 🔒 Sécurité (Non-Root)
Tous les conteneurs sont configurés pour s'exécuter avec des utilisateurs non-privilégiés :
- **Backend** : UID `1000:1000` (`appuser`).
- **Frontend** : UID `101:101` (`nginx`).
- **Database** : Géré par l'image officielle (UID `999`), démarrant en root pour fixer les permissions du volume avant de basculer en utilisateur `postgres`.

### 🩺 Healthchecks & Résilience
Le système ne se contente pas de démarrer les conteneurs, il vérifie leur état de santé :
- **Database** : Utilise `pg_isready` pour confirmer que la DB est prête à accepter des connexions.
- **Backend** : Vérifie l'endpoint `/health`. Attend que la **Database** soit `healthy` avant de démarrer.
- **Frontend** : Vérifie la disponibilité du serveur Web. Attend que le **Backend** soit `healthy` avant de démarrer.

### 🚀 Démarrage rapide
```powershell
# Démarrer l'ensemble du stack
docker compose up -d

# Vérifier l'état de santé
docker compose ps
```

---

## ☸️ Kubernetes (Production Ready)

Le dossier `./k8s` contient l'orchestration complète pour un cluster Kubernetes (testé sur K3s).

### Points clés de l'implémentation K8s :
- **StatefulSet** pour une base de données stable.
- **Zero-Downtime Deployment** via des stratégies `RollingUpdate` paramétrées.
- **Gestion fine des ressources** (Requests/Limits CPU & RAM).
- **Probes avancées** (Liveness & Readiness).

👉 **[Consultez le README Kubernetes détaillé ici](./k8s/README.md)** pour les instructions de déploiement.
