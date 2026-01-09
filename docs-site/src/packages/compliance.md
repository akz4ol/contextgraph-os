# @contextgraph/compliance

Compliance reporting and GDPR features.

## Installation

```bash
pnpm add @contextgraph/compliance
```

## Overview

Support regulatory compliance:

- Audit reports
- Access reports
- Decision reports
- GDPR data subject rights

## Audit Reports

```typescript
import { ComplianceReporter } from '@contextgraph/compliance';

const reporter = new ComplianceReporter(ckg, dtg, provenance, storage);

const report = await reporter.generateAuditReport({
  from: startDate,
  to: endDate,
  format: 'json', // or 'pdf', 'csv'
  include: ['entities', 'claims', 'decisions', 'provenance'],
});
```

## Access Reports

```typescript
// Who accessed what
const accessReport = await reporter.generateAccessReport({
  entityId: entityId,
  from: startDate,
  to: endDate,
});
```

## Decision Reports

```typescript
// Decision analytics
const decisionReport = await reporter.generateDecisionReport({
  from: startDate,
  to: endDate,
  groupBy: 'agent', // or 'type', 'status'
});
```

## GDPR Support

### Data Subject Access

```typescript
// Get all data for a person
const subjectData = await reporter.getDataSubjectData(personId);
```

### Data Portability

```typescript
// Export data in portable format
const exportData = await reporter.exportDataSubjectData(personId, {
  format: 'json',
  include: ['profile', 'claims', 'decisions'],
});
```

### Right to Erasure

```typescript
// Delete with provenance tracking
await reporter.deleteDataSubjectData(personId, {
  reason: 'GDPR Article 17 request',
  requestId: 'gdpr_req_123',
  retainAudit: true, // Keep audit trail
});
```

### Consent Tracking

```typescript
// Record consent
await reporter.recordConsent(personId, {
  purpose: 'marketing',
  granted: true,
  timestamp: createTimestamp(),
});

// Check consent
const hasConsent = await reporter.hasConsent(personId, 'marketing');

// Withdraw consent
await reporter.withdrawConsent(personId, 'marketing');
```

## Report Formats

| Format | Description |
|--------|-------------|
| `json` | Machine-readable JSON |
| `csv` | Spreadsheet-compatible |
| `pdf` | Human-readable document |

## Scheduling Reports

```typescript
// Schedule daily compliance report
await reporter.schedule({
  type: 'audit',
  frequency: 'daily',
  recipients: ['compliance@example.com'],
  format: 'pdf',
});
```
