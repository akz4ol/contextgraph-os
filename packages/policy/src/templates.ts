/**
 * Policy Templates
 *
 * Pre-built policy templates for common use cases.
 */

import { ok, err, createTimestamp } from '@contextgraph/core';
import type { Result, Scope, Jurisdiction } from '@contextgraph/core';
import type { PolicyRule, CreatePolicyInput, RuleEffect, ConditionOperator } from './types.js';

/**
 * Template variable definition
 */
export interface TemplateVariable {
  readonly name: string;
  readonly description: string;
  readonly type: 'string' | 'number' | 'boolean' | 'string[]' | 'scope' | 'jurisdiction';
  readonly required: boolean;
  readonly default?: unknown;
}

/**
 * Policy template definition
 */
export interface PolicyTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: 'access' | 'data-protection' | 'workflow' | 'rate-limiting' | 'geographic';
  readonly variables: readonly TemplateVariable[];
  readonly rules: readonly TemplateRule[];
  readonly defaultPriority: number;
}

/**
 * Template rule with variable placeholders
 */
export interface TemplateRule {
  readonly name: string;
  readonly description: string;
  readonly effect: RuleEffect;
  readonly conditions: readonly TemplateCondition[];
  readonly priority: number;
}

/**
 * Template condition with variable placeholders
 */
export interface TemplateCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: string | number | boolean | readonly string[]; // Can be "{{variableName}}" for substitution
}

/**
 * Variables for template instantiation
 */
export type TemplateVariables = Readonly<Record<string, unknown>>;

/**
 * Built-in policy templates
 */
export const POLICY_TEMPLATES: readonly PolicyTemplate[] = [
  {
    id: 'read-only',
    name: 'Read-Only Access',
    description: 'Allows only read operations, denies all modifications',
    category: 'access',
    variables: [
      {
        name: 'resources',
        description: 'Resource types to apply read-only access to',
        type: 'string[]',
        required: false,
        default: ['*'],
      },
    ],
    rules: [
      {
        name: 'Allow Read Operations',
        description: 'Permits read actions on specified resources',
        effect: 'allow',
        conditions: [
          { field: 'action', operator: 'in', value: ['read', 'list', 'get', 'query'] },
        ],
        priority: 100,
      },
      {
        name: 'Deny Write Operations',
        description: 'Blocks all write actions',
        effect: 'deny',
        conditions: [
          { field: 'action', operator: 'in', value: ['create', 'update', 'delete', 'write'] },
        ],
        priority: 200,
      },
    ],
    defaultPriority: 50,
  },
  {
    id: 'pii-protection',
    name: 'PII Data Protection',
    description: 'Restricts access to personally identifiable information',
    category: 'data-protection',
    variables: [
      {
        name: 'piiFields',
        description: 'Fields containing PII data',
        type: 'string[]',
        required: false,
        default: ['email', 'phone', 'ssn', 'address', 'birthdate'],
      },
      {
        name: 'allowedRoles',
        description: 'Roles allowed to access PII',
        type: 'string[]',
        required: false,
        default: ['admin', 'data-officer'],
      },
    ],
    rules: [
      {
        name: 'Allow PII Access for Authorized Roles',
        description: 'Permits PII access for specific roles',
        effect: 'allow',
        conditions: [
          { field: 'subject.role', operator: 'in', value: '{{allowedRoles}}' },
          { field: 'resource.containsPII', operator: 'equals', value: true },
        ],
        priority: 100,
      },
      {
        name: 'Deny PII Access',
        description: 'Blocks PII access for unauthorized users',
        effect: 'deny',
        conditions: [
          { field: 'resource.containsPII', operator: 'equals', value: true },
        ],
        priority: 200,
      },
    ],
    defaultPriority: 100,
  },
  {
    id: 'approval-required',
    name: 'Approval Required',
    description: 'Requires approval for specified actions',
    category: 'workflow',
    variables: [
      {
        name: 'actions',
        description: 'Actions requiring approval',
        type: 'string[]',
        required: false,
        default: ['delete', 'deploy', 'transfer'],
      },
      {
        name: 'riskLevels',
        description: 'Risk levels requiring approval',
        type: 'string[]',
        required: false,
        default: ['high', 'critical'],
      },
    ],
    rules: [
      {
        name: 'Require Approval for High-Risk Actions',
        description: 'Mandates approval for risky operations',
        effect: 'require_approval',
        conditions: [
          { field: 'action', operator: 'in', value: '{{actions}}' },
        ],
        priority: 100,
      },
      {
        name: 'Require Approval for High-Risk Levels',
        description: 'Mandates approval based on risk assessment',
        effect: 'require_approval',
        conditions: [
          { field: 'resource.riskLevel', operator: 'in', value: '{{riskLevels}}' },
        ],
        priority: 150,
      },
    ],
    defaultPriority: 75,
  },
  {
    id: 'rate-limit',
    name: 'Rate Limiting',
    description: 'Limits request frequency per subject',
    category: 'rate-limiting',
    variables: [
      {
        name: 'maxRequests',
        description: 'Maximum requests per window',
        type: 'number',
        required: false,
        default: 100,
      },
      {
        name: 'windowSeconds',
        description: 'Time window in seconds',
        type: 'number',
        required: false,
        default: 60,
      },
    ],
    rules: [
      {
        name: 'Deny Exceeded Rate Limit',
        description: 'Blocks requests when rate limit exceeded',
        effect: 'deny',
        conditions: [
          { field: 'environment.requestCount', operator: 'greater_than', value: '{{maxRequests}}' },
        ],
        priority: 50,
      },
    ],
    defaultPriority: 25,
  },
  {
    id: 'time-based',
    name: 'Time-Based Access',
    description: 'Restricts access to specific time windows',
    category: 'access',
    variables: [
      {
        name: 'startHour',
        description: 'Start hour (0-23)',
        type: 'number',
        required: false,
        default: 9,
      },
      {
        name: 'endHour',
        description: 'End hour (0-23)',
        type: 'number',
        required: false,
        default: 17,
      },
      {
        name: 'allowedDays',
        description: 'Allowed days (0=Sun, 6=Sat)',
        type: 'string[]',
        required: false,
        default: ['1', '2', '3', '4', '5'],
      },
    ],
    rules: [
      {
        name: 'Deny Outside Business Hours',
        description: 'Blocks access outside allowed time window',
        effect: 'deny',
        conditions: [
          { field: 'environment.hour', operator: 'less_than', value: '{{startHour}}' },
        ],
        priority: 100,
      },
      {
        name: 'Deny After Business Hours',
        description: 'Blocks access after allowed time window',
        effect: 'deny',
        conditions: [
          { field: 'environment.hour', operator: 'greater_than', value: '{{endHour}}' },
        ],
        priority: 100,
      },
    ],
    defaultPriority: 60,
  },
  {
    id: 'jurisdiction',
    name: 'Geographic Restrictions',
    description: 'Restricts access based on geographic jurisdiction',
    category: 'geographic',
    variables: [
      {
        name: 'allowedJurisdictions',
        description: 'Allowed jurisdictions/regions',
        type: 'string[]',
        required: true,
      },
      {
        name: 'deniedJurisdictions',
        description: 'Explicitly denied jurisdictions',
        type: 'string[]',
        required: false,
        default: [],
      },
    ],
    rules: [
      {
        name: 'Deny Blocked Jurisdictions',
        description: 'Blocks access from denied regions',
        effect: 'deny',
        conditions: [
          { field: 'environment.jurisdiction', operator: 'in', value: '{{deniedJurisdictions}}' },
        ],
        priority: 50,
      },
      {
        name: 'Allow Permitted Jurisdictions',
        description: 'Permits access from allowed regions',
        effect: 'allow',
        conditions: [
          { field: 'environment.jurisdiction', operator: 'in', value: '{{allowedJurisdictions}}' },
        ],
        priority: 100,
      },
      {
        name: 'Deny Unknown Jurisdictions',
        description: 'Blocks access from unspecified regions',
        effect: 'deny',
        conditions: [
          { field: 'environment.jurisdiction', operator: 'exists', value: true },
        ],
        priority: 200,
      },
    ],
    defaultPriority: 80,
  },
];

/**
 * Policy Template Manager
 */
export class PolicyTemplateManager {
  private readonly templates: Map<string, PolicyTemplate>;

  constructor() {
    this.templates = new Map();
    // Load built-in templates
    for (const template of POLICY_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * List all available templates
   */
  listTemplates(): readonly PolicyTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): PolicyTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: PolicyTemplate['category']): readonly PolicyTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.category === category);
  }

  /**
   * Register a custom template
   */
  registerTemplate(template: PolicyTemplate): Result<void, Error> {
    if (this.templates.has(template.id)) {
      return err(new Error(`Template already exists: ${template.id}`));
    }

    const validation = this.validateTemplate(template);
    if (!validation.ok) {
      return validation;
    }

    this.templates.set(template.id, template);
    return ok(undefined);
  }

  /**
   * Validate a template definition
   */
  validateTemplate(template: PolicyTemplate): Result<void, Error> {
    if (!template.id || template.id.trim() === '') {
      return err(new Error('Template ID is required'));
    }

    if (!template.name || template.name.trim() === '') {
      return err(new Error('Template name is required'));
    }

    if (template.rules.length === 0) {
      return err(new Error('Template must have at least one rule'));
    }

    // Check for undefined variables in rules
    const definedVars = new Set(template.variables.map((v) => v.name));
    for (const rule of template.rules) {
      for (const condition of rule.conditions) {
        const varMatch = this.extractVariable(condition.value);
        if (varMatch !== undefined && !definedVars.has(varMatch)) {
          return err(new Error(`Undefined variable in template: ${varMatch}`));
        }
      }
    }

    return ok(undefined);
  }

  /**
   * Load a template with variables to create policy input
   */
  loadTemplate(
    templateId: string,
    variables: TemplateVariables = {},
    options: { name?: string; scope?: Scope; jurisdiction?: Jurisdiction } = {}
  ): Result<CreatePolicyInput, Error> {
    const template = this.templates.get(templateId);
    if (template === undefined) {
      return err(new Error(`Template not found: ${templateId}`));
    }

    // Validate and apply variables
    const resolvedVars = this.resolveVariables(template, variables);
    if (!resolvedVars.ok) {
      return resolvedVars;
    }

    // Generate rules with substituted values
    const rules: PolicyRule[] = [];
    const now = createTimestamp();

    for (let i = 0; i < template.rules.length; i++) {
      const templateRule = template.rules[i]!;
      const ruleId = `rule_${now}_${i}`;

      const conditions = templateRule.conditions.map((cond) => ({
        field: cond.field,
        operator: cond.operator,
        value: this.substituteValue(cond.value, resolvedVars.value),
      }));

      rules.push({
        id: ruleId,
        name: templateRule.name,
        description: templateRule.description,
        effect: templateRule.effect,
        conditions,
        priority: templateRule.priority,
      });
    }

    const policyInput: CreatePolicyInput = {
      name: options.name ?? `${template.name} Policy`,
      version: '1.0.0',
      description: template.description,
      rules,
      priority: template.defaultPriority,
      ...(options.scope !== undefined ? { scope: options.scope } : {}),
      ...(options.jurisdiction !== undefined ? { jurisdiction: options.jurisdiction } : {}),
    };

    return ok(policyInput);
  }

  /**
   * Resolve and validate template variables
   */
  private resolveVariables(
    template: PolicyTemplate,
    provided: TemplateVariables
  ): Result<TemplateVariables, Error> {
    const resolved: Record<string, unknown> = {};

    for (const varDef of template.variables) {
      if (provided[varDef.name] !== undefined) {
        // Validate type
        const typeValid = this.validateVariableType(provided[varDef.name], varDef.type);
        if (!typeValid) {
          return err(new Error(`Invalid type for variable ${varDef.name}: expected ${varDef.type}`));
        }
        resolved[varDef.name] = provided[varDef.name];
      } else if (varDef.required) {
        return err(new Error(`Required variable not provided: ${varDef.name}`));
      } else if (varDef.default !== undefined) {
        resolved[varDef.name] = varDef.default;
      }
    }

    return ok(resolved);
  }

  /**
   * Validate variable type
   */
  private validateVariableType(value: unknown, type: TemplateVariable['type']): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'string[]':
        return Array.isArray(value) && value.every((v) => typeof v === 'string');
      case 'scope':
      case 'jurisdiction':
        return typeof value === 'string';
      default:
        return false;
    }
  }

  /**
   * Extract variable name from placeholder
   */
  private extractVariable(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const match = value.match(/^\{\{(\w+)\}\}$/);
      if (match !== null) {
        return match[1];
      }
    }
    return undefined;
  }

  /**
   * Substitute variable placeholders with actual values
   */
  private substituteValue(value: unknown, variables: TemplateVariables): unknown {
    if (typeof value === 'string') {
      const varName = this.extractVariable(value);
      if (varName !== undefined && variables[varName] !== undefined) {
        return variables[varName];
      }
    }
    return value;
  }
}
