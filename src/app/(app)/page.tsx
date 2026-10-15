import { requireOnboardedProfile } from "@/lib/auth/session";
import { getHomeData } from "@/lib/data/learner";
import { getJobTitle } from "@/lib/data/staff-titles";
import { HomeView } from "./home-view";

export default async function HomePage() {
  const profile = await requireOnboardedProfile();
  const now = new Date();
  const [data, jobTitle] = await Promise.all([getHomeData(profile, now), getJobTitle(profile.email)]);
  return <HomeView profile={profile} jobTitle={jobTitle} data={data} now={now} />;
}
