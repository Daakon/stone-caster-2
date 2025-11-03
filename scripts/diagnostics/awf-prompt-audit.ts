import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };

type CheckStatus = 'pass' | 'warning' | 'fail';

interface AuditCheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  summary: string;
  details?: string[];
  data?: Record<string, unknown>;
}

interface AuditSummary {
  overall: CheckStatus;
  pass: number;
  warning: number;
  fail: number;
}

interface AuditContext {
  sessionId?: string;
  simulated?: boolean;
  bundlePath?: string;
  bundleValidationErrors?: string[];
  injectionMapId?: string;
  liveOpsSnapshotDetected?: boolean;
  localizationPolicyEnforced?: boolean;
}

interface SimpleSchema {
  type: string | string[];
  required?: string[];
  properties?: Record<string, SimpleSchema>;
  items?: SimpleSchema;
  additionalProperties?: boolean;
}

interface SchemaDiff {
  missing: string[];
  extra: string[];
  typeMismatches: string[];
}

interface LegacyMatch {
  file: string;
  line: number;
  snippet: string;
}

interface LegacySearchResult {
  pattern: string;
  matches: LegacyMatch[];
}

interface BundleAssemblyResult {
  ok: boolean;
  reason?: string;
  metrics?: Record<string, unknown>;
  bundle?: JsonObject;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const reportDir = path.join(repoRoot, 'reports');

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdc',
  '.sql',
  '.txt',
  '.yml',
  '.yaml',
  '.prompt',
  '.prompt.json'
]);

const ignoreDirectories = new Set([
  '.git',
  '.github',
  '.cursor',
  '.vscode',
  'node_modules',
  'dist',
  'build',
  '.wrangler',
  'coverage',
  'reports',
  '.idea',
  '.turbo'
]);

const legacyPatterns: LegacySearchResult[] = [
  { pattern: 'db-assembler', matches: [] },
  { pattern: 'markdown', matches: [] },
  { pattern: '<<<FILE', matches: [] },
  { pattern: 'prompts/assembler', matches: [] },
  { pattern: 'file embed (<< <)', matches: [] }
];

async function main(): Promise<void> {
  const start = Date.now();
  const checks: AuditCheckResult[] = [];
  const context: AuditContext = {};

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  let supabase: SupabaseClient | null = null;
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }

  // Load schema
  const schemaPath = path.join(repoRoot, 'scripts', 'diagnostics', 'awf-bundle.schema.json');
  let schema: SimpleSchema | null = null;
  try {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent) as SimpleSchema;
  } catch (error) {
    checks.push({
      id: 'schema-load',
      title: 'Schema availability',
      status: 'fail',
      summary: 'Failed to load awf-bundle.schema.json',
      details: [String(error)]
    });
  }

  // Load modules dynamically to avoid breaking on missing env
  const moduleLoadChecks = await loadModules();
  checks.push(moduleLoadChecks);

  // Assemble bundle if possible
  const bundleResult = await assembleSampleBundle({
    supabase,
    checks,
    context
  });

  if (bundleResult.bundle && schema) {
    const awfNode = extractAwfNode(bundleResult.bundle);
    const diff = validateBundleAgainstSchema(awfNode, schema);
    const validationStatus: CheckStatus = diff.missing.length === 0 && diff.typeMismatches.length === 0 ? 'pass' : 'fail';

    const details: string[] = [];
    if (diff.missing.length > 0) {
      details.push(`Missing keys: ${diff.missing.join(', ')}`);
    }
    if (diff.typeMismatches.length > 0) {
      details.push(`Type mismatches: ${diff.typeMismatches.join(', ')}`);
    }
    if (diff.extra.length > 0) {
      details.push(`Extra keys: ${diff.extra.join(', ')}`);
    }

    checks.push({
      id: 'bundle-schema',
      title: 'Bundle schema compliance',
      status: validationStatus,
      summary:
        validationStatus === 'pass'
          ? 'Bundle matches expected AWF schema'
          : 'Bundle diverges from expected AWF schema',
      details: details.length > 0 ? details : undefined,
      data: {
        missing: diff.missing,
        extra: diff.extra,
        mismatches: diff.typeMismatches
      }
    });
    context.bundleValidationErrors = details.length > 0 ? details : undefined;
  } else if (!bundleResult.ok) {
    checks.push({
      id: 'bundle-schema',
      title: 'Bundle schema compliance',
      status: 'fail',
      summary: 'Bundle schema check skipped because bundle assembly failed',
      details: [bundleResult.reason ?? 'Unknown failure']
    });
  }

  // System prompt check
  const systemPromptCheck = await verifySystemPrompt();
  checks.push(systemPromptCheck);

  // Injection map check
  const injectionCheck = await inspectInjectionMap(supabase);
  checks.push(injectionCheck);
  if (injectionCheck.data?.injectionMapId && typeof injectionCheck.data.injectionMapId === 'string') {
    context.injectionMapId = injectionCheck.data.injectionMapId;
  }

  // Core contract schema check
  const coreContractCheck = await checkCoreContractSchema(supabase);
  checks.push(coreContractCheck);

  // World schema check
  const worldSchemaCheck = await checkWorldSchema(supabase);
  checks.push(worldSchemaCheck);

  // Legacy reference search
  const legacyCheck = await checkLegacyReferences();
  checks.push(legacyCheck);

  // Persistence search
  const persistenceCheck = await searchBundlePersistence();
  checks.push(persistenceCheck);

  // Token hygiene
  if (bundleResult.bundle) {
    const tokenCheck = evaluateTokenHygiene(bundleResult);
    checks.push(tokenCheck);
  } else {
    checks.push({
      id: 'token-hygiene',
      title: 'Token and tier hygiene',
      status: 'warning',
      summary: 'Token hygiene could not be evaluated because bundle data was unavailable'
    });
  }

  // LiveOps & localization
  if (bundleResult.bundle) {
    const liveOpsCheck = evaluateLiveOpsAndLocalization(bundleResult.bundle);
    checks.push(liveOpsCheck);
    context.liveOpsSnapshotDetected = liveOpsCheck.data?.liveOpsPresent === true;
    context.localizationPolicyEnforced = liveOpsCheck.data?.oneLanguagePolicy === true;
  } else {
    checks.push({
      id: 'liveops-localization',
      title: 'LiveOps and localization checks',
      status: 'warning',
      summary: 'LiveOps and localization checks skipped due to missing bundle data'
    });
  }

  await fs.mkdir(reportDir, { recursive: true });

  const summary = summarizeChecks(checks);
  const jsonReportPath = path.join(reportDir, 'awf-prompt-audit.json');
  const textReportPath = path.join(reportDir, 'awf-prompt-audit.txt');

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    summary,
    context,
    checks
  };

  await fs.writeFile(jsonReportPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
  await fs.writeFile(textReportPath, renderTextReport(reportPayload), 'utf-8');

  // Console summary
  printConsoleSummary(summary, checks);

  const exitCode = summary.overall === 'pass' ? 0 : summary.overall === 'warning' ? 2 : 1;
  process.exit(exitCode);
}

async function loadModules(): Promise<AuditCheckResult> {
  const issues: string[] = [];
  const successes: string[] = [];

  const modulePaths = [
    {
      label: 'assembler',
      pathSegments: ['backend', 'src', 'assemblers', 'awf-bundle-assembler.ts']
    },
    {
      label: 'orchestrator',
      pathSegments: ['backend', 'src', 'orchestrators', 'awf-turn-orchestrator.ts']
    },
    {
      label: 'validators',
      pathSegments: ['backend', 'src', 'validators', 'awf-bundle-validators.ts']
    }
  ];

  for (const moduleInfo of modulePaths) {
    const modulePath = path.join(repoRoot, ...moduleInfo.pathSegments);
    try {
      await import(pathToFileURL(modulePath).href);
      successes.push(`${moduleInfo.label} loaded`);
    } catch (error) {
      issues.push(`${moduleInfo.label} failed: ${String(error)}`);
    }
  }

  return {
    id: 'module-load',
    title: 'Module load check',
    status: issues.length === 0 ? 'pass' : 'fail',
    summary: issues.length === 0 ? 'Core AWF modules imported successfully' : 'One or more AWF modules failed to import',
    details: issues.length > 0 ? issues : successes
  };
}

async function assembleSampleBundle(options: {
  supabase: SupabaseClient | null;
  checks: AuditCheckResult[];
  context: AuditContext;
}): Promise<BundleAssemblyResult> {
  const { supabase, checks, context } = options;

  if (!supabase) {
    return {
      ok: false,
      reason: 'Supabase credentials are not configured'
    };
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      return { ok: false, reason: `Failed to load latest session: ${error.message}` };
    }

    const session = data && data.length > 0 ? data[0] : null;

    if (!session) {
      return { ok: false, reason: 'No AWF sessions found in database' };
    }

    context.sessionId = session.session_id ?? session.id ?? 'unknown';

    const assemblerPath = pathToFileURL(
      path.join(repoRoot, 'backend', 'src', 'assemblers', 'awf-bundle-assembler.ts')
    ).href;
    const assemblerModule = await import(assemblerPath);

    if (typeof assemblerModule.assembleBundle !== 'function') {
      return { ok: false, reason: 'assembleBundle function not exported from assembler module' };
    }

  const bundleResult = await assemblerModule.assembleBundle({
      sessionId: context.sessionId,
      inputText: 'AUDIT: verify AWF bundle assembly'
    });

    checks.push({
      id: 'bundle-assembly',
      title: 'Bundle assembly',
      status: 'pass',
      summary: `Bundle assembled for session ${context.sessionId}`,
      details: [
        `Byte size: ${bundleResult.metrics?.byteSize ?? 'unknown'}`,
        `Estimated tokens: ${bundleResult.metrics?.estimatedTokens ?? 'unknown'}`
      ],
      data: bundleResult.metrics
    });

    return {
      ok: true,
      bundle: bundleResult.bundle as JsonObject,
      metrics: bundleResult.metrics
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Bundle assembly failed: ${String(error)}`
    };
  }
}

function validateBundleAgainstSchema(bundle: JsonObject, schema: SimpleSchema): SchemaDiff {
  const missing: string[] = [];
  const extra: string[] = [];
  const typeMismatches: string[] = [];

  const errors = validateSchema(bundle, schema, '$');

  for (const error of errors) {
    if (error.startsWith('Missing')) {
      missing.push(error.replace('Missing required property ', ''));
    } else if (error.startsWith('Unexpected')) {
      extra.push(error.replace('Unexpected property ', ''));
    } else {
      typeMismatches.push(error);
    }
  }

  return { missing, extra, typeMismatches };
}

function validateSchema(value: unknown, schema: SimpleSchema, pathLabel: string): string[] {
  const errors: string[] = [];
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];

  if (!types.some((type) => matchesType(value, type))) {
    const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    errors.push(`Type mismatch at ${pathLabel}: expected ${types.join('|')}, got ${actualType}`);
    return errors;
  }

  if (types.includes('object') && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (schema.required) {
      for (const key of schema.required) {
        if (record[key] === undefined) {
          errors.push(`Missing required property ${pathLabel}.${key}`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (record[key] !== undefined) {
          errors.push(...validateSchema(record[key], childSchema, `${pathLabel}.${key}`));
        }
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(record)) {
        if (!schema.properties[key]) {
          errors.push(`Unexpected property ${pathLabel}.${key}`);
        }
      }
    }
  }

  if (types.includes('array') && Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateSchema(item, schema.items as SimpleSchema, `${pathLabel}[${index}]`));
      });
    }
  }

  return errors;
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

async function verifySystemPrompt(): Promise<AuditCheckResult> {
  try {
    const modulePath = pathToFileURL(
      path.join(repoRoot, 'backend', 'src', 'model', 'system-prompts.ts')
    ).href;
    const module = await import(modulePath);
    const runtime = module.SYSTEM_AWF_RUNTIME as string;
    const runtimeWithTools = module.SYSTEM_AWF_RUNTIME_WITH_TOOLS as string;

    const issues: string[] = [];
    if (!runtime) {
      issues.push('SYSTEM_AWF_RUNTIME missing or empty');
    }
    if (!runtimeWithTools) {
      issues.push('SYSTEM_AWF_RUNTIME_WITH_TOOLS missing or empty');
    }
    if (runtime && runtimeWithTools && !runtimeWithTools.startsWith(runtime)) {
      issues.push('Tool-enabled system prompt does not extend base runtime prompt');
    }
    if (runtime && /<<<|```/.test(runtime)) {
      issues.push('Base system prompt contains file embed markers');
    }
    if (runtimeWithTools && /<<<|```/.test(runtimeWithTools)) {
      issues.push('Tool-enabled prompt contains file embed markers');
    }

    return {
      id: 'system-prompt',
      title: 'System prompt verification',
      status: issues.length === 0 ? 'pass' : 'fail',
      summary: issues.length === 0 ? 'System prompt matches minimal runtime requirements' : 'System prompt diverges from minimal runtime',
      details: issues.length > 0 ? issues : [`Runtime prompt: ${trimExcerpt(runtime, 140)}`],
      data: {
        runtimeExcerpt: trimExcerpt(runtime, 200),
        runtimeWithToolsExcerpt: trimExcerpt(runtimeWithTools, 200)
      }
    };
  } catch (error) {
    return {
      id: 'system-prompt',
      title: 'System prompt verification',
      status: 'fail',
      summary: 'Failed to load system prompt module',
      details: [String(error)]
    };
  }
}

async function inspectInjectionMap(supabase: SupabaseClient | null): Promise<AuditCheckResult> {
  if (!supabase) {
    return {
      id: 'injection-map',
      title: 'Injection map inspection',
      status: 'fail',
      summary: 'Supabase credentials missing; cannot inspect injection map'
    };
  }

  try {
    const { data, error } = await supabase
      .from('injection_map')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      return {
        id: 'injection-map',
        title: 'Injection map inspection',
        status: 'fail',
        summary: `Failed to fetch injection map: ${error.message}`
      };
    }

    const record = data && data.length > 0 ? data[0] : null;
    if (!record) {
      return {
        id: 'injection-map',
        title: 'Injection map inspection',
        status: 'fail',
        summary: 'No injection map records found'
      };
    }

    const buildKeys = record.doc?.build ? Object.keys(record.doc.build) : [];
    const actsKeys = record.doc?.acts ? Object.keys(record.doc.acts) : [];
    const hasModes = Boolean(record.doc?.acts?.modes);

    const assemblerSource = await fs.readFile(
      path.join(repoRoot, 'backend', 'src', 'assemblers', 'awf-bundle-assembler.ts'),
      'utf-8'
    );
    const usesInjectionMap = assemblerSource.includes('applyInjectionMap');

    const issues: string[] = [];
    if (buildKeys.length === 0) issues.push('Injection map build section is empty');
    if (actsKeys.length === 0) issues.push('Injection map acts section is empty');
    if (!hasModes) issues.push('Injection map acts section missing modes configuration');
    if (!usesInjectionMap) issues.push('Assembler does not appear to apply injection map');

    return {
      id: 'injection-map',
      title: 'Injection map inspection',
      status: issues.length === 0 ? 'pass' : 'fail',
      summary: issues.length === 0 ? 'Injection map drives build and acts sections' : 'Injection map gaps detected',
      details: issues.length > 0 ? issues : [`Build keys: ${buildKeys.length}`, `Acts keys: ${actsKeys.length}`],
      data: {
        injectionMapId: record.id,
        buildKeys,
        actsKeys,
        modesPresent: hasModes,
        assemblerUsesInjectionMap: usesInjectionMap
      }
    };
  } catch (error) {
    return {
      id: 'injection-map',
      title: 'Injection map inspection',
      status: 'fail',
      summary: 'Failed to inspect injection map',
      details: [String(error)]
    };
  }
}

async function checkWorldSchema(supabase: SupabaseClient | null): Promise<AuditCheckResult> {
  if (!supabase) {
    return {
      id: 'world-schema',
      title: 'World schema compliance',
      status: 'warning',
      summary: 'World schema check skipped - no database connection'
    };
  }

  try {
    // Get latest world
    const { data: world, error } = await supabase
      .from('worlds')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !world) {
      return {
        id: 'world-schema',
        title: 'World schema compliance',
        status: 'fail',
        summary: 'No world documents found',
        details: error ? [error.message] : ['No world documents in database']
      };
    }

    const doc = world.doc;
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for required fields only
    if (!doc.id || typeof doc.id !== 'string') {
      issues.push('Missing or invalid "id" field');
    }
    if (!doc.name || typeof doc.name !== 'string') {
      issues.push('Missing or invalid "name" field');
    }
    if (!doc.version || typeof doc.version !== 'string') {
      issues.push('Missing or invalid "version" field');
    }

    // Check for slices (should be array if present)
    if (doc.slices !== undefined && !Array.isArray(doc.slices)) {
      issues.push('Invalid "slices" field - must be array if present');
    }

    // Warn if no bands are present (either top-level or in timeworld)
    const hasTopLevelBands = Array.isArray(doc.bands) && doc.bands.length > 0;
    const hasTimeworldBands = doc.timeworld && Array.isArray(doc.timeworld.bands) && doc.timeworld.bands.length > 0;
    if (!hasTopLevelBands && !hasTimeworldBands) {
      warnings.push('No bands found (neither top-level nor in timeworld)');
    }

    // Warn if no weather states are present
    const hasTopLevelWeather = Array.isArray(doc.weather_states) && doc.weather_states.length > 0;
    const hasTimeworldWeather = doc.timeworld && doc.timeworld.weather_states && Array.isArray(doc.timeworld.weather_states) && doc.timeworld.weather_states.length > 0;
    if (!hasTopLevelWeather && !hasTimeworldWeather) {
      warnings.push('No weather states found (neither top-level nor in timeworld)');
    }

    // Check for legacy fields (should not be present)
    if (doc.hash) {
      issues.push('CRITICAL: Legacy field "hash" found in document');
    }
    if (doc.time) {
      issues.push('CRITICAL: Legacy field "time" found in document');
    }
    if (doc.title) {
      issues.push('CRITICAL: Legacy field "title" found in document');
    }
    if (doc.time_bands) {
      issues.push('CRITICAL: Legacy field "time_bands" found in document');
    }

    const criticalIssues = issues.filter(issue => issue.includes('CRITICAL'));
    const status: CheckStatus = issues.length === 0 ? (warnings.length > 0 ? 'warning' : 'pass') : 'fail';

    return {
      id: 'world-schema',
      title: 'World schema compliance',
      status,
      summary: status === 'pass'
        ? 'World document matches flexible schema'
        : status === 'warning'
          ? 'World document matches flexible schema with warnings'
          : criticalIssues.length > 0
            ? 'World document contains legacy fields'
            : 'World document missing required fields',
      details: [...issues, ...warnings].length > 0 ? [...issues, ...warnings] : undefined,
      data: {
        worldId: world.id,
        worldVersion: world.version,
        hasTimeworld: Boolean(doc.timeworld),
        hasTopLevelBands: hasTopLevelBands,
        hasTimeworldBands: hasTimeworldBands,
        hasTopLevelWeather: hasTopLevelWeather,
        hasTimeworldWeather: hasTimeworldWeather,
        hasCustomSections: Object.keys(doc).some(key => !['id', 'name', 'version', 'timeworld', 'bands', 'weather_states', 'weather_transition_bias', 'lexicon', 'identity_language', 'magic', 'essence_behavior', 'species_rules', 'factions_world', 'lore_index', 'tone', 'locations', 'slices'].includes(key)),
        hasLegacyFields: criticalIssues.length > 0
      }
    };
  } catch (error) {
    return {
      id: 'world-schema',
      title: 'World schema compliance',
      status: 'fail',
      summary: 'Failed to check world schema',
      details: [String(error)]
    };
  }
}

async function checkCoreContractSchema(supabase: SupabaseClient | null): Promise<AuditCheckResult> {
  if (!supabase) {
    return {
      id: 'core-contract-schema',
      title: 'Core contract schema compliance',
      status: 'warning',
      summary: 'Core contract schema check skipped - no database connection'
    };
  }

  try {
    // Get active core contract
    const { data: coreContract, error } = await supabase
      .from('core_contracts')
      .select('*')
      .eq('active', true)
      .single();

    if (error || !coreContract) {
      return {
        id: 'core-contract-schema',
        title: 'Core contract schema compliance',
        status: 'fail',
        summary: 'No active core contract found',
        details: error ? [error.message] : ['No active core contract in database']
      };
    }

    const doc = coreContract.doc;
    const issues: string[] = [];

    // Check for new schema compliance
    if (!doc.contract) {
      issues.push('Missing required "contract" object');
    } else {
      const contract = doc.contract;
      if (!contract.awf_return) issues.push('Contract missing "awf_return" field');
      if (!contract['scn.phases'] || !Array.isArray(contract['scn.phases'])) {
        issues.push('Contract missing or invalid "scn.phases" array');
      }
      if (!contract['txt.policy']) issues.push('Contract missing "txt.policy" field');
      if (!contract['choices.policy']) issues.push('Contract missing "choices.policy" field');
      if (!contract['acts.policy']) issues.push('Contract missing "acts.policy" field');
    }

    if (!doc.rules) {
      issues.push('Missing required "rules" object');
    } else {
      const requiredRules = ['language', 'scales', 'token_discipline', 'time', 'menus', 'mechanics_visibility', 'safety'];
      for (const rule of requiredRules) {
        if (!doc.rules[rule]) {
          issues.push(`Rules missing required "${rule}" section`);
        }
      }
    }

    if (!doc.acts_catalog || !Array.isArray(doc.acts_catalog) || doc.acts_catalog.length === 0) {
      issues.push('Missing or empty "acts_catalog" array');
    }

    if (!doc.defaults) {
      issues.push('Missing required "defaults" object');
    } else {
      if (typeof doc.defaults.txt_sentences_min !== 'number') {
        issues.push('Defaults missing "txt_sentences_min" number');
      }
      if (typeof doc.defaults.txt_sentences_max !== 'number') {
        issues.push('Defaults missing "txt_sentences_max" number');
      }
      if (!Array.isArray((doc.defaults as any).time_band_cycle)) {
        issues.push('Defaults missing "time_band_cycle" array');
      }
    }

    // Check for legacy fields (should not be present)
    if (doc.contract) {
      if (doc.contract.version) issues.push('CRITICAL: Legacy field "contract.version" found');
      if (doc.contract.name) issues.push('CRITICAL: Legacy field "contract.name" found');
      if (doc.contract.description) issues.push('CRITICAL: Legacy field "contract.description" found');
    }

    if (doc.acts && doc.acts.allowed) {
      issues.push('CRITICAL: Legacy field "acts.allowed" found');
    }

    if (doc.memory && doc.memory.exemplars) {
      issues.push('CRITICAL: Legacy field "memory.exemplars" found');
    }

    const status: CheckStatus = issues.length === 0 ? 'pass' : 'fail';
    const criticalIssues = issues.filter(issue => issue.includes('CRITICAL'));

    return {
      id: 'core-contract-schema',
      title: 'Core contract schema compliance',
      status,
      summary: issues.length === 0 
        ? 'Core contract follows new AWF schema'
        : criticalIssues.length > 0
          ? `CRITICAL: ${criticalIssues.length} legacy fields found`
          : `${issues.length} schema issues found`,
      details: issues.length > 0 ? issues : undefined,
      data: {
        contractId: coreContract.id,
        contractVersion: coreContract.version,
        issuesCount: issues.length,
        criticalIssuesCount: criticalIssues.length
      }
    };

  } catch (error) {
    return {
      id: 'core-contract-schema',
      title: 'Core contract schema compliance',
      status: 'fail',
      summary: 'Failed to check core contract schema',
      details: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

async function checkLegacyReferences(): Promise<AuditCheckResult> {
  const collected: LegacySearchResult[] = JSON.parse(JSON.stringify(legacyPatterns));

  await walkDirectory(repoRoot, async (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    if (!textExtensions.has(extension) && extension !== '') {
      return;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (const legacyEntry of collected) {
      const isFileEmbedPattern = legacyEntry.pattern === 'file embed (<< <)';
      const regex = isFileEmbedPattern
        ? null
        : new RegExp(legacyEntry.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

      lines.forEach((line, idx) => {
        const hasMatch = isFileEmbedPattern ? line.includes('<<<') : Boolean(regex?.test(line));
        if (hasMatch) {
          legacyEntry.matches.push({
            file: path.relative(repoRoot, filePath),
            line: idx + 1,
            snippet: line.trim().slice(0, 200)
          });
        }
        if (regex) {
          regex.lastIndex = 0;
        }
      });
    }
  });

  const totalMatches = collected.reduce((acc, item) => acc + item.matches.length, 0);
  const details: string[] = [];
  for (const entry of collected) {
    if (entry.matches.length > 0) {
      details.push(`${entry.pattern}: ${entry.matches.length} matches`);
    }
  }

  return {
    id: 'legacy-references',
    title: 'Legacy path references',
    status: totalMatches === 0 ? 'pass' : 'fail',
    summary: totalMatches === 0 ? 'No legacy prompt references detected' : 'Legacy prompt references found',
    details: totalMatches > 0 ? details.slice(0, 20) : undefined,
    data: {
      matches: collected
    }
  };
}

async function searchBundlePersistence(): Promise<AuditCheckResult> {
  const matches: LegacyMatch[] = [];

  await walkDirectory(repoRoot, async (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    if (!textExtensions.has(extension) && extension !== '') {
      return;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const regex = /(insert|upsert|update)[\s\S]{0,120}awf_bundle/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      const snippetStart = Math.max(0, match.index - 40);
      const snippetEnd = Math.min(content.length, match.index + 160);
      const snippet = content.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ');
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      matches.push({
        file: path.relative(repoRoot, filePath),
        line,
        snippet: snippet.slice(0, 200)
      });
    }
  });

  return {
    id: 'bundle-persistence',
    title: 'Bundle persistence check',
    status: matches.length === 0 ? 'pass' : 'fail',
    summary: matches.length === 0 ? 'No bundle persistence writes detected' : 'Potential bundle persistence writes found',
    details: matches.length > 0 ? matches.slice(0, 10).map((m) => `${m.file}:${m.line}`) : undefined,
    data: {
      matches
    }
  };
}

function evaluateTokenHygiene(result: BundleAssemblyResult): AuditCheckResult {
  const bundle = result.bundle ?? {};
  const awf = extractAwfNode(bundle);

  const metrics = result.metrics ?? {};
  const npcCount = extractArrayLength(awf, ['npcs', 'active']) ?? (metrics.npcCount as number | undefined) ?? 0;

  const issues: string[] = [];
  if (npcCount > 5) {
    issues.push(`NPC count exceeds limit: ${npcCount} > 5`);
  }

  const estimatedTokens = metrics.estimatedTokens;
  if (typeof estimatedTokens === 'number' && estimatedTokens > 260) {
    issues.push(`Bundle estimated tokens exceed 260: ${estimatedTokens}`);
  }

  if (!hasPropertyPath(awf, ['warm', 'episodic'])) {
    issues.push('Warm episodic memories missing');
  }

  const status: CheckStatus = issues.length === 0 ? 'pass' : 'warning';

  return {
    id: 'token-hygiene',
    title: 'Token and tier hygiene',
    status,
    summary: status === 'pass' ? 'Token hygiene within expected limits' : 'Token hygiene deviations detected',
    details: issues.length > 0 ? issues : undefined,
    data: {
      npcCount,
      estimatedTokens,
      warmEpisodicEntries: Array.isArray((awf?.warm as any)?.episodic) ? ((awf.warm as any).episodic as unknown[]).length : 0
    }
  };
}

function evaluateLiveOpsAndLocalization(bundle: JsonObject): AuditCheckResult {
  const awf = extractAwfNode(bundle);
  const liveOps = getObjectProperty(awf, ['liveops']);
  const liveOpsPresent = liveOps ? Object.keys(liveOps).length > 0 : false;
  const locale = getStringProperty(awf, ['meta', 'locale']);
  const oneLanguagePolicy = Boolean(
    locale && typeof locale === 'string' && /[a-z]{2,3}-[A-Z]{2}/.test(locale)
  );

  // Check for token_budget and tool_quota in meta
  const meta = getObjectProperty(awf, ['meta']);
  const tokenBudget = getObjectProperty(meta, ['token_budget']);
  const toolQuota = getObjectProperty(meta, ['tool_quota']);
  const tokenBudgetPresent = tokenBudget ? Object.keys(tokenBudget).length > 0 : false;
  const toolQuotaPresent = toolQuota ? Object.keys(toolQuota).length > 0 : false;

  // Check core.ruleset
  const core = getObjectProperty(awf, ['core']);
  const ruleset = getObjectProperty(core, ['ruleset']);
  const rulesetPresent = ruleset !== null;

  // Check core.contract.acts_catalog
  const coreContract = getObjectProperty(core, ['contract']);
  const actsCatalog = getArrayProperty(coreContract, ['acts_catalog']);
  const actsCatalogPresent = actsCatalog !== null && actsCatalog.length > 0;

  const issues: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // FAIL if ruleset is missing
  if (!rulesetPresent) {
    issues.push('CRITICAL: bundle.core.ruleset is missing');
  }

  // WARN if acts_catalog is empty when it should have entries
  if (!actsCatalogPresent && coreContract) {
    warnings.push('bundle.core.contract.acts_catalog is empty or missing (may be expected if contract has none)');
  }

  // INFO for LiveOps levers
  if (tokenBudgetPresent) {
    const inputMax = (tokenBudget as any).input_max;
    const outputMax = (tokenBudget as any).output_max;
    info.push(`token_budget: input_max=${inputMax}, output_max=${outputMax}`);
  }

  if (toolQuotaPresent) {
    const maxCalls = (toolQuota as any).max_calls;
    info.push(`tool_quota: max_calls=${maxCalls}`);
  }

  // Check i18n application when locale is non-English
  if (locale && locale !== 'en-US') {
    const world = getObjectProperty(awf, ['world']);
    const adventure = getObjectProperty(awf, ['adventure']);
    
    // If world/adventure names exist, check if they differ from source (indicates i18n applied)
    // This is informational - we can't verify source vs overlay without original docs
    if (world && adventure) {
      info.push(`i18n locale ${locale} detected; overlays should be applied in world/adventure names and synopses`);
    }
  }

  if (liveOpsPresent) {
    issues.push('LiveOps snapshot detected in bundle');
  }
  if (!oneLanguagePolicy) {
    issues.push('Localization one-language policy not enforced or locale missing');
  }

  const status: CheckStatus = issues.length > 0 ? 'fail' : warnings.length > 0 ? 'warning' : 'pass';

  const allDetails = [...issues, ...warnings, ...info];
  
  return {
    id: 'liveops-localization',
    title: 'LiveOps and localization checks',
    status,
    summary: status === 'fail'
      ? `${issues.length} critical issues found`
      : status === 'warning'
        ? `${warnings.length} warnings detected`
        : 'LiveOps and localization policies satisfied',
    details: allDetails.length > 0 ? allDetails : undefined,
    data: {
      liveOpsPresent,
      locale,
      oneLanguagePolicy,
      tokenBudgetPresent,
      toolQuotaPresent,
      rulesetPresent,
      actsCatalogPresent,
      tokenBudgetValues: tokenBudgetPresent ? tokenBudget : undefined,
      toolQuotaValues: toolQuotaPresent ? toolQuota : undefined,
    }
  };
}

function extractAwfNode(bundle: JsonObject): JsonObject {
  const candidate = getNestedValue(bundle, ['awf_bundle']);
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as JsonObject;
  }
  return bundle;
}

function getNestedValue(obj: JsonObject | null | undefined, path: string[]): JsonValue | undefined {
  let current: JsonValue | undefined = obj ?? undefined;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as JsonObject)[segment];
  }
  return current;
}

function getObjectProperty(obj: JsonObject | null | undefined, path: string[]): JsonObject | null {
  const value = getNestedValue(obj, path);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

function getArrayProperty(obj: JsonObject | null | undefined, path: string[]): JsonValue[] | null {
  const value = getNestedValue(obj, path);
  return Array.isArray(value) ? (value as JsonValue[]) : null;
}

function getStringProperty(obj: JsonObject | null | undefined, path: string[]): string | undefined {
  const value = getNestedValue(obj, path);
  return typeof value === 'string' ? value : undefined;
}

function extractArrayLength(obj: JsonObject | null | undefined, path: string[]): number | null {
  const arr = getArrayProperty(obj, path);
  return arr ? arr.length : null;
}

function hasPropertyPath(obj: JsonObject | null | undefined, path: string[]): boolean {
  return getNestedValue(obj, path) !== undefined;
}

function summarizeChecks(checks: AuditCheckResult[]): AuditSummary {
  let pass = 0;
  let warning = 0;
  let fail = 0;

  for (const check of checks) {
    if (check.status === 'pass') pass += 1;
    if (check.status === 'warning') warning += 1;
    if (check.status === 'fail') fail += 1;
  }

  let overall: CheckStatus = 'pass';
  if (fail > 0) {
    overall = 'fail';
  } else if (warning > 0) {
    overall = 'warning';
  }

  return {
    overall,
    pass,
    warning,
    fail
  };
}

function renderTextReport(payload: {
  generatedAt: string;
  durationMs: number;
  summary: AuditSummary;
  context: AuditContext;
  checks: AuditCheckResult[];
}): string {
  const lines: string[] = [];
  lines.push(`AWF Prompt Audit`);
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push(`Duration: ${payload.durationMs}ms`);
  lines.push(`Overall: ${payload.summary.overall.toUpperCase()}`);
  lines.push(`Pass: ${payload.summary.pass}, Warning: ${payload.summary.warning}, Fail: ${payload.summary.fail}`);
  if (payload.context.sessionId) {
    lines.push(`Session: ${payload.context.sessionId}`);
  }
  lines.push('');
  lines.push('Checks:');
  for (const check of payload.checks) {
    lines.push(`- [${check.status.toUpperCase()}] ${check.title} :: ${check.summary}`);
    if (check.details) {
      for (const detail of check.details.slice(0, 5)) {
        lines.push(`    • ${detail}`);
      }
      if (check.details.length > 5) {
        lines.push(`    • (+${check.details.length - 5} more)`);
      }
    }
  }
  return lines.join('\n');
}

function printConsoleSummary(summary: AuditSummary, checks: AuditCheckResult[]): void {
  console.log('');
  console.log('AWF Prompt Audit Summary');
  console.log(`Overall: ${summary.overall.toUpperCase()}`);
  console.log(`Pass: ${summary.pass} | Warning: ${summary.warning} | Fail: ${summary.fail}`);
  console.log('');
  for (const check of checks) {
    const label = check.status === 'pass' ? '[OK]' : check.status === 'warning' ? '[WARN]' : '[FAIL]';
    console.log(`${label} ${check.title} - ${check.summary}`);
  }
  console.log('');
  console.log(`Detailed reports written to reports/awf-prompt-audit.json and reports/awf-prompt-audit.txt`);
}

async function walkDirectory(dir: string, onFile: (filePath: string) => Promise<void>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirectories.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, onFile);
    } else if (entry.isFile()) {
      await onFile(fullPath);
    }
  }
}

function trimExcerpt(value: string, limit: number): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

void main().catch((error) => {
  console.error('[awf-prompt-audit] Unhandled error', error);
  process.exit(1);
});
