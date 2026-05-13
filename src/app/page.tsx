import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // AUTH DISABLED — restore original redirects when login is re-enabled
  // if (user) {
  //   redirect("/projects");
  // } else {
  //   redirect("/login");
  // }
  redirect("/projects");
}
