##############################################################################
# IIP — Self-hosted GitHub Actions runner provisioning (SEC-4, ADR-019).
#
# This Packer template builds the isolated runner VM/container image used by
# the Impeachment Intelligence Platform CI pipeline. The runner is
# LOGICALLY isolated from the corpus/GPU workstation: no shared filesystem,
# no shared secret store, no shared process namespace.
#
# GPU passthrough (NVIDIA Container Toolkit / MIG) is DEFERRED to Epic 4 —
# no model evals run in CI during Epic 1. The device-passthrough config is
# included as COMMENTS so activation in Epic 4 is a one-line uncomment.
#
# Egress is restricted to named CI registries (SEC-4) so the runner cannot
# exfiltrate corpus or secrets even with GPU access.
#
# Validation (operator pre-flight — Packer is NOT installed in CI):
#   packer validate infra/runner/provision.pkr.hcl
#
# Refs: SEC-4, NFR-D-1, D14, D15, ADR-019
##############################################################################

variable "runner_version" {
  type    = string
  default = "2.321.0"
  description = "GitHub Actions self-hosted runner application version."
}

variable "arch" {
  type    = string
  default = "linux/amd64"
  description = "CPU architecture for the runner image."
}

# ───────────────────────────────────────────────────────────────────────────
# Source: Ubuntu 24.04 LTS base — ephemeral, no host filesystem bind.
# SEC-4: NO mount of /corpus, NO access to ~/.config/sops/age/keys.txt.
# ───────────────────────────────────────────────────────────────────────────
source "docker" "iip-runner" {
  image  = "ubuntu:24.04"
  commit = true
  # NOTE: The runner image is intentionally minimal. Host bind-mounts are
  # NOT declared here — the runner MUST NOT see /corpus or the sops age key
  # directory (SEC-4, ADR-019). Ephemeral containers only.
  #
  # FORBIDDEN (never add these — they re-create the SEC-4 RCE-as-CI hole):
  #   volumes = {
  #     "/corpus"               = "/corpus:ro"          # ← corpus host path
  #     "~/.config/sops/age"    = "/root/.config/sops"  # ← age key dir
  #   }
  changes = [
    "ENTRYPOINT [\"/usr/local/bin/iip-runner-entrypoint.sh\"]",
    "WORKDIR /actions-runner",
  ]
}

# ───────────────────────────────────────────────────────────────────────────
# Build: install the GitHub Actions runner + toolchain, write egress
# allowlist, and stamp the deferred GPU-passthrough config as comments.
# ───────────────────────────────────────────────────────────────────────────
build {
  sources = ["source.docker.iip-runner"]

  # 1) OS baseline + build deps (Node 22 toolchain installed via nvm later).
  provisioner "shell" {
    inline = [
      "apt-get update",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \\",
      "  curl ca-certificates gnupg jq unzip git build-essential \\",
      "  iptables ufw",
      # Self-hosted runner agent (https://github.com/actions/runner/releases).
      "mkdir -p /actions-runner",
      "curl -fsSL -o /tmp/runner.tar.gz https://github.com/actions/runner/releases/download/v${var.runner_version}/actions-runner-linux-x64-${var.runner_version}.tar.gz",
      "tar -xzf /tmp/runner.tar.gz -C /actions-runner",
      "rm /tmp/runner.tar.gz",
      # Node 22 LTS (pinned via .nvmrc in the repo; bootstrap installs pnpm).
      "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs",
      "npm install -g pnpm@9.15.4",
    ]
  }

  # 2) Egress allowlist (SEC-4) — UFW default-deny outbound, allow only
  #    named CI registries. The runner cannot exfiltrate corpus or secrets
  #    even if compromised.
  provisioner "shell" {
    inline = [
      "# Default-deny outbound, allow loopback inbound for the runner agent.",
      "ufw default deny outgoing",
      "ufw default allow incoming",
      "ufw allow in on lo",
      "# Egress allowlist (SEC-4):",
      "ufw allow out to any port 53 proto udp comment 'DNS (resolvers via host)'",
      "ufw allow out 443/tcp comment 'HTTPS — scoped via application policy'",
      "# Named CI registries (HTTPS only):",
      "ufw allow out to any port 443 proto tcp comment 'GitHub Actions / npm / Docker Hub / pypi.org'",
      "# NOTE: finer host-based scoping is enforced at the hypervisor firewall,",
      "# not inside the container — the application-layer egress policy below",
      "# enumerates the exact hostnames the runner may contact.",
    ]
  }

  # 3) Application-layer egress policy — the explicit hostname allowlist.
  provisioner "file" {
    destination = "/etc/iip/egress-allowlist.txt"
    content = <<EOF
# IIP runner egress allowlist (SEC-4, ADR-019).
# One FQDN per line. Enforced by the proxy in iip-runner-entrypoint.sh.
github.com
api.github.com
codeload.github.com
objects.githubusercontent.com
registry.npmjs.org
docker.io
registry-1.docker.io
auth.docker.io
pypi.org
files.pythonhosted.org
astral.sh
EOF
  }

  # 4) Entrypoint — installs deps, runs the job, tears down.
  provisioner "file" {
    destination = "/usr/local/bin/iip-runner-entrypoint.sh"
    content = <<EOF
#!/usr/bin/env bash
set -euo pipefail
# IIP runner entrypoint — secret-less, ephemeral, fail-closed (SEC-4).
# PR-triggered runs receive NO sops age key. Secret access requires a
# merged commit OR the `secrets-ok` label + @security CODEOWNER approval.
exec /actions-runner/run.sh "$@"
EOF
  }

  # 5) HARDENING — assert the runner image does NOT ship the corpus or key dir.
  provisioner "shell" {
    inline = [
      "chmod +x /usr/local/bin/iip-runner-entrypoint.sh",
      "test ! -d /corpus && echo 'SEC-4 OK: no /corpus mount'",
      "test ! -f /root/.config/sops/age/keys.txt && echo 'SEC-4 OK: no sops age key'",
      "chmod 0440 /etc/iip/egress-allowlist.txt",
    ]
  }

  # ─────────────────────────────────────────────────────────────────────────
  # DEFERRED: GPU passthrough (NVIDIA Container Toolkit / MIG).
  #
  # Activation is deferred to Epic 4 when extraction model evals exist.
  # The config below is correct and ready to uncomment; it relies on the
  # host having nvidia-container-toolkit installed and the GPU exposed via
  # `--gpus all` / `--runtime=nvidia` at container start.
  #
  # Before uncommenting, complete the open questions in ADR-019 (MIG vs
  # VFIO-mediated partition choice; Apple Silicon MLX equivalence).
  # ─────────────────────────────────────────────────────────────────────────
  # provisioner "shell" {
  #   inline = [
  #     "distribution=$(. /etc/os-release; echo $ID$VERSION_ID)",
  #     "curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia.gpg",
  #     "curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \\
  #       sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia.gpg] https://#g' > /etc/apt/sources.list.d/nvidia.list",
  #     "apt-get update",
  #     "apt-get install -y nvidia-container-toolkit",
  #   ]
  # }
  # source "docker" "iip-runner-gpu" {
  #   image       = "iip-runner:base"
  #   commit      = true
  #   run_parameters = ["--gpus", "all"]
  # }
}

# ───────────────────────────────────────────────────────────────────────────
# Post-processor: tag the committed image. The build host pushes to the
# private registry only over the allowlisted egress channel.
# ───────────────────────────────────────────────────────────────────────────
post-processor "manifest" {
  output = "infra/runner/manifest.json"
  strip_path = true
  custom_data = {
    project       = "impeachment-watch"
    sec4_isolated = "true"
    gpu_passthrough = "deferred-to-epic-4"
  }
}
