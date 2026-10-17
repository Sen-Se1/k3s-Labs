# Mini-projet 1 : Déployer une application web à deux niveaux

Ce dépôt contient les manifestes Kubernetes pour déployer une application composée d'un frontend et d'une API sur un cluster k3s.

## Structure

- `namespace.yaml` : Namespace dédié `task-app`
- `api-deployment.yaml` : Deployment de l'API (3 réplicas, image `ghcr.io/stefanprodan/podinfo:6.5.4`)
- `frontend-deployment.yaml` : Deployment du frontend (2 réplicas, image `nginx:1.25-alpine`)
- `api-service.yaml` : Service ClusterIP pour l'API (port 9898)
- `frontend-service.yaml` : Service ClusterIP pour le frontend (port 80)
- `ingress.yaml` : Ingress pour exposer le frontend sur `web.k3s.local` et l'API sur `api.k3s.local`

## Déploiement

1. Appliquer tous les manifestes :
   ```bash
   kubectl apply -f .
   ```

2. Vérifier le namespace :
   ```bash
   kubectl get namespace task-app
   ```

3. Vérifier les déploiements :
   ```bash
   kubectl get deployments -n task-app
   ```

4. Vérifier les pods :
   ```bash
   kubectl get pods -n task-app -o wide
   ```

5. Vérifier les services :
   ```bash
   kubectl get services -n task-app
   ```

6. Vérifier l'ingress :
   ```bash
   kubectl get ingress -n task-app
   ```

## Vérification de la communication interne

Depuis un pod du frontend, tester l'accès à l'API par son nom DNS :
```bash
kubectl exec -n task-app -c frontend deployment/frontend -- nslookup api-svc
kubectl exec -n task-app -c frontend deployment/frontend -- curl -s http://api-svc:9898/healthz
```

## Accès externe

Ajouter les entrées suivantes dans le fichier `hosts` de votre poste Windows (ou utiliser l'en-tête Host avec curl) :
```
<IP_NŒUD_K3S>  web.k3s.local  api.k3s.local
```

Puis tester :
```bash
curl http://web.k3s.local
curl http://api.k3s.local/healthz
```

## Mise à jour sans coupure (Étape 5)

1. Lancer une boucle de requêtes vers l'API :
   ```bash
    while true; do
        curl -s http://api.k3s.local/healthz
        sleep 0.5
    done
   ```

2. Mettre à jour l'image de l'API dans `api-deployment.yaml` (par exemple, passer de `6.5.4` à `6.6.0`).

3. Appliquer la modification :
   ```bash
   kubectl apply -f api-deployment.yaml
   ```

4. Surveiller le déploiement :
   ```bash
   kubectl rollout status deployment/api -n task-app
   ```

5. Vérifier les ReplicaSets :
   ```bash
   kubectl get rs -n task-app
   ```

## Rollback

Pour revenir à la version précédente :
```bash
kubectl rollout undo deployment/api -n task-app
```

## Diagnostic de panne (Étape 6)

En cas de panne, suivre cette démarche :
1. Vérifier l'état des pods : `kubectl get pods -n task-app`
2. Décrire le pod problématique : `kubectl describe pod <nom_pod> -n task-app`
3. Vériner les logs : `kubectl logs <nom_pod> -n task-app`
4. Vérifier les événements : `kubectl get events -n task-app`
5. Vérifier les endpoints du service : `kubectl get endpoints -n task-app`
6. Corriger la cause (ex: tag d'image erroné, sélecteur de service incorrect) et réappliquer le manifeste.

## Notes

- Toutes les ressources sont déclaratives et versionnées dans ce dépôt.
- Le namespace `task-app` isole les ressources de ce projet.
- L'API est accessible en interne par le nom DNS `api-svc.task-app.svc.cluster.local` (ou simplement `api-svc` depuis le même namespace).
- L'Ingress utilise Traefik (contrôleur par défaut de k3s).