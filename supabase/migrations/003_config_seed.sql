-- Seed baseline configuration values for StoneCaster

INSERT INTO pricing_config (key, value)
VALUES
  ('turn_cost_default', '{"value":2}'),
  ('turn_cost_by_world', '{"value":{}}'),
  ('guest_starter_casting_stones', '{"value":15}'),
  ('guest_daily_regen', '{"value":0}'),
  ('conversion_rates', '{"value":{"shard":10,"crystal":100,"relic":500}}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ai_config (key, value)
VALUES
  ('active_model', '{"value":"PRIMARY_AI_MODEL"}'),
  ('prompt_schema_version', '{"value":"1.0.0"}'),
  ('max_tokens_in', '{"value":4096}'),
  ('max_tokens_out', '{"value":1024}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, type)
VALUES
  ('cookie_ttl_days', '{"value":60}', 'number'),
  ('idempotency_required', '{"value":true}', 'boolean'),
  ('allow_async_turn_fallback', '{"value":true}', 'boolean'),
  ('telemetry_sample_rate', '{"value":1.0}', 'number'),
  ('drifter_enabled', '{"value":true}', 'boolean'),
  ('guest_cookie_issue_rate_limit_per_hour', '{"value":10}', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO feature_flags (key, enabled, payload)
VALUES
  ('stones_show_guest_pill', TRUE, '{}'::jsonb),
  ('drifter_onboarding', TRUE, '{}'::jsonb),
  ('ws_push_enabled', FALSE, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

