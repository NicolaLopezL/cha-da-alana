import { LiveControl } from "@/components/admin/quiz/LiveControl";
import { baseUrl } from "@/lib/server/admin-data";
import { adminState } from "@/lib/server/quiz/service";

export default async function QuizLiveAdminPage() {
  const [state, base] = await Promise.all([adminState(), baseUrl()]);
  return <LiveControl initial={state} url={`${base}/quiz/ao-vivo`} />;
}
