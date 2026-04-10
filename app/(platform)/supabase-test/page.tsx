import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
  const supabase = await createClient();

  const { error } = await supabase.from("_healthcheck").select("id").limit(1);

  return (
    <main>
      <h1>Supabase test</h1>
      <p>{error ? `Connection check ran (expected if table is missing): ${error.message}` : "Connection check succeeded."}</p>
    </main>
  );
}
