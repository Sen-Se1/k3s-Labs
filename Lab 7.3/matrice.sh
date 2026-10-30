#!/bin/bash
t() {
  printf '%-32s' "$1"
  if eval "$2" >/dev/null 2>&1; then echo "OK"; else echo "BLOQUE"; fi
}
t "frontend -> api"            "kubectl exec deploy/frontend -- wget -T 3 -qO- http://api"
t "frontend -> db"             "kubectl exec deploy/frontend -- wget -T 3 -qO- http://db"
t "api -> db"                  "kubectl exec deploy/api -- wget -T 3 -qO- http://db"
t "autre Pod -> api"           "kubectl run autre --rm -i --image=busybox:1.36 --restart=Never -- wget -T 3 -qO- http://api"
t "autre Pod -> db"            "kubectl run autre --rm -i --image=busybox:1.36 --restart=Never -- wget -T 3 -qO- http://db"
t "Pod kube-system -> frontend" "kubectl run intrus -n kube-system --rm -i --image=busybox:1.36 --restart=Never -- wget -T 3 -qO- http://frontend.tp-k8s"
