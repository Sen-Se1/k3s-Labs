# TaskMaster — Déploiement Kubernetes sur K3s

Documentation du mini-projet 2 : application de gestion des tâches en trois tiers, avec frontend Nginx, API Node.js/Express et base PostgreSQL.

- **Dépôt :** https://github.com/Sen-Se1/k3s-Labs/tree/main/mini-project-2
- **Cahier de laboratoire :** https://h-hafsi.github.io/Kubernetes-Training-Labs/partie-2-configuration-donnees-securite/mini-projet-2/

## 1. Architecture

```text
Navigateur
    |
    v
Traefik Ingress (app.k3s.local:80)
    |
    v
frontend-svc:8080 -> Pods frontend (Nginx)
                           |
                           | /api/*
                           v
                      api-svc:3000 -> API Node.js/Express
                                          |
                                          | TCP 5432
                                          v
                                     PostgreSQL (db-0)
                                          |
                                          v
                                      PVC data-db-0

CronJob db-backup -> pg_dump -> PVC backup-pvc
```

L'application comporte trois composants principaux :

- **Frontend :** interface web statique servie par Nginx.
- **API :** service Node.js/Express qui gère les tâches.
- **Base de données :** PostgreSQL avec stockage persistant.

Les Services applicatifs sont internes au cluster. L'accès web passe par l'Ingress Traefik.

## 2. Prérequis

- Un cluster Kubernetes ou K3s opérationnel et accessible avec `kubectl`.
- Un compte disposant des droits nécessaires pour créer les ressources du projet.
- Une StorageClass `local-path` fonctionnelle.
- Traefik disponible comme contrôleur Ingress.
- Les images accessibles depuis les nœuds :
  - `sen5e1/task-backend:1.2`
  - `sen5e1/task-frontend:1.2`
  - `postgres:15-alpine`
  - `postgres:15-alpine` pour le job de sauvegarde.
- Git et un terminal sur la machine d'administration.
- Un poste client capable de résoudre le nom `app.k3s.local`.
- Un moteur réseau qui applique effectivement les NetworkPolicies.

Vérifier l'environnement :

```bash
kubectl get nodes -o wide
kubectl get storageclass
kubectl get pods -n kube-system
kubectl get ingressclass
```

Le stockage `local-path` est local au nœud qui héberge le volume ; il ne constitue pas une réplication entre nœuds.

## 3. Récupération du projet

```bash
git clone https://github.com/Sen-Se1/k3s-Labs.git
cd k3s-Labs/mini-project-2
```

Vérifier les fichiers :

```bash
ls -la
ls -la k8s
```

Les principaux manifests sont :

| Fichier | Fonction |
|---|---|
| `00-namespace.yaml` | Namespace et labels Pod Security |
| `01-resource-quota.yaml` | Quotas de ressources |
| `02-limit-range.yaml` | Limites et valeurs par défaut des conteneurs |
| `03-configmap.yaml` | Configuration non sensible |
| `04-secret.example.yaml` | Modèle de Secret |
| `05-service-accounts.yaml` | ServiceAccounts |
| `06-postgres-service.yaml` | Service headless PostgreSQL |
| `07-postgres-statefulset.yaml` | PostgreSQL et PVC de données |
| `08-api.yaml` | API et Service `api-svc` |
| `09-frontend.yaml` | Nginx, ConfigMap et Service frontend |
| `10-ingress.yaml` | Entrée HTTP Traefik |
| `11-backup-pvc.yaml` | PVC des sauvegardes |
| `12-backup-cronjob.yaml` | Sauvegarde planifiée |
| `13-rbac-viewer.yaml` | Role et RoleBinding du compte de lecture |
| `14-network-policies.yaml` | Filtrage du trafic entrant |

## 4. Configuration et secrets

La ConfigMap `task-app-config` contient notamment :

- `POSTGRES_HOST=db`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=taskdb`
- `BACKEND_PORT=3000`
- `API_URL=http://api-svc:3000`

Les identifiants de la base sont stockés dans le Secret `db-credentials`. Il ne faut jamais commiter de mot de passe réel dans le dépôt.

Commencer par créer le namespace :

```bash
kubectl apply -f k8s/00-namespace.yaml
```

Créer ensuite le Secret directement dans le cluster :

```bash
kubectl create secret generic db-credentials \
  -n task-app \
  --from-literal=POSTGRES_USER=taskuser \
  --from-literal=POSTGRES_PASSWORD='REMPLACER_PAR_UN_MOT_DE_PASSE_FORT'
```

Remplacer la valeur d'exemple par un mot de passe fort. Ne pas enregistrer ce mot de passe dans ce README ou dans Git.

Créer le ConfigMap utilisé pour initialiser PostgreSQL :

```bash
kubectl create configmap postgres-init-sql \
  -n task-app \
  --from-file=init.sql=app/db/init.sql \
  --dry-run=client -o yaml | kubectl apply -f -
```

Le script `init.sql` ne s'exécute automatiquement que lorsque PostgreSQL initialise un répertoire de données vide. Modifier le script ne rejoue pas automatiquement son contenu dans une base déjà initialisée.

## 5. Ordre de déploiement

Exécuter les commandes depuis `mini-project-2`.

### Étape 1 — Namespace et ressources

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-resource-quota.yaml
kubectl apply -f k8s/02-limit-range.yaml
```

### Étape 2 — Configuration et ServiceAccounts

```bash
kubectl apply -f k8s/03-configmap.yaml
kubectl apply -f k8s/05-service-accounts.yaml
```

Avant de poursuivre, vérifier que les ressources `db-credentials` et `postgres-init-sql` existent.

### Étape 3 — PostgreSQL

```bash
kubectl apply -f k8s/06-postgres-service.yaml
kubectl apply -f k8s/07-postgres-statefulset.yaml

kubectl rollout status statefulset/db \
  -n task-app --timeout=180s

kubectl get pods,pvc -n task-app
```

Attendre que `db-0` soit prêt et que son PVC soit `Bound`.

### Étape 4 — API

```bash
kubectl apply -f k8s/08-api.yaml

kubectl rollout status deployment/api \
  -n task-app --timeout=180s

kubectl get pods -n task-app -l tier=api
```

L'API utilise une initContainer pour attendre PostgreSQL. La readiness probe vérifie `/ready` et la liveness probe utilise `/health`.

### Étape 5 — Frontend et Ingress

```bash
kubectl apply -f k8s/09-frontend.yaml

kubectl rollout status deployment/frontend \
  -n task-app --timeout=180s

kubectl apply -f k8s/10-ingress.yaml

kubectl get services,ingress -n task-app
```

Configurer la résolution du nom `app.k3s.local` sur le poste client. Par exemple, si l'adresse suivante est réellement joignable depuis le poste client, ajouter cette ligne au fichier `hosts` :

```text
192.168.122.180 app.k3s.local
```

Adapter l'adresse IP à l'environnement.

Tester l'Ingress :

```bash
curl -i -H 'Host: app.k3s.local' http://192.168.122.180/
```

Puis ouvrir `http://app.k3s.local` dans le navigateur.

### Étape 6 — Sauvegardes

```bash
kubectl apply -f k8s/11-backup-pvc.yaml
kubectl apply -f k8s/12-backup-cronjob.yaml

kubectl get pvc -n task-app
kubectl get cronjob -n task-app
```

Le CronJob est planifié toutes les cinq minutes. Pour lancer immédiatement un job de sauvegarde :

```bash
kubectl create job \
  --from=cronjob/db-backup \
  backup-manual-$(date +%s) \
  -n task-app
```

Vérifier les jobs et leurs Pods :

```bash
kubectl get jobs -n task-app
kubectl get pods -n task-app -l tier=backup
```

Consulter les logs du Pod concerné :

```bash
kubectl logs -n task-app NOM_DU_POD_BACKUP
```

Le log doit confirmer la création d'un fichier SQL non vide.

### Étape 7 — RBAC et NetworkPolicies

```bash
kubectl apply -f k8s/13-rbac-viewer.yaml
kubectl apply -f k8s/14-network-policies.yaml
```

Vérifier les ressources :

```bash
kubectl get serviceaccounts,role,rolebinding -n task-app
kubectl get networkpolicy -n task-app
```

Tester le compte de lecture `dev-viewer` :

```bash
kubectl auth can-i list pods \
  -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i get pods/log \
  -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i list services \
  -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i delete pods \
  -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i get secrets \
  -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer
```

Résultats attendus : `yes`, `yes`, `yes`, `no`, `no`, sous réserve qu'aucune autre règle RBAC n'accorde des permissions supplémentaires.

Les NetworkPolicies doivent permettre les flux Traefik vers frontend, frontend vers API, et API/job de sauvegarde vers PostgreSQL. Le test de connectivité doit confirmer que les Pods non autorisés ne peuvent pas se connecter à la base.

La présence d'une NetworkPolicy ne prouve pas à elle seule que le réseau l'applique. Vérifier le fonctionnement effectif du moteur de politiques réseau de K3s.

## 6. Contrôles après déploiement

```bash
kubectl get pods -n task-app
kubectl get services,ingress -n task-app
kubectl get pvc -n task-app
kubectl get events -n task-app --sort-by=.lastTimestamp
```

État attendu :

- un Pod PostgreSQL prêt ;
- deux réplicas de l'API prêts ;
- deux réplicas du frontend prêts ;
- PVC de données et de sauvegarde `Bound` ;
- Ingress associé à Traefik ;
- CronJob de sauvegarde créé.

En cas de problème :

```bash
kubectl describe pod NOM_DU_POD -n task-app
kubectl logs NOM_DU_POD -n task-app
kubectl logs NOM_DU_POD -n task-app --previous
```

Ne pas supprimer le PVC PostgreSQL pour résoudre un simple problème de Pod : cela risque de détruire les données.

## 7. Procédure de restauration

### 7.1 Créer une sauvegarde

Déclencher une sauvegarde :

```bash
kubectl create job \
  --from=cronjob/db-backup \
  restore-guide-backup-$(date +%s) \
  -n task-app
```

Puis vérifier l'exécution :

```bash
kubectl get jobs -n task-app
kubectl get pods -n task-app -l tier=backup
kubectl logs -n task-app NOM_DU_POD_BACKUP
```

Le CronJob utilise `pg_dump` pour générer un fichier SQL dans `/backup`, répertoire monté depuis le PVC `backup-pvc`.

### 7.2 Examiner les fichiers de sauvegarde

Pour inspecter les fichiers, un Pod temporaire peut monter `backup-pvc` en lecture seule :

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: backup-inspector
  namespace: task-app
spec:
  restartPolicy: Never
  automountServiceAccountToken: false
  containers:
    - name: inspector
      image: postgres:15-alpine
      command: ["/bin/sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: backup
          mountPath: /backup
          readOnly: true
  volumes:
    - name: backup
      persistentVolumeClaim:
        claimName: backup-pvc
```

Enregistrer ce manifeste dans un fichier temporaire, puis exécuter :

```bash
kubectl apply -f /tmp/backup-inspector.yaml
kubectl exec -n task-app backup-inspector -- ls -lh /backup
```

Supprimer le Pod de diagnostic après la vérification :

```bash
kubectl delete pod backup-inspector -n task-app
```

### 7.3 Restaurer un dump SQL

Les fichiers générés par `pg_dump --format=plain` peuvent être restaurés avec `psql`.

La restauration doit être réalisée depuis un environnement qui dispose du fichier de dump, des outils PostgreSQL et des paramètres de connexion. Utiliser le Secret pour le mot de passe, sans l'écrire dans le dépôt ou dans l'historique du shell.

Exemple de commande :

```bash
psql -v ON_ERROR_STOP=1 \
  --host=db \
  --port=5432 \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --file=/backup/NOM_DU_DUMP.sql
```

Cette commande suppose que `POSTGRES_USER` et `POSTGRES_DB` sont définis dans l'environnement et que le dump est monté sur `/backup`.

**Précaution :** avant une restauration complète, vérifier le dump et choisir une base cible adaptée. Un dump complet peut contenir des opérations qui entrent en conflit avec les tables et données déjà présentes. Pour un test, privilégier une base de test ou une table de démonstration. Pour une restauration de production, prévoir une fenêtre de maintenance et une procédure de retour arrière.

Après restauration, vérifier les tables et les données, puis tester l'API et l'application depuis le navigateur.

### 7.4 Limites du stockage

La suppression du Pod `db-0` ne doit pas supprimer le PVC qui conserve les données. Le StatefulSet peut recréer le Pod et rattacher le volume.

Cependant, `local-path` ne réplique pas les données entre plusieurs nœuds. De même, le PVC de sauvegarde ne constitue pas une copie externe. Pour une meilleure résilience, exporter les sauvegardes vers un stockage hors cluster ou hors nœud et tester régulièrement leur restauration.

## 8. Bonnes pratiques de sécurité

- Ne pas commiter de fichier `.env` réel ni de Secret avec des identifiants réels.
- Garder `04-secret.example.yaml` comme modèle uniquement.
- Utiliser des ServiceAccounts dédiés et désactiver le montage automatique des tokens lorsqu'ils ne sont pas nécessaires.
- Maintenir les requests et limits des ressources.
- Conserver les probes de readiness et de liveness.
- Appliquer le principe du moindre privilège avec RBAC.
- Vérifier les flux réseau autorisés et interdits en pratique.
- Documenter les résultats des tests Pod Security et NetworkPolicies.
- Se rappeler que des politiques limitées à `Ingress` n'interdisent pas, à elles seules, le trafic sortant.

## 9. Nettoyage

Avant toute suppression, vérifier l'effet sur les données persistantes. La suppression du namespace `task-app` ou des PVC peut entraîner une perte de données.

Ne supprimer le namespace complet que si les ressources et les données doivent réellement être détruites :

```bash
kubectl delete namespace task-app
```

Cette commande est destructive et ne doit pas être utilisée comme première étape de dépannage.
