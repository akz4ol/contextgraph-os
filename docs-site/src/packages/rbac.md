# @contextgraph/rbac

Role-Based Access Control with built-in roles and permission checking.

## Installation

```bash
pnpm add @contextgraph/rbac
```

## Overview

Manage access control through roles:

- Role definitions with permissions
- Role inheritance
- Permission checking
- Built-in roles

## Creating Roles

```typescript
import { RBACManager } from '@contextgraph/rbac';

const rbac = new RBACManager(storage);
await rbac.initialize();

await rbac.createRole({
  name: 'data-analyst',
  description: 'Can read and analyze data',
  permissions: [
    'read:reports',
    'read:dashboards',
    'export:csv',
  ],
  inherits: ['viewer'],
});
```

## Role Inheritance

```typescript
// Viewer role
await rbac.createRole({
  name: 'viewer',
  permissions: ['read:public'],
});

// Analyst inherits viewer
await rbac.createRole({
  name: 'analyst',
  permissions: ['read:data', 'export:csv'],
  inherits: ['viewer'],
});

// Admin inherits analyst
await rbac.createRole({
  name: 'admin',
  permissions: ['write:*', 'delete:*'],
  inherits: ['analyst'],
});
```

## Assigning Roles

```typescript
// Assign role to agent
await rbac.assignRole(agentId, 'data-analyst');

// Get agent roles
const roles = await rbac.getRoles(agentId);

// Check role
const hasRole = await rbac.hasRole(agentId, 'data-analyst');
```

## Permission Checking

```typescript
// Check single permission
const canRead = await rbac.hasPermission(agentId, 'read:reports');

// Check any of multiple permissions
const canAccess = await rbac.hasAnyPermission(agentId, ['read:reports', 'read:dashboards']);

// Get all effective permissions
const permissions = await rbac.getEffectivePermissions(agentId);
```

## Built-in Roles

| Role | Permissions |
|------|-------------|
| `viewer` | Read public data |
| `editor` | Read, write data |
| `admin` | Full access |
| `auditor` | Read audit logs |

## Permission Format

```
action:resource
action:resource:subresource
action:*
*:resource
```

Examples:
- `read:documents`
- `write:reports:quarterly`
- `delete:*`
- `*:admin-panel`
