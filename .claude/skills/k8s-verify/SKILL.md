---
name: k8s-verify
description: "Post-deploy verification for Kubernetes: checks pod health, service endpoints, recent events, log errors, and rollout status. Use after any K8s deployment to verify it succeeded."
---

# /k8s-verify — Kubernetes Post-Deploy Verification

**Purpose:** Systematic post-deploy health check for Kubernetes deployments. Verifies pods are running, services have endpoints, no error events, and applications are responding. Project-agnostic — adapts to any namespace.

## When to Use

- After deploying to Kubernetes (kubectl apply, helm install, kustomize, etc.)
- After a rollout restart
- When something feels wrong but you're not sure what
- As a smoke test before handing off to users

## Usage

```
/k8s-verify                          # Auto-detect namespace from context
/k8s-verify --namespace myapp        # Specific namespace
/k8s-verify --namespace myapp --full # Include log analysis
```

## Arguments

- `--namespace <ns>` — Kubernetes namespace to check (auto-detected from kube context or CLAUDE.md if omitted)
- `--full` — include pod log analysis (slower, more thorough)
- `--json` — output results as JSON for scripting

## Step 1: Namespace Discovery

If `--namespace` was not provided:
1. Check `CLAUDE.md` for a namespace reference
2. Check for a `kustomization.yaml` with namespace
3. Fall back to `kubectl config view --minify -o jsonpath='{..namespace}'`
4. If still empty, ask the user

## Step 2: Pod Health

```bash
kubectl get pods -n <namespace> -o wide --no-headers
```

For each pod, check:

| Status | Verdict | Action |
|--------|---------|--------|
| Running, all containers ready | PASS | None |
| Running, not all ready | WARN | Check readiness probes |
| CrashLoopBackOff | FAIL | Check logs |
| ImagePullBackOff | FAIL | Image not found or auth issue |
| Pending | WARN | Check events for scheduling issues |
| Error | FAIL | Check logs |
| Terminating | INFO | Cleanup in progress |
| Completed | INFO | Job/init container finished |

Count: total pods, healthy, warning, failed.

## Step 3: Rollout Status

For each deployment and statefulset:

```bash
kubectl rollout status deploy/<name> -n <namespace> --timeout=10s 2>&1
```

Report whether each rollout is complete or still progressing.

## Step 4: Service Endpoints

```bash
kubectl get svc -n <namespace> -o wide --no-headers
kubectl get endpoints -n <namespace> --no-headers
```

For each service:
- Check that it has at least one endpoint
- If a service has no endpoints: **FAIL** — pods may not be matching the selector

## Step 5: Recent Events

```bash
kubectl get events -n <namespace> --sort-by=.lastTimestamp --field-selector type!=Normal 2>/dev/null | tail -20
```

Flag any Warning or Error events from the last 10 minutes. Common patterns:
- `FailedScheduling` — resource pressure
- `Unhealthy` — probe failures
- `BackOff` — container crash loop
- `FailedMount` — volume issues
- `FailedCreate` — controller issues

## Step 6: HTTP Health Checks (if applicable)

If `CLAUDE.md` or the deployment specs define health endpoints (common paths: `/health`, `/healthz`, `/ping`, `/ready`):

```bash
# Port-forward and check (timeout 5s)
kubectl port-forward -n <namespace> svc/<name> <local>:<remote> &
PF_PID=$!
sleep 2
curl -sf http://localhost:<local>/health
kill $PF_PID 2>/dev/null
```

Only attempt this for services that appear to be HTTP servers (ports 80, 443, 3000, 8080, 8443, etc.).

## Step 7: Log Analysis (with `--full`)

For each failed or warning pod:

```bash
kubectl logs -n <namespace> <pod> --tail=50 --timestamps
```

Scan for:
- `error`, `fatal`, `panic`, `exception` (case-insensitive)
- Stack traces
- Connection refused / timeout patterns
- Auth failures

For CrashLoopBackOff pods, also check previous container:
```bash
kubectl logs -n <namespace> <pod> --previous --tail=30
```

## Step 8: Report

```
## Deploy Verification: <namespace>

| Check | Result | Details |
|-------|--------|---------|
| Pods | PASS/WARN/FAIL | N/N healthy |
| Rollouts | PASS/FAIL | N/N complete |
| Endpoints | PASS/FAIL | N/N services have endpoints |
| Events | PASS/WARN | N warnings in last 10m |
| Health HTTP | PASS/FAIL/SKIP | N/N endpoints responding |
| Logs | PASS/WARN/SKIP | N error patterns found |

**Verdict: HEALTHY / DEGRADED / UNHEALTHY**

[If DEGRADED or UNHEALTHY: list specific issues with remediation steps]
```

### Verdict Logic

- **HEALTHY**: All checks PASS or INFO
- **DEGRADED**: Any WARN, no FAIL
- **UNHEALTHY**: Any FAIL

## Key Rules

1. **Non-destructive.** This skill only reads. It never modifies, restarts, or deletes anything.
2. **Timeout everything.** Kubectl commands can hang. Always use `--timeout` or wrap with a timeout.
3. **Adapt to the cluster.** Not all clusters have metrics-server or ingress. Skip checks gracefully when resources aren't available.
4. **Port-forward cleanup.** Always kill port-forward background processes, even on error.
5. **Sensitive data.** Never print secret values. Only show secret names and whether they exist.
