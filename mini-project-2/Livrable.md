# 1. Description de l'application et architecture

## 1.1 Présentation de TaskMaster

TaskMaster est une application web de gestion de tâches composée de
trois niveaux distincts :

-   **Frontend** : interface web statique servie par Nginx. Le
    navigateur accède au frontend par le nom `app.k3s.local`. Les appels
    `/api/` sont relayés vers l'API depuis le réseau interne du cluster.
-   **API REST** : service Node.js/Express qui porte la logique métier
    et réalise les opérations CRUD (création, lecture, modification et
    suppression) sur les tâches. Il expose `/health` pour vérifier que
    le processus répond et `/ready` pour vérifier que l'API peut accéder
    à la base.
-   **Base de données** : PostgreSQL, qui stocke durablement les tâches.
    Elle est gérée par un StatefulSet et utilise un volume persistant.

Les images utilisées dans le projet sont `sen5e1/task-frontend:1.2`,
`sen5e1/task-backend:1.2` et `postgres:15-alpine`. Les images sont
versionnées avec un tag explicite plutôt que `latest`.

## 1.2 Schéma d'architecture Mermaid

``` mermaid
flowchart TB
    U["Utilisateur / navigateur"]
    T["Traefik Ingress<br/>app.k3s.local:80"]
    FS["Service frontend-svc<br/>port 8080"]
    F["Deployment frontend<br/>Nginx — 2 réplicas"]
    AS["Service api-svc<br/>port 3000"]
    A["Deployment api<br/>Node.js / Express — 2 réplicas"]
    DB["Service headless db<br/>DNS interne"]
    PG["StatefulSet db<br/>Pod db-0 — PostgreSQL:5432"]
    PVC[("PVC data-db-0<br/>volume de données")]
    CJ["CronJob db-backup<br/>pg_dump"]
    BPVC[("PVC backup-pvc<br/>fichiers SQL")]

    U -->|"HTTP / Host app.k3s.local"| T
    T --> FS
    FS --> F
    F -->|"/api/*"| AS
    AS --> A
    A -->|"TCP 5432"| DB
    DB --> PG
    PG --- PVC
    CJ -->|"lecture de PostgreSQL"| DB
    CJ -->|"écriture du dump"| BPVC
```

## 1.3 Rôle des ressources Kubernetes

  ------------------------------------------------------------------------
  Ressource                            Rôle
  ------------------------------------ -----------------------------------
  `Namespace task-app`                 Isole logiquement les ressources du
                                       projet.

  `ResourceQuota`                      Limite la consommation totale de
                                       ressources et le nombre de
                                       ressources du namespace.

  `LimitRange`                         Définit des valeurs par défaut ou
                                       des bornes de ressources pour les
                                       conteneurs.

  `ConfigMap task-app-config`          Stocke les paramètres non
                                       sensibles.

  `Secret db-credentials`              Stocke les identifiants PostgreSQL
                                       hors du code source.

  `Service frontend-svc`               Fournit un point d'accès stable au
                                       frontend.

  `Service api-svc`                    Fournit un point d'accès interne
                                       stable à l'API.

  `Service headless db`                Fournit une identité DNS stable
                                       pour PostgreSQL.

  `StatefulSet db`                     Gère le Pod de base de données et
                                       son identité persistante.

  `PersistentVolumeClaim data-db-0`    Demande un volume persistant pour
                                       les données PostgreSQL.

  `CronJob db-backup`                  Lance périodiquement la sauvegarde
                                       de la base.

  `PersistentVolumeClaim backup-pvc`   Stocke les fichiers de sauvegarde.

  `Ingress` Traefik                    Expose le frontend sous
                                       `app.k3s.local`; l'API et la base
                                       ne sont pas directement exposées.

  `ServiceAccount`, `Role`,            Fournissent des identités et
  `RoleBinding`                        permissions minimales.

  `NetworkPolicy`                      Limite les flux réseau entrants aux
                                       communications nécessaires.
  ------------------------------------------------------------------------

## 1.4 Configuration et fonctionnement

Les paramètres non sensibles (hôte et port de la base, nom de base, port
de l'API et URL interne) sont externalisés dans une ConfigMap. Les
identifiants sont injectés depuis le Secret. Aucun mot de passe réel ne
doit être ajouté au dépôt Git.

Le frontend est exposé par Traefik ; l'API reste accessible par le
Service interne `api-svc`, et PostgreSQL par le Service interne `db`.
Cette architecture applique le principe de réduction de la surface
d'exposition : les utilisateurs externes n'ont pas besoin de joindre
directement l'API ou la base.

Le stockage `local-path` utilisé par le laboratoire est local au nœud
hébergeant le volume. Il protège contre la simple suppression/recréation
du Pod si le PVC reste intact, mais il ne constitue pas une réplication
entre nœuds ni une sauvegarde hors site.

------------------------------------------------------------------------

# 2. Tableau des exigences E1 à E15 et preuves associées

Les exigences ci-dessous reprennent le cahier des charges du
mini-projet. Les commandes fournissent des éléments de preuve ; pour les
résultats dépendant du cluster, joindre les sorties réelles. Les
captures doivent être lisibles, datées si possible, et ne pas exposer de
secrets.

  ------------------------------------------------------------------------------------------------------------------------------------------------------
  Exigence                    Attendu                  Commande / preuve à joindre                                                 Résultat à documenter
  --------------------------- ------------------------ --------------------------------------------------------------------------- ---------------------
  **E1 --- Images**           Les images des trois     `kubectl get pods -n task-app -o wide` ;                                    **\[À INSÉRER\]**
                              composants sont          `kubectl describe pod <pod> -n task-app` ; capture du dépôt d'images ou     Tags réellement
                              construites, versionnées commande `docker image ls`.                                                 utilisés et absence
                              et accessibles aux                                                                                   de
                              nœuds. Pas de tag                                                                                    `ImagePullBackOff`.
                              `latest`.                                                                                            

  **E2 --- Namespace et       Tout est dans            `kubectl get ns task-app`;                                                  **\[À INSÉRER\]**
  ressources**                `task-app`, avec         `kubectl get resourcequota,limitrange -n task-app`;                         Namespace présent,
                              ResourceQuota et         `kubectl describe quota -n task-app`.                                       quotas et limites
                              LimitRange.                                                                                          affichés.

  **E3 --- Configuration**    Les paramètres non       `kubectl get configmap task-app-config -n task-app -o yaml` ;               **\[À INSÉRER\]**
                              sensibles sont dans une  `kubectl describe deploy/api -n task-app`.                                  Variables non
                              ConfigMap.                                                                                           sensibles et
                                                                                                                                   injection dans les
                                                                                                                                   workloads. Masquer
                                                                                                                                   les données
                                                                                                                                   confidentielles si
                                                                                                                                   nécessaire.

  **E4 --- Protection des     Aucun secret réel n'est  `git status --short`; `git ls-files | grep -Ei 'secret|\\.env'`; revue de   **\[À INSÉRER\]** Le
  secrets**                   versionné dans Git ;     `.gitignore` et `04-secret.example.yaml`.                                   dépôt contient
                              seul un modèle est                                                                                   uniquement un modèle
                              fourni.                                                                                              avec des valeurs
                                                                                                                                   fictives.

  **E5 --- Base de données**  PostgreSQL est déployé   `kubectl get statefulset,svc -n task-app`;                                  **\[À INSÉRER\]**
                              par StatefulSet avec     `kubectl get statefulset db -n task-app -o yaml`;                           StatefulSet `db`,
                              `volumeClaimTemplates`   `kubectl get pvc -n task-app`.                                              Service headless et
                              et Service headless.                                                                                 PVC associé.

  **E6 --- Persistance**      Les données survivent à  Avant suppression : insérer une tâche et la vérifier en base. Puis          **\[À INSÉRER\]**
                              la suppression du Pod    `kubectl delete pod db-0 -n task-app`; attendre                             Captures avant/après
                              PostgreSQL.              `kubectl wait --for=condition=Ready pod/db-0 -n task-app --timeout=180s`;   avec la même donnée
                                                       relire la même donnée.                                                      présente. Ne pas
                                                                                                                                   supprimer le PVC.

  **E7 --- Démarrage de       L'API attend que         `kubectl describe pod -l tier=api -n task-app`;                             **\[À INSÉRER\]**
  l'API**                     PostgreSQL soit          `kubectl logs deploy/api -n task-app`; inspection de l'initContainer dans   InitContainer ou
                              disponible.              le manifeste.                                                               mécanisme `/ready` en
                                                                                                                                   place et connexion
                                                                                                                                   réussie.

  **E8 --- Requests et        Chaque conteneur définit `kubectl get deploy,statefulset,cronjob -n task-app -o yaml` puis           **\[À INSÉRER\]**
  limits**                    des demandes et limites  rechercher `resources:` ; `kubectl describe pod <pod> -n task-app`.         Requests et limits
                              CPU/mémoire.                                                                                         visibles pour chaque
                                                                                                                                   conteneur, y compris
                                                                                                                                   les jobs.

  **E9 --- Sondes**           L'API utilise readiness  `kubectl get deploy api -n task-app -o yaml`;                               **\[À INSÉRER\]** Les
                              `/ready` et liveness     `kubectl describe pod -l tier=api -n task-app`.                             deux probes sont
                              `/health`.                                                                                           configurées ; le Pod
                                                                                                                                   est Ready lorsque la
                                                                                                                                   base est joignable.

  **E10 --- Exposition**      Seul le frontend est     `kubectl get ingress,svc -n task-app`;                                      Une réponse HTTP 200
                              exposé par Ingress       `curl -i -H 'Host: app.k3s.local' http://192.168.122.180/`.                 a déjà été observée
                              `app.k3s.local`.                                                                                     dans le contexte du
                                                                                                                                   projet. Ajouter une
                                                                                                                                   capture réelle et
                                                                                                                                   vérifier qu'aucun
                                                                                                                                   Ingress/NodePort
                                                                                                                                   n'expose directement
                                                                                                                                   l'API ou PostgreSQL.

  **E11 ---                   Un CronJob écrit un dump `kubectl get cronjob,jobs,pvc -n task-app`;                                 **\[À INSÉRER\]**
  Sauvegarde/restauration**   PostgreSQL sur un volume `kubectl logs job/<job-backup> -n task-app`; inspection du fichier SQL ;    Nom/taille du dump,
                              dédié ; la restauration  restauration puis vérification des données.                                 logs de succès et
                              est testée.                                                                                          preuve qu'une donnée
                                                                                                                                   supprimée est
                                                                                                                                   restaurée.

  **E12 --- RBAC et           Comptes dédiés sans      `kubectl get sa,role,rolebinding -n task-app`; tests `kubectl auth can-i`   **\[À INSÉRER\]**
  ServiceAccounts**           jeton monté pour les     indiqués ci-dessous.                                                        Lecture autorisée ;
                              workloads ; `dev-viewer`                                                                             suppression de Pods
                              a un accès limité.                                                                                   et lecture des
                                                                                                                                   Secrets refusées.

  **E13 --- Durcissement**    Pods non-root, pas       `kubectl get deploy,statefulset -n task-app -o yaml`;                       **\[À INSÉRER\]**
                              d'escalade de            `kubectl describe pod <pod> -n task-app`; `kubectl get events -n task-app`. Champs de sécurité et
                              privilèges, capabilities                                                                             justification de
                              supprimées ; exceptions                                                                              chaque exception
                              justifiées.                                                                                          réellement conservée.

  **E14 --- NetworkPolicies** Seuls les flux de la     `kubectl get networkpolicy -n task-app`;                                    **\[À INSÉRER\]**
                              matrice sont autorisés ; `kubectl describe networkpolicy -n task-app`; tests TCP depuis un Pod       API→DB réussi,
                              les tentatives           autorisé puis un Pod non autorisé.                                          frontend→DB bloqué,
                              interdites échouent.                                                                                 Pod non
                                                                                                                                   autorisé→API/DB
                                                                                                                                   bloqué et application
                                                                                                                                   toujours accessible.

  **E15 --- Dépôt et          Manifestes organisés,    `find k8s -maxdepth 2 -type f`; `git status --short`; capture de            **\[À INSÉRER\]**
  documentation**             README de déploiement,   l'arborescence et lecture du README.                                        Structure claire,
                              modèle de Secret,                                                                                    instructions
                              procédure de                                                                                         reproductibles, aucun
                              restauration.                                                                                        secret réel
                                                                                                                                   versionné.
  ------------------------------------------------------------------------------------------------------------------------------------------------------

## 2.1 Vérifications RBAC demandées

Exécuter les commandes suivantes en adaptant le namespace si nécessaire
:

``` bash
kubectl auth can-i list pods -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i get pods/log -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i list services -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i delete pods -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer

kubectl auth can-i get secrets -n task-app \
  --as=system:serviceaccount:task-app:dev-viewer
```

Résultats attendus, en l'absence d'autres permissions accordées par
ailleurs : `yes`, `yes`, `yes`, `no`, `no`. Si `kubectl auth can-i`
échoue à cause d'un refus d'impersonation, vérifier les droits de
l'utilisateur qui lance la commande avant de conclure que le Role est
incorrect.

## 2.2 Preuve de persistance --- déroulé recommandé

1.  Créer une tâche identifiable, par exemple `PERSISTENCE-TEST-01`.
2.  Vérifier qu'elle apparaît dans l'interface et dans PostgreSQL.
3.  Supprimer uniquement le Pod `db-0`, sans supprimer le PVC.
4.  Attendre la recréation et le retour à l'état Ready.
5.  Relire la tâche dans l'application ou directement dans la base.
6.  Capturer les étapes avant/après.

``` bash
kubectl get pod db-0 -n task-app
kubectl get pvc -n task-app
kubectl delete pod db-0 -n task-app
kubectl wait --for=condition=Ready pod/db-0 -n task-app --timeout=180s
kubectl get pod db-0 -n task-app
kubectl get pvc -n task-app
```

**Interprétation :** la suppression d'un Pod n'équivaut pas à la
suppression de son volume persistant. En revanche, la perte du nœud qui
héberge un volume `local-path` peut rendre les données indisponibles ;
une sauvegarde externe reste nécessaire.

------------------------------------------------------------------------

# 3. Matrice des flux réseau et tests de blocage

## 3.1 Matrice cible

  -----------------------------------------------------------------------------------
  Source              Destination    Protocole/port   Décision       Justification
  ------------------- -------------- ---------------- -------------- ----------------
  Navigateur          Traefik /      HTTP TCP/80 dans Autorisé       Entrée web de
  utilisateur         Ingress        le laboratoire                  l'application.

  Traefik dans        Pods frontend  TCP/8080         Autorisé       Traefik doit
  `kube-system`                                                      transmettre les
                                                                     requêtes au
                                                                     frontend.

  Pods frontend       API            TCP/3000         Autorisé       Les appels
  (`tier=frontend`)   (`tier=api`)                                   `/api/` sont
                      via `api-svc`                                  relayés à l'API.

  API (`tier=api`)    PostgreSQL     TCP/5432         Autorisé       L'API doit lire
                      (`tier=db`)                                    et modifier les
                      via `db`                                       tâches.

  Job de sauvegarde   PostgreSQL     TCP/5432         Autorisé       `pg_dump` doit
  (`tier=backup`)     (`tier=db`)                                    lire la base
                      via `db`                                       pour créer le
                                                                     dump.

  Frontend            PostgreSQL     TCP/5432         **Bloqué**     Le frontend ne
                                                                     doit pas accéder
                                                                     directement aux
                                                                     données.

  Pod de test non     PostgreSQL     TCP/5432         **Bloqué**     Empêcher un
  autorisé                                                           workload
                                                                     arbitraire
                                                                     d'accéder à la
                                                                     base.

  Pod non autorisé    API            TCP/3000         **Bloqué**     L'API ne doit
                                                                     accepter que les
                                                                     flux
                                                                     nécessaires.

  Tout autre flux     Tous ports     Tous             **Bloqué par   Principe du
  entrant vers les                                    défaut**       moindre
  Pods isolés                                                        privilège
                                                                     réseau.
  -----------------------------------------------------------------------------------

> Les règles doivent correspondre aux labels réellement présents sur les
> Pods. Vérifier les labels avec
> `kubectl get pods -n task-app --show-labels`. Une NetworkPolicy
> déclarée mais non appliquée par le plugin réseau ne constitue pas une
> protection effective.

## 3.2 Schéma Mermaid des flux autorisés et bloqués

``` mermaid
flowchart LR
    U["Navigateur"]
    TR["Traefik<br/>kube-system"]
    F["Frontend<br/>tier=frontend"]
    A["API<br/>tier=api"]
    DB[("PostgreSQL<br/>tier=db")]
    BK["CronJob backup<br/>tier=backup"]
    X["Pod de test<br/>sans label autorisé"]

    U -->|"HTTP/80"| TR
    TR -->|"TCP/8080 autorisé"| F
    F -->|"/api — TCP/3000 autorisé"| A
    A -->|"TCP/5432 autorisé"| DB
    BK -->|"TCP/5432 autorisé"| DB
    F -. "TCP/5432 BLOQUÉ" .-> DB
    X -. "TCP/5432 BLOQUÉ" .-> DB
    X -. "TCP/3000 BLOQUÉ" .-> A
```

## 3.3 Mise en place du principe « deny by default »

Commencer par une politique qui sélectionne tous les Pods du namespace
et n'autorise aucun trafic entrant :

``` yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: task-app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress: []
```

Ajouter ensuite des politiques ciblées pour les flux autorisés. Exemple
de principe pour la base :

``` yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-and-backup-to-db
  namespace: task-app
spec:
  podSelector:
    matchLabels:
      tier: db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: api
        - podSelector:
            matchLabels:
              tier: backup
      ports:
        - protocol: TCP
          port: 5432
```

Cette politique suppose que les Pods API et sauvegarde portent bien les
labels `tier: api` et `tier: backup`. La politique Traefik→frontend doit
aussi utiliser un `namespaceSelector` ciblant `kube-system` et, si
nécessaire, un `podSelector` correspondant aux Pods Traefik. Le label
standard de namespace peut être ciblé ainsi :

``` yaml
namespaceSelector:
  matchLabels:
    kubernetes.io/metadata.name: kube-system
```

Ne pas appliquer un manifeste d'exemple sans vérifier les labels, les
ports des Services et le contrôleur réseau installé.

## 3.4 Procédure de tests positifs et négatifs

### Test A --- API vers PostgreSQL : doit réussir

Depuis un Pod API, vérifier d'abord la résolution DNS, puis tester le
port 5432 avec un outil disponible dans l'image. Si l'image ne contient
pas de client réseau, utiliser un Pod de diagnostic temporaire portant
exactement les labels autorisés, ou une commande `pg_isready` depuis un
conteneur adapté.

**Preuve :** sortie de la commande de connexion réussie et capture du
Pod source avec ses labels.

### Test B --- frontend vers PostgreSQL : doit échouer

Lancer un test TCP depuis le frontend, si l'image contient un outil
adapté, ou depuis un Pod de test qui porte le label `tier: frontend`. La
connexion au port 5432 doit expirer ou être refusée selon le moteur
réseau.

**Preuve :** commande et sortie d'échec, plus
`kubectl get pod --show-labels`.

### Test C --- Pod non autorisé vers PostgreSQL : doit échouer

Créer un Pod de diagnostic sans label `tier: api` ni `tier: backup`,
puis tenter une connexion TCP à `db:5432`. Le test doit échouer.

**Preuve :** YAML ou commande de création du Pod, labels observés,
commande de test et sortie d'échec.

### Test D --- Pod non autorisé vers API : doit échouer

Tenter une connexion au Service `api-svc:3000` depuis un Pod qui n'est
pas sélectionné comme frontend. La connexion doit échouer si la
politique API autorise seulement le frontend.

### Test E --- application web : doit rester fonctionnelle

Ouvrir `http://app.k3s.local` ou exécuter :

``` bash
curl -i -H 'Host: app.k3s.local' http://192.168.122.180/
```

La page doit rester accessible et les opérations CRUD doivent
fonctionner. Une page HTML accessible ne prouve pas à elle seule que
tous les flux API/DB fonctionnent : effectuer une opération de création
ou de lecture dans l'interface.

## 3.5 Limite importante des NetworkPolicies

Une politique qui déclare uniquement `policyTypes: [Ingress]` filtre les
connexions **entrantes** vers les Pods sélectionnés. Elle ne restreint
pas automatiquement leurs connexions **sortantes**. Pour filtrer aussi
l'egress, ajouter des politiques dédiées et autoriser explicitement les
destinations requises, notamment DNS et les services applicatifs
nécessaires.

------------------------------------------------------------------------

# 4. Justification des exceptions de durcissement

Le durcissement réduit les privilèges d'un conteneur en cas de
compromission. Les exceptions doivent être limitées, documentées et
accompagnées de mesures compensatoires.

  ---------------------------------------------------------------------------------------------------------------
  Paramètre                               Frontend Nginx       API               PostgreSQL     Justification /
                                                               Node.js/Express                  preuve
  --------------------------------------- -------------------- ----------------- -------------- -----------------
  `runAsNonRoot: true`                    À activer si l'image À activer et      À activer si   Réduit l'impact
                                          et ses permissions   utiliser un UID   compatible     d'une
                                          le permettent.       non nul.          avec l'image   compromission.
                                                                                 officielle et  Vérifier l'UID
                                                                                 les            réel de l'image.
                                                                                 permissions du 
                                                                                 volume.        

  `allowPrivilegeEscalation: false`       À activer.           À activer.        À activer si   Empêche le
                                                                                 compatible.    processus de
                                                                                                gagner des
                                                                                                privilèges
                                                                                                supplémentaires
                                                                                                via certains
                                                                                                mécanismes Linux.

  `capabilities.drop: ["ALL"]`            À activer si aucune  À activer si      À activer      Retire les
                                          capability n'est     aucune capability après          capabilities
                                          requise.             n'est requise.    vérification   Linux inutiles ;
                                                                                 de l'image.    ajouter une
                                                                                                exception
                                                                                                seulement si une
                                                                                                fonction
                                                                                                identifiée
                                                                                                l'exige
                                                                                                réellement.

  `seccompProfile: RuntimeDefault`        Recommandé.          Recommandé.       Recommandé     Réduit les appels
                                                                                 après          système
                                                                                 validation.    accessibles au
                                                                                                processus.

  `readOnlyRootFilesystem: true`          À tester ; Nginx     À tester ; monter Peut être      L'option n'est
                                          peut avoir besoin    `emptyDir` pour   incompatible   conservée que si
                                          d'écrire             `/tmp` et tout    avec certains  les chemins
                                          PID/cache/fichiers   chemin d'écriture chemins de     nécessaires à
                                          temporaires.         requis.           l'image ; les  l'application
                                                                                 données        sont montés
                                                                                 doivent rester explicitement en
                                                                                 sur le volume  écriture.
                                                                                 monté.         

  `emptyDir` pour fichiers temporaires    Peut être nécessaire Peut être         Ne remplace    Fournit un espace
                                          pour cache et        nécessaire pour   pas le PVC de  inscriptible
                                          temporaires Nginx.   `/tmp`.           données.       temporaire sans
                                                                                                rendre toute la
                                                                                                racine
                                                                                                inscriptible.

  `automountServiceAccountToken: false`   À activer si le      À activer si      À activer si   Évite de monter
                                          frontend n'appelle   l'API ne          PostgreSQL     un jeton
                                          pas l'API            communique pas    n'en a pas     Kubernetes
                                          Kubernetes.          avec l'API        besoin.        inutile dans le
                                                               Kubernetes.                      conteneur.
  ---------------------------------------------------------------------------------------------------------------

## 4.1 Exception Nginx : fichier de configuration en lecture seule

Pendant le projet, le frontend a rencontré un problème de démarrage : le
script d'entrée de l'image tentait de générer ou de modifier
`/etc/nginx/conf.d/default.conf`, mais ce chemin était monté en lecture
seule. Le conteneur affichait une erreur d'écriture et ne démarrait pas
normalement.

Le contournement testé consiste à lancer directement Nginx, sans
exécuter le script d'entrée qui tente de modifier le fichier :

``` yaml
command: ["nginx"]
args: ["-g", "daemon off;"]
```

Cette exception est acceptable uniquement si la configuration Nginx est
déjà complète et montée au bon endroit. Elle doit être accompagnée d'un
contrôle des journaux et de l'état Ready. Si
`readOnlyRootFilesystem: true` est activé, vérifier également que les
chemins nécessaires au PID, au cache et aux fichiers temporaires sont
montés en écriture via `emptyDir`.

**Preuve à joindre :** capture des logs avant correction, extrait du
manifeste après correction, puis
`kubectl rollout status deployment/frontend -n task-app` et
`kubectl get pods -n task-app`.

## 4.2 Exception PostgreSQL : utilisateur et répertoire de données

L'image PostgreSQL utilise un utilisateur propre au conteneur et doit
pouvoir écrire dans le répertoire de données monté depuis le PVC. Il ne
faut pas forcer arbitrairement un UID incompatible ou rendre le volume
en lecture seule, car PostgreSQL ne pourrait pas initialiser ou modifier
sa base.

La justification consiste à conserver un utilisateur non privilégié
compatible avec l'image, à limiter les écritures au volume de données et
à appliquer les autres contrôles compatibles
(`allowPrivilegeEscalation: false`, suppression des capabilities
inutiles, profil seccomp). L'exception doit être vérifiée dans les
manifestes et les logs, pas simplement supposée.

## 4.3 Pod Security Standards : baseline puis restricted

Le niveau `baseline` est un premier contrôle de sécurité. Le niveau
`restricted` impose des contraintes supplémentaires, notamment sur
l'utilisateur, les capabilities, seccomp et les élévations de
privilèges. Il est possible qu'un Pod ou une image ne respecte pas
toutes ces contraintes dès la première tentative.

Démarche de compte rendu :

1.  Appliquer le label `pod-security.kubernetes.io/enforce=baseline` au
    namespace.
2.  Vérifier que les workloads peuvent être créés et restent
    opérationnels.
3.  Essayer `restricted` dans un environnement de test ou après
    sauvegarde des manifestes.
4.  Enregistrer les messages de refus, corriger les champs nécessaires,
    puis retester.
5.  Ne déclarer `restricted` validé que si les Pods concernés sont
    effectivement admis et opérationnels.

**Preuve à joindre :** commandes `kubectl label`, `kubectl get pods`,
`kubectl describe pod` et messages d'admission observés.

------------------------------------------------------------------------

# 5. Réponses aux questions des phases 0 à 10

## Phase 0 --- Développement et test local

**Question : pourquoi un secret ne doit-il jamais figurer dans le code
ni dans l'image ?**

Un secret inscrit dans le code peut être publié dans Git, inclus dans
l'historique des commits, copié dans les journaux ou récupéré par toute
personne ayant accès à l'image. Même après suppression du fichier dans
un commit ultérieur, la valeur peut rester dans l'historique. Il faut
injecter les identifiants à l'exécution via un Secret ou un gestionnaire
de secrets, limiter les droits d'accès et éviter de les afficher dans
les logs. Un Secret Kubernetes est encodé en Base64 par défaut ; ce
n'est pas un chiffrement suffisant à lui seul.

## Phase 1 --- Conteneuriser et publier les images

**Question : quelle différence entre `imagePullPolicy: Always` et
`IfNotPresent`, et quel est le risque de `latest` ?**

-   `Always` demande au runtime de vérifier l'image dans le registre à
    chaque démarrage du conteneur. Le contenu peut donc changer si un
    tag mutable est remplacé.
-   `IfNotPresent` utilise l'image déjà présente localement et ne la
    télécharge que si elle manque sur le nœud.
-   `latest` est un tag mutable et rend les déploiements moins
    reproductibles : deux nœuds peuvent finir par utiliser des contenus
    différents si le tag a été modifié et que les caches diffèrent.

Il est préférable de publier des tags explicites et immuables, par
exemple `1.2.0`, et de contrôler que les trois nœuds peuvent récupérer
la même image.

## Phase 2 --- Namespace, quotas et limites

**Question : que se passe-t-il quand un quota est dépassé au moment de
créer un Pod ?**

L'admission de la ressource peut être refusée si la création dépasserait
le ResourceQuota. `kubectl apply` ou le contrôleur concerné affiche
alors une erreur indiquant que la limite de quota est dépassée. Il faut
examiner `kubectl describe quota -n task-app`, vérifier les
consommations et ajuster les ressources ou le quota selon les consignes
du laboratoire. Il ne faut pas supprimer arbitrairement les limites de
ressources pour contourner le problème.

## Phase 3 --- ConfigMap et Secret

**Question : un Secret Kubernetes est-il chiffré ? Que faut-il pour que
son contenu reste confidentiel ?**

Par défaut, les valeurs de Secret sont encodées en Base64, ce qui n'est
pas du chiffrement. La confidentialité nécessite notamment des
permissions RBAC minimales, une protection du fichier kubeconfig et des
accès à l'API, l'absence de secrets réels dans Git, et idéalement le
chiffrement au repos du stockage de données Kubernetes via une
configuration appropriée. Il faut aussi restreindre qui peut lire les
Secrets et éviter de les afficher dans les commandes ou captures.

## Phase 4 --- Base de données en StatefulSet

**Question : pourquoi un StatefulSet plutôt qu'un Deployment pour une
base de données ?**

Un StatefulSet fournit des identités stables aux Pods, un ordre de
création/suppression prévisible et des volumes persistants associés à
chaque réplique via `volumeClaimTemplates`. Ces propriétés sont utiles
pour une base qui doit retrouver son identité et ses données après
recréation. Un Deployment convient généralement mieux aux applications
stateless dont les Pods sont interchangeables. Le StatefulSet ne
remplace cependant ni les sauvegardes ni la réplication de base de
données.

## Phase 5 --- API et frontend

**Question : que fait Kubernetes de l'API tant que la readiness probe
échoue ?**

Le conteneur peut continuer à fonctionner, mais le Pod n'est pas
considéré comme prêt à recevoir du trafic normal. Les endpoints des
Services ne doivent pas diriger le trafic applicatif vers ce Pod non
Ready. La readiness probe permet donc d'éviter d'envoyer des requêtes à
une API qui démarre ou ne peut pas joindre PostgreSQL. La liveness probe
`/health`, elle, sert à détecter un processus qui ne répond plus et peut
conduire au redémarrage du conteneur.

## Phase 6 --- Ingress

**Question : pourquoi ne pas exposer aussi l'API et la base par
l'Ingress ?**

Le navigateur n'a besoin d'accéder qu'au frontend. Le frontend relaie
les requêtes `/api/` vers le Service interne de l'API. Exposer
directement l'API élargirait la surface d'attaque et imposerait de
sécuriser davantage son accès externe. Exposer PostgreSQL serait encore
plus risqué, car la base n'a pas besoin d'être joignable depuis Internet
ou le poste utilisateur. L'API et la base doivent rester internes et
leurs communications être limitées par les Services et NetworkPolicies.

## Phase 7 --- Persistance et résilience

**Question : où se trouvent physiquement les données avec `local-path`,
et que se passe-t-il si le nœud qui les héberge tombe ?**

Avec `local-path`, le volume est généralement adossé au stockage local
d'un nœud. Si le Pod est supprimé et recréé alors que le PVC et le nœud
restent disponibles, Kubernetes peut rattacher le volume et les données
doivent persister. Si le nœud tombe ou si son disque est perdu, les
données peuvent devenir indisponibles, car `local-path` n'assure pas la
réplication entre nœuds. Il faut des sauvegardes copiées vers un
stockage indépendant et, pour une disponibilité supérieure, une solution
de stockage distribuée ou une architecture de base répliquée.

## Phase 8 --- Sauvegarde planifiée et restauration

**Question : une sauvegarde stockée sur le même nœud que la base
protège-t-elle d'une panne de ce nœud ? Que proposer ?**

Non. Si la base et le dump sont stockés sur le même nœud ou le même
stockage local, une panne de ce nœud peut rendre les deux copies
inutilisables. Il faut exporter les sauvegardes vers un stockage séparé
: serveur de sauvegarde, partage réseau, stockage objet compatible S3 ou
autre destination indépendante. Il faut aussi tester régulièrement la
restauration, contrôler que les fichiers sont non vides et conserver
plusieurs versions selon une politique de rétention.

## Phase 9 --- RBAC

**Question : pourquoi désactiver le montage automatique du jeton dans un
Pod qui n'en a pas besoin ?**

Le jeton permet au processus du Pod de s'authentifier auprès de l'API
Kubernetes. Si l'application n'utilise pas cette API, le jeton est
inutile et devient une cible possible en cas de compromission du
conteneur. `automountServiceAccountToken: false` réduit donc la quantité
d'identifiants disponibles dans le Pod. Si une application a réellement
besoin de l'API Kubernetes, il faut créer un ServiceAccount dédié et lui
attribuer uniquement les permissions nécessaires.

## Phase 10 --- Durcissement et NetworkPolicies

**Question : pourquoi poser d'abord un « deny all » avant d'ajouter les
autorisations ? Quelle est la limite d'une politique qui ne filtre que
le trafic entrant ?**

Le refus par défaut évite qu'un nouveau flux soit autorisé simplement
parce qu'aucune règle n'a été écrite pour le bloquer. On ajoute ensuite
les exceptions nécessaires, ce qui suit le principe du moindre
privilège. Cela rend la matrice de flux explicite et plus facile à
auditer. Une politique qui ne filtre que l'ingress contrôle les
connexions entrantes vers les Pods sélectionnés ; elle ne bloque pas
automatiquement les connexions sortantes. Pour limiter aussi l'egress,
il faut définir des règles de sortie et autoriser explicitement les
destinations requises, comme DNS, API et base de données.

------------------------------------------------------------------------

# 6. Difficultés rencontrées et enseignements

Pendant le déploiement, plusieurs difficultés ont mis en évidence la
différence entre une application qui fonctionne en local et une
application correctement exploitée sur Kubernetes. La configuration des
variables d'environnement et des Secrets exige de séparer les paramètres
non sensibles des identifiants et de vérifier que les noms de clés
correspondent exactement à ceux attendus par les conteneurs. Le
démarrage de PostgreSQL nécessite aussi un volume correctement monté, un
répertoire de données compatible avec l'image et des permissions
adaptées ; une erreur sur le Secret ou sur le répertoire de données peut
provoquer un `CrashLoopBackOff`. Côté frontend, le script d'entrée de
Nginx a tenté de modifier un fichier de configuration monté en lecture
seule : il a fallu analyser les logs et adapter le mode de démarrage,
tout en vérifiant les chemins d'écriture requis. Les tests d'accès par
Ingress ont montré l'importance du nom d'hôte et de l'en-tête `Host`, et
la gestion du stockage a rappelé qu'un PVC `local-path` protège contre
certaines suppressions de Pods mais ne remplace pas une sauvegarde hors
nœud. Enfin, les NetworkPolicies doivent être validées par des tests de
connexion réels : leur présence dans le cluster ne prouve pas que le CNI
les applique, et une politique trop restrictive peut bloquer
l'application si un flux nécessaire a été oublié. Les principaux
enseignements sont donc de diagnostiquer à partir des événements et des
logs, de tester chaque couche séparément, d'appliquer le moindre
privilège, de conserver des preuves reproductibles et de ne jamais
confondre configuration déclarée et sécurité effectivement vérifiée.

------------------------------------------------------------------------

# 7. Conclusion et checklist finale

Ce projet met en pratique le déploiement d'une application trois niveaux
sur K3s, la configuration externalisée, la persistance des données, la
sauvegarde planifiée, la gestion des identités et la segmentation
réseau. Il montre que la disponibilité et la sécurité doivent être
prouvées par des tests, et non déduites de la seule présence des
manifestes.

Avant de remettre le compte rendu, vérifier les points suivants :

-   [ ] Les images ont des tags versionnés et sont disponibles sur les
    nœuds.
-   [ ] Les Pods frontend, API et PostgreSQL sont Ready.
-   [ ] ResourceQuota et LimitRange sont présents.
-   [ ] ConfigMap et Secret sont séparés ; aucun secret réel n'est
    versionné.
-   [ ] La persistance est prouvée après suppression/recréation du Pod
    PostgreSQL.
-   [ ] Les probes `/health` et `/ready` sont présentes.
-   [ ] Le frontend est accessible par `app.k3s.local`; l'API et la base
    ne sont pas exposées directement.
-   [ ] Une sauvegarde non vide est créée et une restauration a été
    testée.
-   [ ] Les commandes `kubectl auth can-i` confirment les permissions
    attendues.
-   [ ] Les exceptions de durcissement sont justifiées avec leurs
    preuves.
-   [ ] Les tests NetworkPolicy montrent au moins un flux autorisé et
    les flux interdits bloqués.
-   [ ] Le README contient l'ordre de déploiement, les contrôles et la
    procédure de restauration.
-   [ ] Les captures sont réelles, lisibles et ne montrent aucun mot de
    passe.

## Sources du projet

-   Dépôt de l'application :
    https://github.com/Sen-Se1/k3s-Labs/tree/main/mini-project-2
-   Cahier des charges officiel du mini-projet :
    https://h-hafsi.github.io/Kubernetes-Training-Labs/partie-2-configuration-donnees-securite/mini-projet-2/
