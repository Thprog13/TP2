<div id="top">

<!-- HEADER STYLE: CLASSIC -->
<div align="center">

# TPWEB2 – Plateforme de Validation de Plans de Cours (IA)

<em>Accelerate Innovation, Build Smarter, Lead the Future</em>

<!-- BADGES -->
<img src="https://img.shields.io/github/last-commit/MikeDudley514/tpWeb2?style=flat&logo=git&logoColor=white&color=0080ff" alt="last-commit">
<img src="https://img.shields.io/github/languages/top/MikeDudley514/tpWeb2?style=flat&color=0080ff" alt="repo-top-language">
<img src="https://img.shields.io/github/languages/count/MikeDudley514/tpWeb2?style=flat&color=0080ff" alt="repo-language-count">

<em>Built with the tools and technologies:</em>

<img src="https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white" alt="JSON">
<img src="https://img.shields.io/badge/Markdown-000000.svg?style=flat&logo=Markdown&logoColor=white" alt="Markdown">
<img src="https://img.shields.io/badge/npm-CB3837.svg?style=flat&logo=npm&logoColor=white" alt="npm">
<img src="https://img.shields.io/badge/Autoprefixer-DD3735.svg?style=flat&logo=Autoprefixer&logoColor=white" alt="Autoprefixer">
<img src="https://img.shields.io/badge/Firebase-DD2C00.svg?style=flat&logo=Firebase&logoColor=white" alt="Firebase">
<br>
<img src="https://img.shields.io/badge/PostCSS-DD3A0A.svg?style=flat&logo=PostCSS&logoColor=white" alt="PostCSS">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/React-61DAFB.svg?style=flat&logo=React&logoColor=black" alt="React">
<img src="https://img.shields.io/badge/Vite-646CFF.svg?style=flat&logo=Vite&logoColor=white" alt="Vite">
<img src="https://img.shields.io/badge/ESLint-4B32C3.svg?style=flat&logo=ESLint&logoColor=white" alt="ESLint">

</div>
<br>

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Testing](#testing)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Configuration](#configuration)
- [Technical Choices](#technical-choices)
- [Team](#team)

---

## Overview

TPWEB2 – **Plateforme de validation de plans de cours** est une application web pédagogique développée avec **React (Vite)** et **Firebase**, permettant aux enseignants de générer des plans de cours validés automatiquement par **Intelligence Artificielle (OpenAI)** avant d'être approuvés par un coordonnateur.

Cette plateforme offre une interface moderne, sécurisée et responsive, combinant rapidité de développement et intelligence automatisée pour améliorer l'expérience éducative.

---

## Getting Started

### Prerequisites

- **Programming Language:** JavaScript
- **Package Manager:** Npm
- **Node.js version:** 18.x ou supérieur
- **Firebase Account:** pour l'authentification, Firestore et le hosting

### Installation

```bash
# Cloner le projet
git clone https://github.com/MikeDudley514/tpWeb2.git

# Se déplacer dans le dossier du projet
cd tpWeb2

# Installer les dépendances
npm install
```

## Usage

### Lancer le projet en local

```bash
npm run dev
```

## Features

### 🔐 Authentification & Rôles

- Connexion sécurisée via **Firebase Auth** (Email/Password).
- Gestion des rôles : enseignant et coordonnateur.
- Protection des routes (Route Guards).

### 👨‍🏫 Tableau de bord Enseignant

- Création de plans basés sur des modèles actifs.
- Analyse IA pour validation des réponses.
- Génération PDF stylisés avec **jsPDF**.
- Gestion des plans : modification, suppression, visualisation historique.

### 👮 Tableau de bord Coordonnateur

- Gestion des templates et règles IA.
- Validation automatisée avec feedback IA.
- Approbation ou demande de corrections.
- Statistiques de soumissions et approbations.

### 🤖 Intelligence Artificielle

- Intégration **OpenAI GPT-3.5-turbo**.
- Analyse sémantique et feedback immédiat.
- Amélioration continue des modèles pédagogiques.

---

## Technology Stack

| Technologie      | Utilisation                                |
| ---------------- | ------------------------------------------ |
| React (Vite)     | Frontend performant et réactif             |
| Firebase Auth    | Gestion des utilisateurs et sécurisation   |
| Firestore        | Base de données NoSQL                      |
| Firebase Storage | Stockage des PDFs générés                  |
| Firebase Hosting | Hébergement de l'application               |
| OpenAI API       | Validation intelligente des plans de cours |
| TailwindCSS      | Stylisation moderne et responsive          |
| jsPDF            | Génération de PDF côté client              |

---

## Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine :

```env
VITE_OPENAI_API_KEY=votre_cle_api_openai_ici
```

## Configuration Firebase

1. Créez un projet Firebase.
2. Activez **Email/Password** pour Authentication.
3. Configurez **Firestore** et **Storage**.
4. Ajoutez vos clés dans `src/firebase.js`.

---

## Technical Choices

- **React + Vite:** Rapidité, hot-reload, meilleure expérience développeur.
- **IA pour la validation:** Pré-filtrage automatique, feedback rapide pour les enseignants.
- **Client-side PDF generation:** Confidentialité des données, réduction de charge serveur.

**Structure Firestore:**

- `users` : profils et rôles
- `formTemplates` : modèles et règles IA
- `coursePlans` : plans soumis, snapshots et URLs PDF

---

## Team

**[Votre Nom / Membre 1]**

- Architecture React, routing et session management.
- Dashboard Enseignant et intégration OpenAI.
- Création des formulaires et génération PDF.

**[Nom du coéquipier / Membre 2]**

- Dashboard Coordonnateur et gestion des templates.
- Logique de validation et commentaires.
- UI/UX Design (TailwindCSS, Dark Mode).
- Sécurité Firestore et règles d’accès.
