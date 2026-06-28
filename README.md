# DAM Platform on AWS EKS

A full-stack Digital Asset Management platform deployed on Amazon EKS, provisioned with Terraform, containerised with Docker, deployed via Helm, and continuously delivered through GitHub Actions.

---

## Platform Overview

### Infrastructure
- **Amazon EKS 1.35** — managed Kubernetes control plane with `API_AND_CONFIG_MAP` authentication
- **Multi-AZ VPC** — 3 public + 3 private subnets across `us-east-1a/b/c`
- **Managed Node Group** — Amazon Linux 2023, auto-scaling 1–5 nodes per environment
- **AWS Load Balancer Controller** — Helm-deployed with IRSA, 2 replicas, provisions ALBs from Ingress resources
- **EKS Managed Add-ons** — CoreDNS, kube-proxy, VPC CNI, EBS CSI driver
- **IRSA (IAM Roles for Service Accounts)** — scoped roles for EBS CSI, LBC, DAM API, DAM workers, and CloudWatch agent
- **S3 State Backend** — native lock file (`use_lockfile = true`), no DynamoDB required
- **CloudWatch Log Groups** — all 5 control plane log types + Container Insights, per-environment retention

### DAM Application
- **PostgreSQL 15** on RDS — private, KMS-encrypted, Multi-AZ in prod, accessible only from EKS node security group
- **S3 Asset Bucket** — KMS-encrypted, versioned, TLS-enforced; layout: `originals/`, `thumbnails/`, `exports/`, `temp/`
- **4 ECR Repositories** — `dam/api`, `dam/web`, `dam/transform-worker`, `dam/export-worker`; KMS-encrypted, lifecycle-managed
- **Helm Chart** — single chart at `helm/dam/` with per-environment values overrides
- **GitHub Actions CI/CD** — builds and pushes images on every push to `main`, deploys to `dam-dev` namespace automatically
- **KMS Encryption** — single key shared by RDS, S3, and ECR with annual key rotation

---

## Web Application

The DAM frontend is a single-page application in `app/web/` built with:

| Component | Purpose |
|---|---|
| **React 18** | Component-based UI with hooks |
| **Vite** | Fast development server and production bundler |
| **Tailwind CSS** | Utility-first styling |
| **TanStack Query** | Server-state management — caching, background refetch, optimistic updates |
| **React Router 6** | Client-side routing |
| **Axios** (`src/api/client.ts`) | Typed API layer with automatic JWT refresh interceptor |

**Key pages:** Login, Register, Dashboard (asset grid), CollectionView, ShareView

**Key components:**
- `UploadZone` — drag-and-drop upload using S3 pre-signed URLs (files go directly from the browser to S3, bypassing the API)
- `AssetCard` — thumbnail preview with tag badges and action menu
- `TagFilter` — multi-select tag sidebar for filtering the asset grid
- `Navbar` — authenticated navigation with user context

The web app builds to a static bundle served by nginx (`app/web/nginx.conf`) inside the `dam/web` container.

---

## API (app/api)

Node.js + Express + TypeScript backend with:
- **Prisma ORM** — PostgreSQL schema management and type-safe queries
- **JWT auth** — 15-minute access tokens + 7-day HTTP-only refresh cookies
- **S3 pre-signed URLs** — issued per-request for uploads and downloads
- **Routes** — `/auth`, `/assets`, `/tags`, `/collections`, `/shares`, `/analytics`, `/jobs`

## Workers

| Worker | Image | Role |
|---|---|---|
| `transform-worker` | `dam/transform-worker` | Generates thumbnails using Sharp (requires `libvips`) |
| `export-worker` | `dam/export-worker` | Zips collections and uploads to S3 |

Both workers claim jobs with `SELECT FOR UPDATE SKIP LOCKED` so multiple replicas never process the same job.

---

## Project Structure

```
DevOps-Project2/
├── bootstrap/                      # Run once — creates S3 state bucket and IAM policy
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf                  # Prints next steps after apply
├── environments/                   # Per-environment overrides
│   ├── dev.backend.hcl / dev.tfvars
│   ├── stg.backend.hcl / stg.tfvars
│   └── prod.backend.hcl / prod.tfvars
├── modules/
│   ├── eks/                        # EKS cluster + managed node group
│   └── vpc/                        # Multi-AZ VPC
├── app/
│   ├── api/                        # Node.js API (Express + Prisma)
│   ├── web/                        # React 18 + Vite frontend
│   ├── transform-worker/           # Thumbnail generation (Sharp + libvips)
│   ├── export-worker/              # ZIP export worker
│   └── docker-compose.yml          # Local development stack
├── helm/dam/                       # Helm chart for all DAM services
│   ├── Chart.yaml
│   ├── values.yaml                 # Defaults
│   ├── values-dev.yaml
│   ├── values-stg.yaml
│   ├── values-prod.yaml
│   └── templates/                  # Deployments, Services, Ingress, ServiceAccounts, Secret
├── .github/workflows/
│   └── dam-deploy.yml              # Build + push + deploy pipeline
├── versions.tf                     # Terraform providers + S3 backend block
├── variables.tf                    # All input variables + locals
├── main.tf                         # module.vpc + module.eks + provider config
├── iam.tf                          # All IRSA roles (EBS CSI, LBC, DAM API, workers, CloudWatch)
├── dam.tf                          # KMS key, ECR repos, S3 asset bucket, RDS instance
├── eks-config.tf                   # EKS managed add-ons, CloudWatch log groups, LBC Helm release
└── outputs.tf                      # Cluster endpoint, ECR URLs, RDS endpoint, IRSA role ARNs
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Terraform | >= 1.10.0 | Required for S3 native state locking |
| AWS CLI | >= 2.0 | Configured for the target account |
| kubectl | any recent | |
| Helm | >= 3.0 | |
| Docker | >= 24 | For local development and image builds |
| Git | any | |

AWS IAM permissions required: EKS, VPC, IAM, S3, RDS, ECR, KMS, CloudWatch, Secrets Manager.

---

## Setup & Deployment

### Step 1 — Clone the repository

```bash
git clone https://github.com/PetersonOlay/DevOps-Project2.git
cd DevOps-Project2
```

### Step 2 — Bootstrap (first-time only)

Creates the S3 state bucket and least-privilege IAM backend policy. Uses a local backend — run this once and never destroy it.

```bash
cd bootstrap
terraform init
terraform apply -var state_bucket_name=previse-eks-tfstate-395675597879-dam
```

After apply, attach the output policy to your IAM user:

```bash
aws iam attach-user-policy \
  --user-name previsetech \
  --policy-arn $(terraform output -raw terraform_s3_backend_policy_arn)
```

### Step 3 — Set the RDS password

Never store this in a `.tfvars` file. Use single quotes to avoid bash history-expansion issues with special characters:

```bash
export TF_VAR_db_password='<your-secure-password>'
```

### Step 4 — Initialise and deploy

```bash
cd ..
ENV=dev   # dev | stg | prod
terraform init -backend-config=environments/${ENV}.backend.hcl
```

On first apply, use targeting to control provider authentication order:

```bash
terraform apply -var-file=environments/${ENV}.tfvars -target=module.vpc
terraform apply -var-file=environments/${ENV}.tfvars -target=module.eks
terraform apply -var-file=environments/${ENV}.tfvars
```

> For all subsequent applies only the third command is needed.

### Step 5 — Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name eks-${ENV}-cluster
# or:
$(terraform output -raw configure_kubectl)
```

### Step 6 — Verify the cluster

```bash
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get deploy -n kube-system aws-load-balancer-controller
```

### Step 7 — Set up GitHub Actions

Add these in **GitHub → Settings → Secrets and variables → Actions**:

| Type | Name | Value |
|---|---|---|
| Secret | `AWS_ACCESS_KEY_ID` | Your IAM access key |
| Secret | `AWS_SECRET_ACCESS_KEY` | Your IAM secret key |
| Variable | `ECR_PREFIX` | `395675597879.dkr.ecr.us-east-1.amazonaws.com` |

### Step 8 — Deploy the DAM application

**Via CI/CD (automatic):** Push to `main` — the workflow builds all 4 images, pushes to ECR, and rolls out to `dam-dev`.

**Via Helm (manual / first-time):**

```bash
helm upgrade --install dam ./helm/dam \
  -f helm/dam/values-dev.yaml \
  --namespace dam-dev --create-namespace
```

**Promote to staging or production** using `workflow_dispatch` in the GitHub Actions UI, selecting the target environment.

### Step 9 — Verify DAM pods

```bash
kubectl get pods -n dam-dev
kubectl get ingress -n dam-dev
```

### Step 10 — Tear down

```bash
terraform destroy -var-file=environments/${ENV}.tfvars
```

> The bootstrap S3 bucket has `prevent_destroy = true`. Delete it manually via the AWS Console only when you no longer need the stored state.

---

## CI/CD Pipeline

The workflow at `.github/workflows/dam-deploy.yml` runs in two jobs:

**build-and-push** (matrix across all 4 services):
1. Authenticates to AWS using `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
2. Logs in to ECR
3. Builds each Docker image with `--cache-from` for layer reuse
4. Pushes `sha-<git-sha>` and `latest` tags

**deploy** (after all builds pass):
1. Authenticates to AWS
2. Updates kubeconfig for `eks-<env>-cluster`
3. Runs `kubectl set image` for all 4 deployments in `dam-<env>` namespace
4. Waits for rollouts to complete (300s timeout per deployment)
5. Prints pod and ingress status

**Triggers:**
- `push` to `main` with changes in `app/**` or `helm/**` → always targets `dev`
- `workflow_dispatch` → choose `dev`, `stg`, or `prod` manually

---

## Environments

| | dev | stg | prod |
|---|---|---|---|
| EKS nodes | t3.medium × 1–3 | m5.large × 2–4 | m5.large × 2–5 |
| NAT Gateways | 1 shared | 1 shared | 3 (one per AZ) |
| RDS instance | db.t3.micro | db.t3.medium | db.t3.medium |
| RDS Multi-AZ | No | No | Yes |
| RDS backup retention | 1 day | 1 day | 7 days |
| Log retention | 7 days | 30 days | 90 days |
| K8s namespace | `dam-dev` | `dam-stg` | `dam-prod` |

---

## Troubleshooting

### Kubernetes/Helm provider fails on first apply

```
Error: Get "https://<endpoint>/api": context deadline exceeded
```

**Fix:** Use the three-pass apply from Step 4 — target `module.vpc` first, then `module.eks`, then run the full apply.

---

### Backend bucket does not exist on terraform init

```
Error: Failed to get existing workspaces: S3 bucket does not exist.
```

**Fix:** Complete the bootstrap step first, then re-run `terraform init`.

---

### Pods stuck in ImagePullBackOff

```
Failed to pull image "...dkr.ecr...": no basic auth credentials
```

**Fix:** The node IAM role requires `AmazonEC2ContainerRegistryReadOnly`. This is already added in `modules/eks/main.tf` under `iam_role_additional_policies`. If you see this on an existing cluster, you may need to re-apply after adding the policy.

---

### API pods cannot connect to RDS

```
Error: connect ECONNREFUSED <rds-endpoint>:5432
```

**Fix:** The RDS security group only allows port 5432 from the EKS node security group. Verify `aws_security_group.rds` in `dam.tf` references `module.eks.node_security_group_id`. Also confirm `DATABASE_URL` in the `dam-secrets` Kubernetes secret is set correctly.

---

### Nodes show NotReady after apply

**Fix:** Node bootstrap takes 3–5 minutes after the node group is created. Wait and recheck. If still NotReady after 10 minutes, check node group events in the EKS console.

---

## Project Highlights

- **No DynamoDB** — S3 native state locking (`use_lockfile = true`) requires only Terraform >= 1.10 and bucket versioning
- **IRSA everywhere** — no static IAM credentials in pods; each workload gets scoped temporary credentials via OIDC federation
- **Direct browser uploads** — S3 pre-signed URLs bypass the API for large files, reducing API load and cost
- **No double-processing** — workers claim jobs with `SELECT FOR UPDATE SKIP LOCKED`; multiple replicas are safe
- **KMS encryption end-to-end** — single key covers RDS storage, S3 objects, and ECR image layers, with annual rotation
- **Environment isolation** — dev, stg, and prod use separate state files, namespaces, and RDS instances from one codebase
- **SSM Session Manager** — shell access to nodes without SSH keys or a bastion host
- **AL2023 nodes** — recommended AMI for EKS 1.35+

---

## Resources

- [Terraform AWS EKS Module](https://registry.terraform.io/modules/terraform-aws-modules/eks/aws/latest)
- [Terraform AWS VPC Module](https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [Terraform S3 Backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [IAM Roles for Service Accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- [Sharp image processing](https://sharp.pixelplumbing.com/)

---

## Contributing

Open a pull request at [github.com/PetersonOlay/DevOps-Project2](https://github.com/PetersonOlay/DevOps-Project2) with a clear description of what changed and why.

---

## Author

Built by **[Peterson Olay](https://github.com/PetersonOlay)**

- GitHub: [github.com/PetersonOlay](https://github.com/PetersonOlay)
- LinkedIn: [linkedin.com/in/peter-olay-745b05292](https://www.linkedin.com/in/peter-olay-745b05292/)
- Website: [peterolay.previselab.com](https://peterolay.previselab.com)
