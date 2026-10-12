import { requireOnboardedProfile } from "@/lib/auth/session";
import { getHomeData } from "@/lib/data/learner";
import { HomeView } from "./home-view";

export default async function HomePage() {
  const profile = await requireOnboardedProfile();
  const now = new Date();
  return <HomeView profile={profile} data={await getHomeData(profile, now)} now={now} />;
}
