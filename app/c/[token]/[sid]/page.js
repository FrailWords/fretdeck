import FretDeck from "@/app/fretdeck-app";
export default async function Page({ params }) {
  const { token, sid } = await params;
  return <FretDeck token={token} initialSongId={sid} />;
}
