# GreenCloud DDoS Coverage Request

Status on 2026-10-24: prepared, not submitted. No authenticated provider session is available to this agent. No mitigation entitlement or provider response has been confirmed, and no paid change is authorized by this request.

## Public Evidence

The [official VDS listing](https://greencloudvps.com/billing/index.php/store/epyc-nvme-kvm-vds?language=english) includes `EPYCVDSJPSB-1`: Tokyo SoftBank, 8 GB RAM, 80 GB NVMe, one dedicated EPYC Milan core, and 2 TB traffic. This matches the specifications supplied by the operator, but does not establish the SKU or network assignment of the purchased service. The listing does not specify DDoS mitigation capacity or activation thresholds.

GreenCloud's [terms](https://cdn.greencloudvps.com/terms-of-service.php) allow null-routing or suspension during DoS incidents. Its [SLA](https://greencloudvps.com/service-level-agreement.php) excludes DDoS-related events. These statements neither establish that scrubbing is included nor establish that it is absent.

The [Technical Support ticket destination](https://greencloudvps.com/billing/submitticket.php?deptid=2&step=2) redirects unauthenticated visitors to login. Root SSH access to a VPS does not authenticate its billing/support account.

## Ticket Draft

Department: Technical Support

Subject: Confirm included upstream IPv4/IPv6 DDoS mitigation and null-route policy for 185.184.223.23

Hello GreenCloud Support,

Please confirm the network-level DDoS protection included with our existing VPS:

- IPv4: 185.184.223.23
- Assigned IPv6 address/prefix: 2403:71c0:2000:11ca::a/64
- Expected plan/location from our order specifications: EPYCVDSJPSB-1, Tokyo SoftBank, 8 GB RAM, 80 GB NVMe, one dedicated EPYC Milan core, 2 TB traffic. Please verify the actual service SKU, location, and network line rather than relying on this description.

We need a written answer specific to this service, not general advice to use a host firewall or an HTTP reverse proxy:

1. Is upstream traffic scrubbing included and enabled now? Is it always on or triggered? If triggered, what detection/activation delay applies?
2. Which L3/L4 flood types and protocols are covered? What attack PPS/Gbps and clean-traffic limits apply? Please distinguish mitigation capacity from the advertised port speed.
3. Are this IPv4 address and the assigned IPv6 prefix equally protected? Is UDP traffic covered, including a WireGuard endpoint?
4. What conditions trigger null-routing or suspension instead of scrubbing? How long does a null-route last, is restoration automatic, and what is the emergency escalation path?
5. Is any customer-side opt-in or configuration required? Can you confirm the current setting for this service?
6. If the current plan has no scrubbing, what protected add-on, location, or service is available? Please provide coverage, limits, setup/recurring charges, and any IP change, migration, downtime, or cancellation implications.
7. Are attack traffic and mitigation counted toward the monthly traffic allowance, and are incident notifications or reports available?

This is a coverage inquiry only. Please do not provision paid services, change IPs, migrate, restart, or alter the existing service without our separate written approval. We are not requesting or authorizing an attack/load test.

Thank you.

## Completion Criteria

- Record the support ticket ID and provider reply privately; do not publish billing account details or private support credentials.
- Confirm the actual service and both address families, active mitigation state, thresholds, exclusions, and recovery policy.
- If a change is needed, review its cost and service impact with the operator before ordering or changing the deployment.
- Update `origin-protection.md` only with supported facts. Until then, upstream coverage remains unconfirmed.
