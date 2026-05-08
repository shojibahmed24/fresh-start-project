CREATE POLICY "Users can insert their own turn events"
ON public.agent_turn_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);