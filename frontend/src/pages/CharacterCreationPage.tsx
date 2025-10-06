import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createCharacter } from '../lib/api';
import type { Character } from '@shared';

const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Tiefling', 'Dragonborn'];
const CLASSES = ['Warrior', 'Mage', 'Rogue', 'Cleric', 'Ranger', 'Bard', 'Paladin'];

export default function CharacterCreationPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [race, setRace] = useState(RACES[0]);
  const [characterClass, setCharacterClass] = useState(CLASSES[0]);
  const [attributes, setAttributes] = useState({
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });

  const createCharacterMutation = useMutation({
    mutationFn: async (character: Partial<Character>) => {
      const result = await createCharacter(character);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      navigate('/characters');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newCharacter: Partial<Character> = {
      name,
      race,
      class: characterClass,
      level: 1,
      experience: 0,
      attributes,
      skills: [],
      inventory: [],
      currentHealth: 10 + attributes.constitution,
      maxHealth: 10 + attributes.constitution,
    };

    createCharacterMutation.mutate(newCharacter);
  };

  const updateAttribute = (attr: keyof typeof attributes, value: number) => {
    setAttributes(prev => ({ ...prev, [attr]: value }));
  };

  return (
    <div className="character-creation-page">
      <header>
        <h1>Create Your Character</h1>
      </header>

      <form onSubmit={handleSubmit} aria-label="Character creation form">
        <section className="form-section">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label htmlFor="name">Character Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-required="true"
              maxLength={50}
            />
          </div>

          <div className="form-group">
            <label htmlFor="race">Race</label>
            <select
              id="race"
              value={race}
              onChange={(e) => setRace(e.target.value)}
              required
              aria-required="true"
            >
              {RACES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="class">Class</label>
            <select
              id="class"
              value={characterClass}
              onChange={(e) => setCharacterClass(e.target.value)}
              required
              aria-required="true"
            >
              {CLASSES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="form-section">
          <h2>Attributes</h2>
          <p className="help-text">Adjust your character's base attributes (1-20)</p>
          
          <div className="attributes-grid">
            {Object.entries(attributes).map(([attr, value]) => (
              <div key={attr} className="attribute-input">
                <label htmlFor={attr}>
                  {attr.charAt(0).toUpperCase() + attr.slice(1)}
                </label>
                <input
                  id={attr}
                  type="range"
                  min="1"
                  max="20"
                  value={value}
                  onChange={(e) => updateAttribute(attr as keyof typeof attributes, parseInt(e.target.value))}
                  aria-valuemin={1}
                  aria-valuemax={20}
                  aria-valuenow={value}
                />
                <span className="attribute-value" aria-live="polite">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createCharacterMutation.isPending}
            aria-busy={createCharacterMutation.isPending}
          >
            {createCharacterMutation.isPending ? 'Creating...' : 'Create Character'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/characters')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>

        {createCharacterMutation.isError && (
          <div className="error-message" role="alert">
            Failed to create character. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}
