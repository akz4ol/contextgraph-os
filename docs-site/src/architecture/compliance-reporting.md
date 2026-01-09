# Compliance Reporting

Generate audit-ready reports for regulatory compliance, internal audits, and governance reviews.

## Overview

ContextGraph OS provides comprehensive compliance reporting:

- **Automated report generation** from decision traces
- **Evidence packages** with provenance verification
- **Multi-format export** (JSON, PDF, CSV)
- **Configurable redaction** for sensitive data
- **Chain-of-custody verification** via hash chains

## Report Types

### 1. Decision Audit Report

Complete record of decisions within a time period:

```typescript
import { ComplianceReporter } from '@contextgraph/compliance';

const reporter = new ComplianceReporter({ dtg, ckg, provenance });

const report = await reporter.generateDecisionAudit({
  timeRange: {
    from: createTimestamp('2024-10-01'),
    to: createTimestamp('2024-12-31'),
  },
  includeEvidence: true,
  includeHistory: true,
  groupBy: 'week',
});
```

**Output Structure:**

```json
{
  "reportId": "rpt_abc123",
  "generatedAt": "2025-01-15T10:00:00Z",
  "timeRange": {
    "from": "2024-10-01T00:00:00Z",
    "to": "2024-12-31T23:59:59Z"
  },
  "summary": {
    "totalDecisions": 1250,
    "approved": 1100,
    "rejected": 120,
    "failed": 30,
    "avgProcessingTime": "2.5h",
    "humanReviewRate": "15%"
  },
  "byWeek": [
    {
      "week": "2024-W40",
      "decisions": 95,
      "approved": 85,
      "rejected": 8,
      "failed": 2
    }
  ],
  "decisions": [
    {
      "id": "dec_xyz",
      "type": "publish_report",
      "status": "completed",
      "proposedBy": "agent:report-gen",
      "proposedAt": "2024-10-15T09:00:00Z",
      "evidence": [...],
      "history": [...]
    }
  ]
}
```

### 2. Provenance Verification Report

Verify integrity of the audit trail:

```typescript
const verification = await reporter.generateProvenanceVerification({
  entityIds: [entity1, entity2, entity3],
  verifyChain: true,
  verifyHashes: true,
});
```

**Output:**

```json
{
  "reportId": "rpt_def456",
  "generatedAt": "2025-01-15T10:00:00Z",
  "verification": {
    "chainIntegrity": "VALID",
    "entriesVerified": 5000,
    "hashMismatches": 0,
    "brokenLinks": 0
  },
  "entities": [
    {
      "entityId": "ent_123",
      "claims": 50,
      "provenanceEntries": 75,
      "chainValid": true,
      "oldestEntry": "2024-01-15T00:00:00Z",
      "newestEntry": "2025-01-14T23:59:59Z"
    }
  ]
}
```

### 3. Policy Evaluation Report

Summary of policy enforcement:

```typescript
const policyReport = await reporter.generatePolicyReport({
  timeRange: { from: q4Start, to: q4End },
  includeViolations: true,
  includeExceptions: true,
});
```

**Output:**

```json
{
  "summary": {
    "totalEvaluations": 5000,
    "allowed": 4200,
    "denied": 800,
    "exceptionsGranted": 50
  },
  "byPolicy": [
    {
      "policyId": "pol_pii_protection",
      "name": "PII Protection",
      "evaluations": 1200,
      "denials": 300,
      "exceptions": 15
    }
  ],
  "violations": [
    {
      "timestamp": "2024-11-15T14:30:00Z",
      "policy": "pol_high_risk",
      "subject": "agent:data-proc",
      "action": "delete",
      "resource": "customer_data/*",
      "resolution": "exception_granted",
      "approvedBy": "user:compliance_mgr"
    }
  ]
}
```

### 4. Agent Activity Report

Per-agent decision and activity summary:

```typescript
const agentReport = await reporter.generateAgentReport({
  agentId: agentId,
  timeRange: { from: monthStart, to: monthEnd },
  includeDecisions: true,
  includeCapabilities: true,
});
```

**Output:**

```json
{
  "agent": {
    "id": "agent:report-generator",
    "name": "Report Generator",
    "status": "active",
    "capabilities": ["read", "generate", "publish"]
  },
  "activity": {
    "decisionsProposed": 150,
    "decisionsApproved": 140,
    "decisionsRejected": 8,
    "decisionsFailed": 2,
    "approvalRate": "93.3%",
    "avgRiskScore": 0.35
  },
  "riskProfile": {
    "lowRisk": 100,
    "mediumRisk": 40,
    "highRisk": 10,
    "criticalRisk": 0
  }
}
```

### 5. GDPR Data Subject Report

For data subject access requests (DSAR):

```typescript
const dsarReport = await reporter.generateDSAR({
  subjectId: customerId,
  includeAllClaims: true,
  includeDecisions: true,
  includeProvenance: true,
  redactInternal: true,
});
```

**Output:**

```json
{
  "subject": {
    "id": "customer_123",
    "type": "data_subject"
  },
  "data": {
    "claims": [
      {
        "attribute": "email",
        "value": "user@example.com",
        "source": "registration_form",
        "collectedAt": "2023-06-15T10:00:00Z",
        "purpose": "account_management"
      }
    ],
    "decisions": [
      {
        "type": "marketing_email",
        "status": "completed",
        "timestamp": "2024-03-15T09:00:00Z"
      }
    ]
  },
  "provenance": {
    "dataOrigins": ["web_form", "api_import"],
    "processingActivities": 25,
    "thirdPartySharing": []
  }
}
```

## Export Formats

### JSON Export

```typescript
const jsonReport = await reporter.export({
  report: decisionAudit,
  format: 'json',
  pretty: true,
});
```

### PDF Export

```typescript
const pdfReport = await reporter.export({
  report: decisionAudit,
  format: 'pdf',
  template: 'compliance-formal',
  includeCharts: true,
  includeSignature: true,
});
```

### CSV Export

```typescript
const csvReport = await reporter.export({
  report: decisionAudit,
  format: 'csv',
  flatten: true,  // Flatten nested objects
  columns: ['id', 'type', 'status', 'proposedAt', 'approvedBy'],
});
```

## Redaction & Privacy

### Automatic PII Redaction

```typescript
const report = await reporter.generateDecisionAudit({
  timeRange: { from, to },
  redaction: {
    enabled: true,
    patterns: ['email', 'phone', 'ssn', 'credit_card'],
    replacement: '[REDACTED]',
  },
});
```

### Custom Redaction Rules

```typescript
const report = await reporter.generateDecisionAudit({
  timeRange: { from, to },
  redaction: {
    enabled: true,
    rules: [
      {
        field: 'customer.email',
        action: 'hash',  // SHA-256 hash
      },
      {
        field: 'customer.name',
        action: 'mask',  // J*** D**
      },
      {
        field: 'internal_notes',
        action: 'remove',  // Completely remove
      },
    ],
  },
});
```

### Role-Based Redaction

```typescript
const report = await reporter.generateDecisionAudit({
  timeRange: { from, to },
  redaction: {
    enabled: true,
    byRole: {
      auditor: ['internal_notes'],  // Auditors can't see internal notes
      external: ['*_internal', 'cost_*'],  // External can't see internal fields
    },
  },
  viewerRole: 'external',
});
```

## Scheduling Reports

### Automated Generation

```typescript
import { ReportScheduler } from '@contextgraph/compliance';

const scheduler = new ReportScheduler(reporter);

// Weekly decision audit
scheduler.schedule({
  id: 'weekly-audit',
  type: 'decision_audit',
  cron: '0 0 * * MON',  // Every Monday at midnight
  config: {
    timeRange: 'last_week',
    includeEvidence: true,
  },
  delivery: {
    email: ['compliance@company.com'],
    s3: 's3://compliance-reports/weekly/',
  },
});

// Monthly policy report
scheduler.schedule({
  id: 'monthly-policy',
  type: 'policy_report',
  cron: '0 0 1 * *',  // First of every month
  config: {
    timeRange: 'last_month',
    includeViolations: true,
  },
  delivery: {
    email: ['security@company.com'],
  },
});
```

### On-Demand Generation

```typescript
// Generate report immediately
const report = await scheduler.runNow('weekly-audit');

// Generate with custom time range
const customReport = await scheduler.runNow('weekly-audit', {
  timeRange: {
    from: createTimestamp('2024-10-01'),
    to: createTimestamp('2024-10-31'),
  },
});
```

## Compliance Dashboards

### Metrics Query

```typescript
const metrics = await reporter.getMetrics({
  timeRange: { from: monthStart, to: now },
});

// Returns:
// {
//   decisions: { total: 1000, approved: 900, rejected: 80, failed: 20 },
//   policies: { evaluations: 5000, denials: 400, exceptions: 25 },
//   provenance: { entries: 10000, verified: 10000, invalid: 0 },
//   agents: { active: 15, suspended: 2, total: 17 },
// }
```

### Trend Analysis

```typescript
const trends = await reporter.getTrends({
  timeRange: { from: yearStart, to: now },
  granularity: 'month',
  metrics: ['decision_volume', 'rejection_rate', 'avg_risk_score'],
});

// Returns monthly data points for trend visualization
```

## Regulatory Templates

### SOC 2 Report

```typescript
const soc2 = await reporter.generateSOC2({
  timeRange: { from: auditStart, to: auditEnd },
  trustPrinciples: ['security', 'availability', 'confidentiality'],
});
```

### ISO 27001 Evidence

```typescript
const iso27001 = await reporter.generateISO27001Evidence({
  controls: ['A.9.4.1', 'A.12.4.1', 'A.16.1.2'],
  timeRange: { from: auditStart, to: auditEnd },
});
```

### HIPAA Audit Trail

```typescript
const hipaa = await reporter.generateHIPAAReport({
  timeRange: { from: auditStart, to: auditEnd },
  includePHIAccess: true,
  includeDisclosures: true,
});
```

## Verification & Signing

### Hash Verification

```typescript
// Verify report hasn't been tampered with
const verification = reporter.verifyReport(reportJson);

// {
//   valid: true,
//   hash: "sha256:abc123...",
//   generatedAt: "2025-01-15T10:00:00Z",
//   verifiedAt: "2025-01-15T12:00:00Z"
// }
```

### Digital Signatures

```typescript
const signedReport = await reporter.signReport(report, {
  signer: 'compliance-officer',
  certificate: '/path/to/cert.pem',
  timestamp: true,
});
```

## Best Practices

### 1. Regular Verification

```typescript
// Run weekly provenance verification
scheduler.schedule({
  id: 'weekly-verification',
  type: 'provenance_verification',
  cron: '0 2 * * SUN',  // Sunday 2 AM
  config: {
    verifyChain: true,
    verifyHashes: true,
    alertOnFailure: true,
  },
  alerts: {
    onFailure: ['security@company.com'],
  },
});
```

### 2. Retain Reports

```typescript
// Archive reports with retention policy
const report = await reporter.generateDecisionAudit({
  timeRange: { from, to },
  archive: {
    enabled: true,
    location: 's3://compliance-archive/',
    retention: '7 years',
    encryption: 'AES-256',
  },
});
```

### 3. Test Report Generation

```typescript
// Validate report generation in CI/CD
describe('Compliance Reports', () => {
  it('generates valid decision audit', async () => {
    const report = await reporter.generateDecisionAudit({
      timeRange: { from: testStart, to: testEnd },
    });

    expect(report.summary).toBeDefined();
    expect(report.decisions.length).toBeGreaterThan(0);
    expect(reporter.verifyReport(report).valid).toBe(true);
  });
});
```

### 4. Document Report Recipients

```typescript
// Maintain audit trail of report distribution
const distribution = await reporter.distribute(report, {
  recipients: ['compliance@company.com', 'auditor@external.com'],
  logDistribution: true,
  requireAcknowledgment: true,
});
```

## Next Steps

- [Enterprise Deployment](./enterprise-deployment.md)
- [Governance Deep Dive](./governance.md)
- [Decision Trace Graph](./decision-trace.md)
