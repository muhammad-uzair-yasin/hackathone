# BioRoute Cold-Chain: Business Context & Operations Manual

## 1. Company Overview

BioRoute Cold-Chain is a specialized last-mile logistics company transporting
temperature-sensitive medical supplies (vaccines, insulin, blood plasma, organs)
between regional hubs and hospitals across the city's 9 districts.

We operate 24/7 with a fleet of refrigerated vehicles. Our #1 priority is
**zero cargo spoilage**. The second priority is **on-time delivery to hospitals**.

## 2. Critical Operational Constraints

### Temperature Rules
- Standard refrigerated trucks maintain internal temperature for a maximum of
  **45 minutes** if the external environment exceeds **38°C** and the truck is
  idling (stuck in traffic, unable to move).
- Blood Plasma and Organs have a stricter threshold: **20 minutes** at >35°C.
- If a truck is moving (even slowly), airflow reduces effective risk by ~30%.

### Cargo Criticality Tiers
| Tier | Cargo Type | Max Idle (>38°C) | Value |
|------|-----------|------------------|-------|
| ULTRA | Blood Plasma, Organs | 20 min | $120,000+ |
| CRITICAL | Insulin, Vaccines | 45 min | $50,000 |
| STANDARD | Saline IVs, Bandages | 180 min | $5,000-$10,000 |

### Spoilage Impact
- Spoiled medical cargo results in a **total financial loss** of the shipment.
- Beyond the financial loss, spoilage creates a **critical medical shortage**
  at the destination hospital, which can result in patient harm.
- Company policy: any spoilage event triggers a full incident report and
  potential contract penalty.

## 3. Emergency Protocols

### Rerouting Policy
If ALL of the following conditions are true, the truck MUST be immediately rerouted:
1. The primary route is blocked OR the truck has been idling for >15 minutes.
2. External temperature exceeds the cargo's threshold.
3. Time to failure is less than 60 minutes.

The truck must be rerouted to the **nearest Backup Cold-Storage Facility** listed
in the shipment record.

### Notification Policy
Any reroute or delay of >30 minutes MUST trigger an immediate notification to:
1. The **Destination Hospital Administration** (email + SMS).
2. The **Driver** (SMS with new route instructions).
3. The **Dispatch Control Center** (internal system log).

Notifications must include:
- Shipment ID and cargo type
- Reason for action (hazard description)
- New destination / ETA
- Emergency contact number

## 4. Active Shipment Database

The live shipment database is stored at `/data/active_shipments.json`.
Always read this file when analyzing impact. Do not make assumptions about
which shipments are active — always check the file.

Key fields per shipment:
- `shipment_id`: Unique identifier (e.g., "SHP-882")
- `cargo_type`: Type of medical cargo
- `max_idling_temp_threshold_celsius`: Temperature above which spoilage clock starts
- `max_safe_idle_minutes`: Minutes until spoilage if idling above threshold
- `primary_route`: Current planned route
- `backup_facility`: Where to reroute if primary route is compromised
- `backup_route`: The alternative route to take

## 5. Geographic Reference

### District-to-Route Mapping
| District | Primary Highways | Risk Zone |
|----------|-----------------|-----------|
| District 1 | Route 66, Avenue 3 | Low (commercial) |
| District 2 | Highway 4, Ring Road | Medium |
| District 3 | Route 7, Inner Ring | Low (industrial) |
| District 4 | Highway 9, Highway 11 | HIGH (flood/heat prone) |
| District 5 | Highway 12, Route 5 | Medium |
| District 6 | Route 2, Avenue 9 | Low |
| District 7 | Highway 12, Outer Ring | High (traffic congestion) |

### Backup Cold-Storage Facilities
| Facility | Location | Capacity | Contact |
|----------|----------|----------|---------|
| District 3 Cold-Vault | District 3 Industrial Zone | High | +92-21-3344556 |
| District 1 Hub | District 1 Central | Medium | +92-21-1122334 |
| District 5 BioStorage | District 5 Medical Park | High (Plasma-rated) | +92-21-5566778 |

## 6. How to Analyze a Situation

When you receive a hazard alert:
1. Extract: What happened? Where? How bad? How long?
2. Cross-reference: Which shipments use the affected route or destination?
3. Calculate: Time-to-failure = (max_safe_idle_minutes) - (current_idle_time_estimate)
4. Decide: Is time-to-failure < 60 minutes? → Reroute immediately.
5. Act: Update the database. Notify all stakeholders.
6. Log: Write the complete event to the state log.
