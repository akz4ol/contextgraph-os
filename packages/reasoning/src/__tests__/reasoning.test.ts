/**
 * Reasoning Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RelationRegistry,
  createRelationRegistry,
  RuleEngine,
  RuleRegistry,
  PatternMatcher,
  createRuleEngine,
  BUILTIN_RULES,
  type Fact,
} from '../index.js';

describe('RelationRegistry', () => {
  let registry: RelationRegistry;

  beforeEach(() => {
    registry = createRelationRegistry();
  });

  describe('built-in relations', () => {
    it('should have transitive relations', () => {
      const transitive = registry.getByType('transitive');
      expect(transitive.length).toBeGreaterThan(0);
      expect(transitive.some((r) => r.name === 'partOf')).toBe(true);
      expect(transitive.some((r) => r.name === 'subclassOf')).toBe(true);
    });

    it('should have symmetric relations', () => {
      const symmetric = registry.getByType('symmetric');
      expect(symmetric.length).toBeGreaterThan(0);
      expect(symmetric.some((r) => r.name === 'knows')).toBe(true);
      expect(symmetric.some((r) => r.name === 'siblingOf')).toBe(true);
    });

    it('should have inverse relations', () => {
      const inverse = registry.getByType('inverse');
      expect(inverse.length).toBeGreaterThan(0);
      expect(inverse.some((r) => r.name === 'parentOf')).toBe(true);
      expect(inverse.some((r) => r.name === 'employs')).toBe(true);
    });
  });

  describe('relation properties', () => {
    it('should identify transitive relations', () => {
      expect(registry.isTransitive('partOf')).toBe(true);
      expect(registry.isTransitive('knows')).toBe(false);
    });

    it('should identify symmetric relations', () => {
      expect(registry.isSymmetric('knows')).toBe(true);
      expect(registry.isSymmetric('parentOf')).toBe(false);
    });

    it('should get inverse of a relation', () => {
      expect(registry.getInverse('parentOf')).toBe('childOf');
      expect(registry.getInverse('childOf')).toBe('parentOf');
      expect(registry.getInverse('employs')).toBe('employedBy');
    });

    it('should return same name for symmetric inverse', () => {
      expect(registry.getInverse('knows')).toBe('knows');
      expect(registry.getInverse('siblingOf')).toBe('siblingOf');
    });
  });

  describe('custom relations', () => {
    it('should register custom relation', () => {
      registry.register({
        name: 'customTransitive',
        type: 'transitive',
        description: 'Custom transitive relation',
      });

      expect(registry.get('customTransitive')).toBeDefined();
      expect(registry.isTransitive('customTransitive')).toBe(true);
    });

    it('should register inverse pair', () => {
      registry.register({
        name: 'teaches',
        type: 'inverse',
        inverseName: 'taughtBy',
        description: 'Teaching relationship',
      });

      expect(registry.getInverse('teaches')).toBe('taughtBy');
      expect(registry.getInverse('taughtBy')).toBe('teaches');
    });
  });
});

describe('PatternMatcher', () => {
  const matcher = new PatternMatcher();

  describe('matchCondition', () => {
    it('should match literal values', () => {
      const condition = { subject: 'alice', predicate: 'knows', object: 'bob' };
      const fact: Fact = { subject: 'alice', predicate: 'knows', object: 'bob' };

      const result = matcher.matchCondition(condition, fact, {});
      expect(result).not.toBeNull();
    });

    it('should not match different values', () => {
      const condition = { subject: 'alice', predicate: 'knows', object: 'charlie' };
      const fact: Fact = { subject: 'alice', predicate: 'knows', object: 'bob' };

      const result = matcher.matchCondition(condition, fact, {});
      expect(result).toBeNull();
    });

    it('should bind variables', () => {
      const condition = { subject: '?x', predicate: 'knows', object: '?y' };
      const fact: Fact = { subject: 'alice', predicate: 'knows', object: 'bob' };

      const result = matcher.matchCondition(condition, fact, {});
      expect(result).not.toBeNull();
      expect(result?.['?x']).toBe('alice');
      expect(result?.['?y']).toBe('bob');
    });

    it('should match with existing bindings', () => {
      const condition = { subject: '?x', predicate: 'knows', object: 'bob' };
      const fact: Fact = { subject: 'alice', predicate: 'knows', object: 'bob' };

      const result = matcher.matchCondition(condition, fact, { '?x': 'alice' });
      expect(result).not.toBeNull();
    });

    it('should not match conflicting bindings', () => {
      const condition = { subject: '?x', predicate: 'knows', object: 'bob' };
      const fact: Fact = { subject: 'alice', predicate: 'knows', object: 'bob' };

      const result = matcher.matchCondition(condition, fact, { '?x': 'charlie' });
      expect(result).toBeNull();
    });
  });

  describe('applyBindings', () => {
    it('should apply bindings to conclusion', () => {
      const conclusion = { subject: '?x', predicate: 'friendOf', object: '?y' };
      const bindings = { '?x': 'alice', '?y': 'bob' };

      const result = matcher.applyBindings(conclusion, bindings);
      expect(result).toEqual({ subject: 'alice', predicate: 'friendOf', object: 'bob' });
    });

    it('should return null for unbound variables', () => {
      const conclusion = { subject: '?x', predicate: 'friendOf', object: '?z' };
      const bindings = { '?x': 'alice', '?y': 'bob' };

      const result = matcher.applyBindings(conclusion, bindings);
      expect(result).toBeNull();
    });

    it('should keep literal values', () => {
      const conclusion = { subject: '?x', predicate: 'type', object: 'Person' };
      const bindings = { '?x': 'alice' };

      const result = matcher.applyBindings(conclusion, bindings);
      expect(result).toEqual({ subject: 'alice', predicate: 'type', object: 'Person' });
    });
  });
});

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = createRuleEngine();
  });

  describe('built-in rules', () => {
    it('should have built-in rules loaded', () => {
      const rules = engine.getRules().getAll();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should have transitive closure rule', () => {
      const rule = engine.getRules().get('transitive-closure');
      expect(rule).toBeDefined();
      expect(rule?.conditions).toHaveLength(2);
    });
  });

  describe('findMatches', () => {
    it('should find matching rules', () => {
      const facts: Fact[] = [
        { subject: 'a', predicate: 'rel', object: 'b' },
        { subject: 'b', predicate: 'rel', object: 'c' },
      ];

      const matches = engine.findMatches(facts);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('forwardChain', () => {
    it('should infer new facts', () => {
      const facts: Fact[] = [
        { subject: 'a', predicate: 'partOf', object: 'b' },
        { subject: 'b', predicate: 'partOf', object: 'c' },
      ];

      const result = engine.forwardChain(facts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.facts.length).toBeGreaterThan(2);
        expect(result.value.newFactsCount).toBeGreaterThan(0);
      }
    });

    it('should respect maxIterations', () => {
      const facts: Fact[] = [
        { subject: 'a', predicate: 'rel', object: 'b' },
      ];

      const result = engine.forwardChain(facts, { maxIterations: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.iterations).toBeLessThanOrEqual(1);
      }
    });

    it('should handle empty facts', () => {
      const result = engine.forwardChain([]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.facts).toHaveLength(0);
      }
    });

    it('should not duplicate facts', () => {
      const facts: Fact[] = [
        { subject: 'a', predicate: 'knows', object: 'b' },
        { subject: 'a', predicate: 'knows', object: 'b' }, // duplicate
      ];

      const result = engine.forwardChain(facts);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const knowsFacts = result.value.facts.filter(
          (f) => f.subject === 'a' && f.predicate === 'knows' && f.object === 'b'
        );
        expect(knowsFacts).toHaveLength(1);
      }
    });
  });
});

describe('RuleRegistry', () => {
  it('should register and retrieve rules', () => {
    const registry = new RuleRegistry(false);

    registry.register({
      id: 'test-rule',
      name: 'Test Rule',
      description: 'A test rule',
      conditions: [{ subject: '?x', predicate: 'test', object: '?y' }],
      conclusions: [{ subject: '?x', predicate: 'tested', object: '?y' }],
      priority: 50,
      enabled: true,
    });

    expect(registry.get('test-rule')).toBeDefined();
    expect(registry.size).toBe(1);
  });

  it('should unregister rules', () => {
    const registry = new RuleRegistry(false);

    registry.register({
      id: 'temp-rule',
      name: 'Temp',
      description: 'Temporary',
      conditions: [],
      conclusions: [],
      priority: 0,
      enabled: true,
    });

    expect(registry.unregister('temp-rule')).toBe(true);
    expect(registry.get('temp-rule')).toBeUndefined();
  });

  it('should enable/disable rules', () => {
    const registry = new RuleRegistry(false);

    registry.register({
      id: 'toggle-rule',
      name: 'Toggle',
      description: 'Toggleable',
      conditions: [],
      conclusions: [],
      priority: 0,
      enabled: true,
    });

    registry.setEnabled('toggle-rule', false);
    expect(registry.getAll()).toHaveLength(0);

    registry.setEnabled('toggle-rule', true);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('should sort rules by priority', () => {
    const registry = new RuleRegistry(false);

    registry.register({
      id: 'low',
      name: 'Low',
      description: '',
      conditions: [],
      conclusions: [],
      priority: 10,
      enabled: true,
    });

    registry.register({
      id: 'high',
      name: 'High',
      description: '',
      conditions: [],
      conclusions: [],
      priority: 100,
      enabled: true,
    });

    const rules = registry.getAll();
    expect(rules[0].id).toBe('high');
    expect(rules[1].id).toBe('low');
  });
});

describe('BUILTIN_RULES', () => {
  it('should have valid structure', () => {
    for (const rule of BUILTIN_RULES) {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.conditions).toBeInstanceOf(Array);
      expect(rule.conclusions).toBeInstanceOf(Array);
      expect(typeof rule.priority).toBe('number');
      expect(typeof rule.enabled).toBe('boolean');
    }
  });
});
