// CORS headers shared by every response from this edge function (including
// preflight OPTIONS and error responses). Kept tiny + dependency-free so any
// module can import without pulling extra weight.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
