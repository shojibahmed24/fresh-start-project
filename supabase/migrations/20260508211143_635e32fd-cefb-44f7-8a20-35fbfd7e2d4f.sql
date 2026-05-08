CREATE OR REPLACE FUNCTION public.admin_get_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  rev_today numeric;
  rev_week numeric;
  rev_month numeric;
  rev_all numeric;
  orders_pending int;
  orders_approved int;
  orders_rejected int;
  total_users int;
  paying_users int;
  banned_users int;
  admin_users int;
  avg_order numeric;
  daily_trend jsonb;
  top_pkgs jsonb;
  by_method jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO rev_today
  FROM public.orders
  WHERE status = 'approved' AND created_at >= date_trunc('day', now());

  SELECT COALESCE(SUM(amount), 0) INTO rev_week
  FROM public.orders
  WHERE status = 'approved' AND created_at >= now() - interval '7 days';

  SELECT COALESCE(SUM(amount), 0) INTO rev_month
  FROM public.orders
  WHERE status = 'approved' AND created_at >= now() - interval '30 days';

  SELECT COALESCE(SUM(amount), 0) INTO rev_all
  FROM public.orders
  WHERE status = 'approved';

  SELECT COUNT(*) INTO orders_pending FROM public.orders WHERE status = 'pending';
  SELECT COUNT(*) INTO orders_approved FROM public.orders WHERE status = 'approved';
  SELECT COUNT(*) INTO orders_rejected FROM public.orders WHERE status = 'rejected';

  SELECT COALESCE(AVG(amount), 0) INTO avg_order
  FROM public.orders
  WHERE status = 'approved' AND amount > 0;

  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(DISTINCT user_id) INTO paying_users
  FROM public.orders
  WHERE status = 'approved' AND amount > 0;
  SELECT COUNT(*) INTO banned_users FROM public.user_bans;
  SELECT COUNT(DISTINCT user_id) INTO admin_users FROM public.user_roles WHERE role = 'admin';

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day), '[]'::jsonb) INTO daily_trend
  FROM (
    SELECT
      to_char(d::date, 'YYYY-MM-DD') AS day,
      COALESCE(SUM(o.amount), 0)::numeric AS revenue,
      COUNT(o.id)::int AS orders
    FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
    LEFT JOIN public.orders o
      ON date_trunc('day', o.created_at) = d AND o.status = 'approved'
    GROUP BY d
    ORDER BY d
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC), '[]'::jsonb) INTO top_pkgs
  FROM (
    SELECT
      package_name AS name,
      COUNT(*)::int AS orders,
      COALESCE(SUM(amount), 0)::numeric AS revenue,
      COALESCE(SUM(credits), 0)::int AS credits_sold
    FROM public.orders
    WHERE status = 'approved'
    GROUP BY package_name
    ORDER BY revenue DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC), '[]'::jsonb) INTO by_method
  FROM (
    SELECT
      payment_method::text AS method,
      COUNT(*)::int AS orders,
      COALESCE(SUM(amount), 0)::numeric AS revenue
    FROM public.orders
    WHERE status = 'approved'
    GROUP BY payment_method
  ) t;

  result := jsonb_build_object(
    'revenue', jsonb_build_object(
      'today', rev_today,
      'week', rev_week,
      'month', rev_month,
      'all_time', rev_all
    ),
    'orders', jsonb_build_object(
      'pending', orders_pending,
      'approved', orders_approved,
      'rejected', orders_rejected,
      'avg_order_value', round(avg_order, 2)
    ),
    'users', jsonb_build_object(
      'total', total_users,
      'paying', paying_users,
      'banned', banned_users,
      'admins', admin_users,
      'conversion_rate', CASE WHEN total_users > 0 THEN round((paying_users::numeric / total_users::numeric) * 100, 2) ELSE 0 END
    ),
    'daily_trend', daily_trend,
    'top_packages', top_pkgs,
    'by_payment_method', by_method
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_flagged_orders(boolean, integer) TO authenticated;