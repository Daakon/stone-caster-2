import { describe, it, expect } from 'vitest';
import { 
  getEligibleKits, 
  validateSkillBudget, 
  getRemainingSkillPoints,
  SKILL_CONSTANTS 
} from './character-creation.config';
import type { WorldCharacterConfig } from '../types';

describe('Character Creation Config', () => {
  const mockWorldConfig: WorldCharacterConfig = {
    availableRaces: ['Human', 'Elf'],
    essenceOptions: ['Life', 'Death'],
    traitCatalog: [],
    eligibleKits: [
      {
        id: 'scout_kit',
        label: 'Scout Kit',
        items: ['Light armor', 'Bow'],
        requirements: { stealth: 60 }
      },
      {
        id: 'warrior_kit',
        label: 'Warrior Kit', 
        items: ['Heavy armor', 'Sword'],
        requirements: { combat: 60 }
      }
    ]
  };

  describe('getEligibleKits', () => {
    it('should return kits that meet requirements', () => {
      const skills = { stealth: 70, combat: 50 };
      const eligible = getEligibleKits(skills, mockWorldConfig);
      
      expect(eligible).toHaveLength(1);
      expect(eligible[0].id).toBe('scout_kit');
    });

    it('should return multiple kits if multiple requirements met', () => {
      const skills = { stealth: 70, combat: 70 };
      const eligible = getEligibleKits(skills, mockWorldConfig);
      
      expect(eligible).toHaveLength(2);
      expect(eligible.map(k => k.id)).toContain('scout_kit');
      expect(eligible.map(k => k.id)).toContain('warrior_kit');
    });

    it('should return empty array if no requirements met', () => {
      const skills = { stealth: 30, combat: 30 };
      const eligible = getEligibleKits(skills, mockWorldConfig);
      
      expect(eligible).toHaveLength(0);
    });
  });

  describe('validateSkillBudget', () => {
    it('should return true for balanced skills', () => {
      const skills = { 
        combat: 50, 
        stealth: 50, 
        social: 50, 
        lore: 50, 
        survival: 50, 
        medicine: 50, 
        craft: 50 
      };
      
      expect(validateSkillBudget(skills, 0)).toBe(true);
    });

    it('should return true for skills with budget', () => {
      const skills = { 
        combat: 60, 
        stealth: 40, 
        social: 50, 
        lore: 50, 
        survival: 50, 
        medicine: 50, 
        craft: 50 
      };
      
      expect(validateSkillBudget(skills, 0)).toBe(true);
    });

    it('should return false for unbalanced skills', () => {
      const skills = { 
        combat: 60, 
        stealth: 50, 
        social: 50, 
        lore: 50, 
        survival: 50, 
        medicine: 50, 
        craft: 50 
      };
      
      expect(validateSkillBudget(skills, 0)).toBe(false);
    });
  });

  describe('getRemainingSkillPoints', () => {
    it('should return 0 for balanced skills', () => {
      const skills = { 
        combat: 50, 
        stealth: 50, 
        social: 50, 
        lore: 50, 
        survival: 50, 
        medicine: 50, 
        craft: 50 
      };
      
      expect(getRemainingSkillPoints(skills, 0)).toBe(0);
    });

    it('should return positive for under-allocated skills', () => {
      const skills = { 
        combat: 40, 
        stealth: 50, 
        social: 50, 
        lore: 50, 
        survival: 50, 
        medicine: 50, 
        craft: 50 
      };
      
      expect(getRemainingSkillPoints(skills, 0)).toBe(10);
    });

    it('should return negative for over-allocated skills', () => {
      const skills = { 
        combat: 60, 
        stealth: 50, 
        social: 50, 
        lore: 50, 
        survival: 50, 
        medicine: 50, 
        craft: 50 
      };
      
      expect(getRemainingSkillPoints(skills, 0)).toBe(-10);
    });
  });

  describe('SKILL_CONSTANTS', () => {
    it('should have correct values', () => {
      expect(SKILL_CONSTANTS.MIN).toBe(0);
      expect(SKILL_CONSTANTS.BASELINE).toBe(50);
      expect(SKILL_CONSTANTS.MAX).toBe(100);
    });
  });
});


