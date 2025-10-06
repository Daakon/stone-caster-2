# Prompt Load Order & Authority Hierarchy

## Critical: Load Order Matters

The RPG Storyteller AI system uses a **strict load order** to ensure proper authority precedence and prevent conflicts. Files loaded later have higher authority and can override earlier definitions.

## Load Order (Sequential)

### 1. Foundation Layer

```
1. world-codex.{world}-lore.md          # World lore & setting
2. world-codex.{world}-logic.json       # World-specific rules & mechanics
```

### 2. Core Systems Layer

```
3. systems.unified.json                 # Universal mechanics & rules
4. style.ui-global.json                 # UI & presentation standards
```

### 3. Engine Layer

```
5. core.rpg-storyteller.json            # Core narrative protocols
6. engine.system.json                   # AWF contract & action definitions
7. awf.scheme.json                      # JSON schema validation
```

### 4. AI Behavior Layer

```
8. agency.presence-and-guardrails.json  # AI behavior controls & safety
```

### 5. Data Management Layer

```
9. save.instructions.json               # Save/load protocols
10. validation.save.json                # Save validation rules
11. validation.assets.json              # Asset validation rules
12. validation.world-specific.json      # World-specific validation
```

### 6. Performance Layer

```
13. performance.benchmarks.json         # Performance guidelines & optimization
```

### 7. Content Layer

```
14. adventure.{world}.json              # Current adventure context
```

### 8. Enhancement Layer

```
16. essence-integration-enhancement.json # Mystika essence mechanics (if applicable)
17. adventure.{world}-expanded.json     # Expanded world content (if applicable)
```

## Authority Hierarchy

**Higher Authority (Later Files) → Lower Authority (Earlier Files)**

### Override Rules:

- **Content Layer** can override **Engine Layer** for world-specific mechanics
- **AI Behavior Layer** can override **Core Systems Layer** for safety
- **Validation Layer** can override **Data Management Layer** for consistency
- **Enhancement Layer** can override **Content Layer** for improvements

### Conflict Resolution:

1. **Later files win** in case of direct conflicts
2. **Validation rules** can block invalid configurations
3. **Safety rules** take precedence over performance
4. **World-specific rules** override generic rules

## File Dependencies

### Required Dependencies:

- `engine.system.json` requires `awf.scheme.json`
- `validation.world-specific.json` requires world lore files
- `performance.benchmarks.json` requires `engine.system.json`
- Adventure files require world lore and core systems

### Optional Dependencies:

- Enhancement files are optional and world-specific
- Expanded content files are optional and additive

## Load Order Validation

### Pre-Load Checks:

- [ ] All required files exist
- [ ] File versions are compatible
- [ ] World-specific files match current world
- [ ] No circular dependencies

### Post-Load Validation:

- [ ] AWF schema is valid
- [ ] All required systems are loaded
- [ ] World-specific rules are active
- [ ] Performance guidelines are available

## World-Specific Load Orders

### Mystika World:

```
1. world-codex.mystika-lore.md
2. world-codex.mystika-logic.json
3. [Core systems layer]
4. [Engine layer]
5. [AI behavior layer]
6. [Data management layer]
7. [Performance layer]
8. adventure.whispercross.json
9. essence-integration-enhancement.json
```

### Verya World:

```
1. world-codex.veyra-lore.md
2. world-codex.veyra-logic.json
3. [Core systems layer]
4. [Engine layer]
5. [AI behavior layer]
6. [Data management layer]
7. [Performance layer]
8. adventure.veywood.json
9. adventure.veywood-expanded.json
```

## Error Handling

### Load Failures:

- **Missing required file**: Stop loading, report error
- **Invalid file format**: Skip file, continue with others
- **Version mismatch**: Use fallback version or report error
- **World mismatch**: Load generic fallback or report error

### Recovery Strategies:

- **Partial load**: Continue with available files
- **Fallback mode**: Use basic systems only
- **Error reporting**: Provide clear error messages
- **Graceful degradation**: Disable problematic features

## Performance Considerations

### Load Time Optimization:

- **Parallel loading**: Load independent files simultaneously
- **Caching**: Cache frequently used configurations
- **Lazy loading**: Load enhancement files only when needed
- **Compression**: Compress large configuration files

### Memory Management:

- **Unload unused**: Remove inactive world configurations
- **Reference counting**: Track file usage and dependencies
- **Garbage collection**: Clean up unused configurations
- **Memory limits**: Set maximum memory usage for configurations

## Development Guidelines

### Adding New Files:

1. **Determine authority level**: Place in appropriate layer
2. **Check dependencies**: Ensure required files are loaded first
3. **Update load order**: Add to this documentation
4. **Test compatibility**: Verify with existing files
5. **Update validation**: Add to pre/post-load checks

### Modifying Existing Files:

1. **Check impact**: Understand what files depend on this one
2. **Version compatibility**: Ensure changes don't break dependencies
3. **Test thoroughly**: Verify all affected systems still work
4. **Update documentation**: Reflect changes in this file

### World-Specific Extensions:

1. **Follow naming convention**: `{world}-{feature}.json`
2. **Load after core**: Place in Content or Enhancement layer
3. **Validate compatibility**: Ensure works with core systems
4. **Document requirements**: List any special dependencies

## Troubleshooting

### Common Issues:

- **File not found**: Check file path and naming
- **Version conflict**: Update to compatible versions
- **World mismatch**: Ensure world-specific files match current world
- **Load order error**: Verify files are loaded in correct sequence

### Debug Steps:

1. **Check file existence**: Verify all required files are present
2. **Validate load order**: Ensure files are loaded in correct sequence
3. **Check dependencies**: Verify all dependencies are satisfied
4. **Test individually**: Load files one by one to isolate issues
5. **Review logs**: Check for specific error messages

## Best Practices

### File Organization:

- **Group related files**: Keep world-specific files together
- **Use clear naming**: Follow consistent naming conventions
- **Version control**: Track changes and maintain compatibility
- **Documentation**: Keep this file updated with changes

### Performance:

- **Minimize file size**: Keep configurations concise
- **Optimize loading**: Use efficient file formats
- **Cache effectively**: Cache frequently accessed data
- **Monitor usage**: Track performance impact of configurations

### Maintenance:

- **Regular updates**: Keep configurations current
- **Backup strategies**: Maintain backup configurations
- **Testing procedures**: Test changes thoroughly
- **Rollback plans**: Have fallback configurations ready
