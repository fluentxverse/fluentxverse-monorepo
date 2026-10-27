#!/usr/bin/env bash
set -euo pipefail
umask 077

test "$(id -u)" = 0
. /etc/os-release
test "$ID" = fedora
test -s /root/fluentxverse-deploy.pub
test ! -e /opt/fluentxverse/BOOTSTRAP_COMPLETE
if command -v docker >/dev/null && test -n "$(docker ps -aq)"; then
  printf '%s\n' 'Existing containers detected; inspect the host before provisioning.' >&2
  exit 1
fi

dnf -y upgrade --refresh
dnf -y install dnf5-plugins firewalld rsync curl jq tar gzip zstd openssl \
  policycoreutils-python-utils dnf5-plugin-automatic
dnf config-manager addrepo --overwrite --from-repofile https://download.docker.com/linux/fedora/docker-ce.repo
dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

install -d -m 0755 /etc/docker
test ! -e /etc/docker/daemon.json
install -m 0644 /root/fluentxverse-bootstrap/docker-daemon.json /etc/docker/daemon.json
dockerd --validate --config-file=/etc/docker/daemon.json
systemctl enable --now firewalld
firewall-cmd --set-default-zone=public
firewall-cmd --permanent --zone=public --add-service=ssh
firewall-cmd --permanent --zone=public --remove-service=mdns || true
firewall-cmd --reload
systemctl enable --now docker

if ! id fluentxverse-deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash fluentxverse-deploy
fi
usermod -aG docker fluentxverse-deploy
install -d -m 0700 -o fluentxverse-deploy -g fluentxverse-deploy /home/fluentxverse-deploy/.ssh
install -m 0600 -o fluentxverse-deploy -g fluentxverse-deploy \
  /root/fluentxverse-deploy.pub /home/fluentxverse-deploy/.ssh/authorized_keys
restorecon -RF /home/fluentxverse-deploy/.ssh

install -d -m 0750 -o fluentxverse-deploy -g fluentxverse-deploy /opt/fluentxverse
install -d -m 0700 -o fluentxverse-deploy -g fluentxverse-deploy \
  /opt/fluentxverse/secrets /opt/fluentxverse/backups /opt/fluentxverse/releases
install -d -m 0750 -o fluentxverse-deploy -g fluentxverse-deploy \
  /opt/fluentxverse/shared /opt/fluentxverse/state

install -m 0644 /root/fluentxverse-bootstrap/sshd-hardening.conf /etc/ssh/sshd_config.d/00-fluentxverse-hardening.conf
sshd -t
systemctl reload sshd

# Limit journald on a small disk; container logs have independent rotation.
install -d -m 0755 /etc/systemd/journald.conf.d
install -m 0644 /root/fluentxverse-bootstrap/journald.conf /etc/systemd/journald.conf.d/fluentxverse.conf
systemctl restart systemd-journald

# Download updates automatically, but do not restart a live testing stack unattended.
install -m 0644 /root/fluentxverse-bootstrap/dnf-automatic.conf /etc/dnf/automatic.conf
systemctl enable --now dnf5-automatic.timer

date -u +%FT%TZ > /opt/fluentxverse/BOOTSTRAP_COMPLETE
printf '%s\n' 'Host preparation complete. No application services or public routes activated.'
