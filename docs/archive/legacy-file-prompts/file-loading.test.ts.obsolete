import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('File Loading from AI API Prompts', () => {
  it('should load CORE data from backend/AI API Prompts/core.prompt.json', async () => {
    const possiblePaths = [
      `backend/AI API Prompts/core.prompt.json`,
      `AI API Prompts/core.prompt.json`,
    ];

    let coreData = null;
    for (const path of possiblePaths) {
      try {
        const fullPath = join(process.cwd(), path);
        const content = readFileSync(fullPath, 'utf-8');
        coreData = JSON.parse(content);
        break;
      } catch (error) {
        continue;
      }
    }
    
    expect(coreData).not.toBeNull();
    expect(coreData).toHaveProperty('id');
    expect(coreData).toHaveProperty('contract');
    expect(coreData).toHaveProperty('turn_rules');
    expect(coreData).toHaveProperty('skills');
    expect(coreData).toHaveProperty('timekeeping');
    
    // Verify it's the actual core data, not hardcoded
    expect(coreData.id).toBe('core.prompt.v3');
    expect(coreData.contract.awf_return).toContain('Return exactly one JSON object');
    expect(coreData.skills.scale).toEqual({ min: 0, baseline: 50, max: 100 });
  });

  it('should load WORLD data from backend/AI API Prompts/worlds/mystika/world.prompt.json', async () => {
    const possiblePaths = [
      `backend/AI API Prompts/worlds/mystika/world.prompt.json`,
      `AI API Prompts/worlds/mystika/world.prompt.json`,
    ];

    let worldData = null;
    for (const path of possiblePaths) {
      try {
        const fullPath = join(process.cwd(), path);
        const content = readFileSync(fullPath, 'utf-8');
        worldData = JSON.parse(content);
        break;
      } catch (error) {
        continue;
      }
    }
    
    expect(worldData).not.toBeNull();
    expect(worldData).toHaveProperty('id');
    expect(worldData).toHaveProperty('name');
    expect(worldData).toHaveProperty('timeworld');
    expect(worldData).toHaveProperty('magic');
    expect(worldData).toHaveProperty('essence_behavior');
    
    // Verify it's the actual world data, not hardcoded
    expect(worldData.id).toBe('world.mystika.prompt.v3');
    expect(worldData.name).toBe('Mystika');
    expect(worldData.timeworld.bands).toHaveLength(4);
    expect(worldData.magic.domains).toContain('Creation');
    expect(worldData.essence_behavior).toHaveProperty('Life');
  });

  it('should return null for non-existent world', async () => {
    const possiblePaths = [
      `backend/AI API Prompts/worlds/non-existent-world/world.prompt.json`,
      `AI API Prompts/worlds/non-existent-world/world.prompt.json`,
    ];

    let worldData = null;
    for (const path of possiblePaths) {
      try {
        const fullPath = join(process.cwd(), path);
        const content = readFileSync(fullPath, 'utf-8');
        worldData = JSON.parse(content);
        break;
      } catch (error) {
        continue;
      }
    }
    
    expect(worldData).toBeNull();
  });
});
