import type { DiceRoll, DiceRollResult } from '@shared';

export class DiceService {
  private rollDie(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
  }

  roll(diceRoll: DiceRoll): DiceRollResult {
    const sides = parseInt(diceRoll.type.substring(1));
    const rolls: number[] = [];

    for (let i = 0; i < diceRoll.count; i++) {
      rolls.push(this.rollDie(sides));
    }

    let finalRolls = [...rolls];

    // Handle advantage/disadvantage for d20 rolls
    if (diceRoll.type === 'd20' && diceRoll.count === 1) {
      if (diceRoll.advantage) {
        const secondRoll = this.rollDie(20);
        rolls.push(secondRoll);
        finalRolls = [Math.max(rolls[0], secondRoll)];
      } else if (diceRoll.disadvantage) {
        const secondRoll = this.rollDie(20);
        rolls.push(secondRoll);
        finalRolls = [Math.min(rolls[0], secondRoll)];
      }
    }

    const total = finalRolls.reduce((sum, roll) => sum + roll, 0);
    const finalResult = total + diceRoll.modifier;

    return {
      rolls: rolls,
      total: total,
      modifier: diceRoll.modifier,
      finalResult: finalResult,
      criticalSuccess: diceRoll.type === 'd20' && finalRolls.includes(20),
      criticalFailure: diceRoll.type === 'd20' && finalRolls.includes(1),
    };
  }

  rollMultiple(rolls: DiceRoll[]): DiceRollResult[] {
    return rolls.map(roll => this.roll(roll));
  }

  calculateModifier(attributeScore: number): number {
    return Math.floor((attributeScore - 10) / 2);
  }
}

export const diceService = new DiceService();
