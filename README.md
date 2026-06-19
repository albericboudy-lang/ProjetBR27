# Pilotage du projet — BR2027

Tableau de bord **interne** et **en lecture seule** du programme présidentiel Bruno Retailleau 2027.
Il reflète la base Notion « Chantiers », se régénère tout seul, se partage par un simple lien et
reste **protégé par un mot de passe** : sans lui, ni les données ni les documents ne sont lisibles.

> **Source unique de vérité : Notion.** L’équipe saisit et met à jour *uniquement* dans Notion.
> Le site n’est qu’un **miroir chiffré** régénéré automatiquement — on n’y saisit rien.

---

## 1. Comment ça marche (architecture)

Une page statique ne peut pas lire Notion directement (la clé API n’est pas exposable côté
navigateur, et les liens de fichiers Notion expirent en ~1 h). On passe donc par un **script de
génération** exécuté périodiquement :

```
Notion ──► scripts/generate.mjs ──► dist/ (chiffré) ──► GitHub Pages ──► navigateur (déchiffre)
  │              │                      │                                      │
  │              │ lit l’API Notion     │ manifest.json (sel + params)         │ saisie du mot de passe
  │              │ recopie les fichiers │ data.enc  (chantiers, AES-GCM)       │ PBKDF2 → clé AES-GCM
  │              │ chiffre tout         │ files/*.enc (PDF, AES-GCM)           │ déchiffre en mémoire
```

- **Rien n’est publié en clair.** `data.enc` et `files/*.enc` sont des blobs chiffrés
  (AES-GCM 256). Le `manifest.json` public ne contient que des paramètres cryptographiques
  (sel, nombre d’itérations) — aucune donnée.
- **Clé dérivée du mot de passe** par PBKDF2-SHA256 (600 000 itérations). Le déchiffrement a
  lieu **dans le navigateur** (WebCrypto), après saisie du mot de passe.
- **Aucun serveur permanent**, pas de Vercel. Hébergement **GitHub Pages**, automatisation
  **GitHub Actions** (horaire + manuel).

### Pile technique
- Génération : **Node.js** + SDK officiel **`@notionhq/client`** (API data sources 2025), chiffrement avec le module `crypto`.
- Site : **HTML / CSS / JS vanilla** (aucun framework). Déchiffrement **WebCrypto** (AES-GCM, PBKDF2).
- Polices auto-hébergées (Spectral + IBM Plex Sans) — **aucune requête externe**, pas d’analytics, pas de cookies.

---

## 2. Mise en service (première fois)

### a. Intégration Notion
1. Créer une **intégration interne** : <https://www.notion.so/my-integrations> → *New integration*
   → capacités **lecture seule** suffisent → copier le **token** (`ntn_…`).
2. **Partager la base « Chantiers » avec l’intégration** : ouvrir la base dans Notion →
   menu `•••` → *Connections* / *Connexions* → ajouter l’intégration.
   *(Sans ce partage, l’API ne voit rien.)*

### b. Secrets du dépôt GitHub
Dans **Settings → Secrets and variables → Actions → New repository secret**, créer :

| Secret | Valeur |
|---|---|
| `NOTION_TOKEN` | le token `ntn_…` de l’intégration |
| `NOTION_DATA_SOURCE_ID` | `21366175-3d72-401c-9ecc-b76b1ac513bf` *(la data source « Chantiers »)* |
| `SITE_PASSWORD` | le mot de passe partagé d’accès au site (choisir un mot de passe **fort**) |

### c. Activer GitHub Pages
**Settings → Pages → Build and deployment → Source : GitHub Actions.**

### d. Première publication
Onglet **Actions → « Régénérer & publier le pilotage » → Run workflow**.
L’URL publiée apparaît dans le job *deploy* (et dans Settings → Pages).

> **Avant la configuration des secrets**, le site se publie quand même en **mode démonstration**
> (3+ chantiers fictifs, mot de passe `BR27-demo`). Dès que `NOTION_TOKEN` + `SITE_PASSWORD`
> sont renseignés, il bascule sur les **vraies données** et votre mot de passe.

---

## 3. Exploitation au quotidien

### Forcer une mise à jour
Le site se régénère **toutes les heures** automatiquement. Pour rafraîchir tout de suite :
**Actions → Run workflow** (`workflow_dispatch`). Le bouton ↻ dans l’app recharge la dernière
version publiée sans redemander le mot de passe.

### Changer le mot de passe
Modifier le secret **`SITE_PASSWORD`** (Settings → Secrets) puis relancer le workflow
(**Run workflow**). Le prochain build re-chiffre tout avec le nouveau mot de passe ; l’ancien
ne déverrouille plus rien. *Diffuser le nouveau mot de passe par un canal sûr.*

### Reprise des chantiers / édition
Tout se passe **dans Notion** (base « Chantiers »). Le site se met à jour à la régénération
suivante. La colonne **« Documents de travail »** reste **interne** : elle n’est jamais lue ni
publiée par le site.

---

## 4. Développement local

```bash
npm install

# Aperçu avec données de DÉMONSTRATION (aucune connexion Notion requise)
npm run build:fixture      # génère dist/ (mot de passe : BR27-demo)
npm run serve              # http://localhost:4317

# Build LIVE depuis la vraie base Notion (Node 20.6+)
node --env-file=.env scripts/generate.mjs   # cf. .env.example
npm run serve

# Tests
npm run test:crypto        # prouve l’interop chiffrement Node ↔ déchiffrement WebCrypto
```

`web/` = code source du site · `scripts/generate.mjs` = pipeline · `fixtures/` = jeu de démonstration · `dist/` = sortie publiée (générée, non versionnée).

---

## 5. Faire évoluer le design et les ressources

- **Couleurs, typographie, espacements** : tout est en jetons CSS en haut de
  [`web/styles.css`](web/styles.css) (`:root` clair + bloc `prefers-color-scheme: dark`).
  Piliers, états, tailles (4 max dans l’interface) y sont centralisés.
- **Logo** : `web/assets/logo/` (`br-mark.svg` clair, `br-mark-white.svg` pour fonds sombres).
  Remplacer le fichier en gardant le même nom.
- **Photo d’accès** : `web/assets/img/hero-br.webp`. Remplacer par une image optimisée
  (WebP conseillé) du même nom.
- **Polices** : `web/assets/fonts/*.woff2` (déclarées dans `styles.css`).
- **Icônes** : sprite Lucide en ligne dans [`web/index.html`](web/index.html) (`<symbol>` / `<g id="i-…">`).

Le mapping des colonnes Notion → interface est dans `scripts/generate.mjs` (lecture **défensive** :
toute propriété du cahier des charges est lue si elle existe, ignorée sinon).

---

## 6. Sécurité

- Contenu (données **et** fichiers) **chiffré au repos** sur GitHub Pages ; déchiffrement
  **uniquement** côté navigateur après mot de passe (AES-GCM 256, clé PBKDF2-SHA256 600 000 itérations).
- `NOTION_TOKEN` et `SITE_PASSWORD` **jamais committés** — uniquement en secrets GitHub.
- Site **non indexé** : `noindex,nofollow` + `robots.txt` *Disallow*. URL non devinable en
  défense en profondeur, le mot de passe restant la vraie barrière.
- Aucun analytics tiers, aucun cookie. La colonne **« Documents de travail » n’est jamais exposée**.

---

## 7. Livrables & arborescence

```
.github/workflows/deploy.yml   CI/CD : cron horaire + manuel + push → build → Pages
scripts/generate.mjs           lecture Notion, recopie+chiffrement des fichiers, build dist/
scripts/crypto.mjs             chiffrement (miroir exact de la décryption WebCrypto)
scripts/crypto.test.mjs        test d’interopérabilité du chiffrement
scripts/serve.mjs              serveur statique local (aperçu)
web/                           site : index.html · styles.css · app.js · robots.txt · assets/
fixtures/                      jeu de démonstration (chantiers + PDF d’exemple)
```

Site testé : desktop et mobile (≤ 400 px), clavier, contrastes AA, mode sombre.
