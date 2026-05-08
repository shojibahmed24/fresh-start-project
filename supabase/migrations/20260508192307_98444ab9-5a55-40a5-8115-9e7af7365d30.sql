-- Allow logged-in users to call admin_get_analytics; the function itself enforces admin-only access.
GRANT EXECUTE ON FUNCTION public.admin_get_analytics() TO authenticated;

-- Defensive: ensure the function rejects non-admins from inside (in case it didn't already).
CREATE OR REPLACE FUNCTION public.admin_get_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  WITH
  rev AS (
    SELECT
      COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE THEN amount_bdt END),0)::numeric AS today,
      COALESCE(SUM(CASE WHEN created_at >= now() - interval '7 days' THEN amount_bdt END),0)::numeric AS week,
      COALESCE(SUM(CASE WHEN created_at >= now() - interval '30 days' THEN amount_bdt END),0)::numeric AS month,
      COALESCE(SUM(amount_bdt),0)::numeric AS all_time
    FROM public.orders WHERE status='approved'
  ),
  ord AS (
    SELECT
      COUNT(*) FILTER (WHERE status='pending') AS pending,
      COUNT(*) FILTER (WHERE status='approved') AS approved,
      COUNT(*) FILTER (WHERE status='rejected') AS rejected,
      COALESCE(AVG(amount_bdt) FILTER (WHERE status='approved'),0)::numeric AS avg_order_value
    FROM public.orders
  ),
  usr AS (
    SELECT
      (SELECT COUNT(*) FROM public.profiles) AS total,
      (SELECT COUNT(DISTINCT user_id) FROM public.orders WHERE status='approved') AS paying,
      (SELECT COUNT(*) FROM public.profiles WHERE COALESCE(banned,false)=true) AS banned,
      (SELECT COUNT(*) FROM public.user_roles WHERE role='admin') AS admins
  ),
  daily AS (
    SELECT to_char(d::date,'YYYY-MM-DD') AS day,
           COALESCE(SUM(o.amount_bdt) FILTER (WHERE o.status='approved'),0)::numeric AS revenue,
           COUNT(o.id) FILTER (WHERE o.status='approved') AS orders
    FROM generate_series(CURRENT_DATE - interval '29 days', CURRENT_DATE, interval '1 day') d
    LEFT JOIN public.orders o ON o.created_at::date = d::date
    GROUP BY d ORDER BY d
  ),
  pkgs AS (
    SELECT p.name,
           COUNT(o.id) AS orders,
           COALESCE(SUM(o.amount_bdt),0)::numeric AS revenue,
           COALESCE(SUM(p.credits),0)::bigint AS credits_sold
    FROM public.orders o
    JOIN public.packages p ON p.id = o.package_id
    WHERE o.status='approved'
    GROUP BY p.name ORDER BY revenue DESC LIMIT 5
  ),
  pm AS (
    SELECT payment_method AS method,
           COUNT(*) AS orders,
           COALESCE(SUM(amount_bdt),0)::numeric AS revenue
    FROM public.orders WHERE status='approved'
    GROUP BY payment_method ORDER BY revenue DESC
  )
  SELECT jsonb_build_object(
    'revenue', (SELECT to_jsonb(rev) FROM rev),
    'orders', (SELECT to_jsonb(ord) FROM ord),
    'users', (SELECT jsonb_build_object(
      'total', total,'paying',paying,'banned',banned,'admins',admins,
      'conversion_rate', CASE WHEN total>0 THEN ROUND((paying::numeric/total)*100,2) ELSE 0 END
    ) FROM usr),
    'daily_trend', COALESCE((SELECT jsonb_agg(to_jsonb(daily)) FROM daily),'[]'::jsonb),
    'top_packages', COALESCE((SELECT jsonb_agg(to_jsonb(pkgs)) FROM pkgs),'[]'::jsonb),
    'by_payment_method', COALESCE((SELECT jsonb_agg(to_jsonb(pm)) FROM pm),'[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_analytics() TO authenticated;