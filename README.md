# 🚀 Production EKS Cluster on AWS using Terraform

A fully-automated, multi-environment Kubernetes platform on AWS EKS, provisioned with Terraform modules, IRSA-scoped IAM, and an S3 state backend with native locking.

---

## Project Overview

The deployment includes:

- **Amazon EKS 1.35** — managed Kubernetes control plane with `API_AND_CONFIG_MAP` dual authentication
- **Multi-AZ VPC** — 3 public and 3 private subnets across `us-east-1a`, `us-east-1b`, `us-east-1c`
- **Managed Node Group** — Amazon Linux 2023, auto-scaling from 1 to 5 nodes depending on environment
- **AWS Load Balancer Controller** — Helm-deployed with IRSA, 2 replicas for high availability
- **EKS Managed Add-ons** — CoreDNS, kube-proxy, VPC CNI, and EBS CSI driver
- **IRSA (IAM Roles for Service Accounts)** — scoped roles for EBS CSI, LBC, app S3 access, and CloudWatch agent
- **S3 State Backend** — native lock file (`use_lockfile = true`), no DynamoDB required, per-environment isolation
- **Application S3 Bucket** — KMS-encrypted, versioned, TLS-enforced, with 90-day lifecycle on old versions
- **CloudWatch Log Groups** — control plane logs (all 5 types) and Container Insights, with per-environment retention
- **Multi-environment** — dev, stg, and prod deployed from a single codebase using `.tfvars` and `.backend.hcl` files

---

## Project Structure

```bash
DevOps-Project2/
├── bootstrap/                  # Run once to create the S3 state bucket and IAM policy
│   ├── main.tf                 # S3 bucket, encryption, versioning, IAM policy
│   ├── variables.tf            # region, state_bucket_name
│   └── outputs.tf              # state_bucket_name, terraform_s3_backend_policy_arn
├── environments/               # Per-environment variable overrides
│   ├── dev.backend.hcl         # Dev backend: eks/dev/terraform.tfstate
│   ├── dev.tfvars              # Dev: t3.medium x1, single NAT GW, 7-day logs
│   ├── stg.backend.hcl         # Stg backend: eks/stg/terraform.tfstate
│   ├── stg.tfvars              # Stg: m5.large x2, single NAT GW, 30-day logs
│   ├── prod.backend.hcl        # Prod backend: eks/prod/terraform.tfstate
│   └── prod.tfvars             # Prod: m5.large x3, 3 NAT GWs, 90-day logs
├── modules/
│   ├── eks/                    # EKS cluster and managed node group module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── vpc/                    # Multi-AZ VPC with public and private subnets
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── addons.tf                   # CoreDNS, kube-proxy, VPC CNI, EBS CSI managed add-ons
├── backend.tf                  # Empty S3 backend block — values injected at init time
├── cloudwatch.tf               # Control plane and Container Insights log groups
├── helm.tf                     # AWS Load Balancer Controller Helm release
├── iam.tf                      # IRSA roles for LBC, EBS CSI, app S3, CloudWatch agent
├── locals.tf                   # Common tags and name_prefix
├── main.tf                     # AWS, Kubernetes, Helm providers + module.vpc + module.eks
├── outputs.tf                  # Cluster endpoint, OIDC ARN, S3 bucket, kubectl command
├── s3.tf                       # Application S3 bucket with encryption and lifecycle rules
├── variables.tf                # All input variables with defaults and validation
└── versions.tf                 # Provider version constraints (Terraform >= 1.10)
```

---

## Prerequisites

- **Terraform** >= 1.10.0 — required for the S3 native lock file backend
- **AWS CLI** >= 2.0 — configured with credentials for the target AWS account
- **kubectl** — any recent stable version
- **Helm** >= 3.0
- **Git**
- AWS IAM permissions to create EKS clusters, VPCs, IAM roles, S3 buckets, and CloudWatch log groups

---

## Setup & Deployment

### Step 1 — Clone the repository

```bash
git clone https://github.com/PetersonOlay/DevOps-Project2.git
cd DevOps-Project2
```

### Step 2 — Bootstrap (first-time only)

Run this once to create the S3 state bucket and least-privilege IAM policy. This step uses a local backend and never needs to be repeated.

```bash
cd bootstrap
terraform init
terraform apply -var state_bucket_name=eks-tfstate-395675597879
```

After apply, note the `terraform_s3_backend_policy_arn` output and attach it to the IAM user or role running Terraform:

```bash
aws iam attach-user-policy \
  --user-name <YOUR_IAM_USER> \
  --policy-arn <terraform_s3_backend_policy_arn output>

# Or for a role:
# aws iam attach-role-policy --role-name <YOUR_ROLE> --policy-arn <ARN>
```

### Step 3 — Choose an environment

| Environment | Cluster | Instance | Nodes | NAT Gateways | Log Retention |
|---|---|---|---|---|---|
| dev | eks-dev-cluster | t3.medium | 1–3 | 1 shared | 7 days |
| stg | eks-stg-cluster | m5.large | 2–4 | 1 shared | 30 days |
| prod | eks-prod-cluster | m5.large | 2–5 | 3 (one per AZ) | 90 days |

### Step 4 — Initialize the root module

```bash
cd ..
ENV=prod   # set to dev, stg, or prod
terraform init -backend-config=environments/${ENV}.backend.hcl
```

### Step 5 — Apply (first-time three-pass)

The Kubernetes and Helm providers need the cluster to exist before they can authenticate. On the first apply, use targeting to control the order:

```bash
terraform apply -var-file=environments/${ENV}.tfvars -target=module.vpc
terraform apply -var-file=environments/${ENV}.tfvars -target=module.eks
terraform apply -var-file=environments/${ENV}.tfvars
```

> **Note:** For all subsequent applies (after the cluster already exists), only the third command is needed.

### Step 6 — Configure kubectl

```bash
aws eks update-kubeconfig --region us-east-1 --name eks-${ENV}-cluster
```

Or use the Terraform output directly:

```bash
$(terraform output -raw configure_kubectl)
```

### Step 7 — Verify the cluster

```bash
kubectl get nodes -o wide
# Expected: nodes in Running state, one per AZ

kubectl get pods -n kube-system
# Expected: coredns, kube-proxy, aws-node, ebs-csi-* all Running

kubectl get deploy -n kube-system aws-load-balancer-controller
# Expected: 2/2 ready
```

### Step 8 — Tear down

```bash
terraform destroy -var-file=environments/${ENV}.tfvars
```

> **Important:** The bootstrap S3 bucket is intentionally excluded from destroy. Delete it manually via the AWS Console or CLI only if you no longer need the stored state.

---

## Troubleshooting

### Kubernetes or Helm provider cannot connect during first apply

```
Error: Get "https://<endpoint>/api": context deadline exceeded
```

**Cause:** The Kubernetes and Helm providers attempt to authenticate against the EKS API server before the cluster has been created.

**Fix:** Use the three-pass apply sequence from Step 5 — target `module.vpc` first, then `module.eks`, then run the full apply.

---

### Backend bucket does not exist on terraform init

```
Error: Failed to get existing workspaces: S3 bucket does not exist.
```

**Cause:** The S3 state bucket was not created before running `terraform init` in the root module.

**Fix:** Complete the bootstrap step first, then re-run `terraform init`.

---

### Nodes show NotReady after apply completes

```
kubectl get nodes
NAME       STATUS     ROLES    AGE   VERSION
node-...   NotReady   <none>   2m    v1.35.x
```

**Cause:** The node group bootstrap process (pulling the AMI, running cloud-init, joining the cluster) takes 3–5 minutes after the node group resource is created.

**Fix:** Wait a few minutes and recheck. If nodes remain NotReady after 10 minutes, check the node group events in the EKS console.

---

### AWS Load Balancer Controller pods stuck in Pending

```
kubectl describe pod -n kube-system <lbc-pod-name>
Events: FailedScheduling: 0/1 nodes available
```

**Cause:** Nodes may not be ready yet, or the IRSA annotation is missing from the service account.

**Fix:** Confirm nodes are Running, then verify the IRSA annotation:

```bash
kubectl describe sa aws-load-balancer-controller -n kube-system | grep role-arn
```

The output should show `eks.amazonaws.com/role-arn: arn:aws:iam::...`.

---

## Project Highlights

- **Multi-AZ high availability** — nodes and NAT gateways spread across three Availability Zones
- **IRSA everywhere** — no instance-level IAM permissions; each workload receives its own scoped credentials
- **S3 native state locking** — no DynamoDB table needed; Terraform >= 1.10 writes a `.tflock` object
- **Full environment isolation** — dev, stg, and prod use separate state files under separate S3 keys
- **AL2023 nodes** — Amazon Linux 2023 is the recommended and supported AMI for EKS 1.35+
- **SSM Session Manager** — shell access to nodes without SSH keys or a bastion host
- **Cluster Autoscaler ready** — node group tagged with the labels required for autoscaler discovery

---

## Configuration Details

### VPC

- **CIDR**: `10.0.0.0/16`
- **Availability Zones**: `us-east-1a`, `us-east-1b`, `us-east-1c`
- **Private subnets**: `10.0.0.0/19`, `10.0.32.0/19`, `10.0.64.0/19` — `/19` provides 8190 IPs per subnet for dense pod scheduling
- **Public subnets**: `10.0.96.0/24`, `10.0.97.0/24`, `10.0.98.0/24` — `/24` is sufficient for NAT GW ENIs and load balancers
- **NAT Gateways**: 1 shared (dev/stg) or 3 per-AZ (prod)

### EKS Cluster

- **Kubernetes version**: `1.35`
- **Authentication mode**: `API_AND_CONFIG_MAP` — backward-compatible with existing aws-auth ConfigMap entries
- **Control plane logs**: `api`, `audit`, `authenticator`, `controllerManager`, `scheduler`
- **Endpoint access**: public and private

### Node Group

- **AMI type**: `AL2023_x86_64_STANDARD`
- **Root disk**: `50 GiB`
- **Update strategy**: max `33%` unavailable during rolling replacement
- **Additional policy**: `AmazonSSMManagedInstanceCore` for SSM access

---

## Resources

- [Terraform AWS EKS Module](https://registry.terraform.io/modules/terraform-aws-modules/eks/aws/latest)
- [Terraform AWS VPC Module](https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [Terraform S3 Backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [IAM Roles for Service Accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

---

## Contributing

Contributions are welcome. Open a pull request at [github.com/PetersonOlay/DevOps-Project2](https://github.com/PetersonOlay/DevOps-Project2) with a clear description of what you changed and why.

---

## Hit the Star

If this project saved you time, give it a [star](https://github.com/PetersonOlay/DevOps-Project2) — it helps others find it.

---

## Author

Built by **[Peterson Olay](https://github.com/PetersonOlay)**.

- GitHub: [github.com/PetersonOlay](https://github.com/PetersonOlay)
- LinkedIn: [linkedin.com/in/peter-olay-745b05292](https://www.linkedin.com/in/peter-olay-745b05292/)
- Website: [peterolay.previselab.com](https://peterolay.previselab.com)
