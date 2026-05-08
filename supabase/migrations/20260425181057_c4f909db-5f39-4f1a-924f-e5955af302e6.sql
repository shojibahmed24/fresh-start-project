-- Drop the duplicate agent_memory table that was created by mistake.
-- The existing project_memory table already serves the same purpose
-- (with richer schema: category/content/weight/source) and contains
-- live data, so we consolidate onto project_memory.
DROP TABLE IF EXISTS public.agent_memory CASCADE;

-- Helper index so the agent can quickly look up its own key-value entries.
-- Agent entries use category='agent:<key>' (e.g. 'agent:design.colors')
-- and source='agent' so they don't collide with the freeform journal entries
-- already in the table.
CREATE INDEX IF NOT EXISTS idx_project_memory_agent_lookup
  ON public.project_memory (project_id, category)
  WHERE source = 'agent';